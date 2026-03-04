import { SvelteKitAuth } from "@auth/sveltekit"
import Google from "@auth/sveltekit/providers/google"
import Credentials from "@auth/sveltekit/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "$lib/server/prisma"
import bcrypt from "bcrypt"
import { getSiteSettings } from "$lib/server/settings"

const adapter = PrismaAdapter(prisma)
const originalCreateUser = adapter.createUser!
adapter.createUser = async (user) => {
	const baseUsername = user.email?.split('@')[0] || 'user'
	const username = `${baseUsername}-${Math.floor(Math.random() * 10000)}`
	const userCount = await prisma.user.count()
	const role = userCount === 0 ? 'ADMIN' : 'USER'
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return originalCreateUser({ ...user, username, role } as any)
}

export const { handle, signIn, signOut } = SvelteKitAuth({
	adapter,
	session: {
		strategy: "database",
	},
	providers: [
		Google,
		Credentials({
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" }
			},
			async authorize(credentials) {
				const settings = await getSiteSettings()
				if (!settings.localLoginEnabled) return null

				if (!credentials?.email || !credentials?.password) return null
				const identifier = credentials.email as string
				const user = await prisma.user.findFirst({
					where: {
						OR: [
							{ email: identifier },
							{ username: identifier }
						]
					}
				})
				if (!user || !user.passwordHash) return null
				const passwordsMatch = await bcrypt.compare(credentials.password as string, user.passwordHash)
				if (passwordsMatch) return user
				return null
			}
		})
	],
	pages: {
		error: "/login",
	},
	callbacks: {
		async session({ session, user }) {
			// Attach additional user info to the session
			if (session.user && user) {
				session.user.id = user.id;
				// @ts-expect-error - Custom property
				session.user.username = user.username;
				// @ts-expect-error - Custom property
				session.user.cefrLevel = user.cefrLevel;
				// @ts-expect-error - Custom property
				session.user.hasOnboarded = user.hasOnboarded;
				// @ts-expect-error - Custom property
				session.user.role = user.role;
				// @ts-expect-error - Custom property
				session.user.theme = user.theme;
			}
			return session;
		}
	},
	trustHost: true
})
