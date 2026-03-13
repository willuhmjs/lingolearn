import { SvelteKitAuth } from '@auth/sveltekit';
import Google from '@auth/sveltekit/providers/google';
import Credentials from '@auth/sveltekit/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '$lib/server/prisma';
import bcrypt from 'bcrypt';
import { getSiteSettings } from '$lib/server/settings';

const adapter = PrismaAdapter(prisma);
const originalCreateUser = adapter.createUser!;
adapter.createUser = async (user) => {
	const baseUsername = user.email?.split('@')[0] || 'user';
	const username = `${baseUsername}-${Math.floor(Math.random() * 10000)}`;

	// Run create + first-user check in one transaction to eliminate TOCTOU race.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const createdUser = await prisma.$transaction(async (tx) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const newUser = await originalCreateUser({ ...user, username, role: 'USER' } as any);
		const count = await tx.user.count();
		if (count === 1 && newUser.id) {
			return tx.user.update({
				where: { id: newUser.id as string },
				data: { role: 'ADMIN' }
			});
		}
		return newUser;
	});

	return createdUser;
};

export const { handle, signIn, signOut } = SvelteKitAuth({
	adapter,
	session: {
		strategy: 'database'
	},
	providers: [
		Google,
		Credentials({
			credentials: {
				email: { label: 'Email', type: 'email' },
				password: { label: 'Password', type: 'password' }
			},
			async authorize(credentials) {
				const settings = await getSiteSettings();
				if (!settings.localLoginEnabled) return null;

				if (!credentials?.email || !credentials?.password) return null;
				const identifier = credentials.email as string;
				const user = await prisma.user.findFirst({
					where: {
						OR: [{ email: identifier }, { username: identifier }]
					}
				});
				if (!user || !user.passwordHash) return null;
				const passwordsMatch = await bcrypt.compare(
					credentials.password as string,
					user.passwordHash
				);
				if (passwordsMatch) return user;
				return null;
			}
		})
	],
	pages: {
		error: '/login'
	},
	callbacks: {
		async session({ session, user }) {
			// Attach basic user info to the session
			// Note: cefrLevel and hasOnboarded are now in UserProgress table
			// and are loaded in hooks.server.ts
			if (session.user && user) {
				session.user.id = user.id;
				// @ts-expect-error - Custom property
				session.user.username = user.username;
				// @ts-expect-error - Custom property
				session.user.role = user.role;
				// @ts-expect-error - Custom property
				session.user.theme = user.theme;
			}
			return session;
		}
	},
	trustHost: true
});
