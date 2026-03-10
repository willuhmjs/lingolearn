// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: {
				id: string;
				username: string;
				cefrLevel: string;
				hasOnboarded: boolean;
				role: string;
				theme: string;
				totalXp: number;
				currentStreak: number;
				useLocalLlm?: boolean;
				llmBaseUrl?: string | null;
				llmApiKey?: string | null;
				activeLanguage: {
					id: string;
					code: string;
					name: string;
					flag: string | null;
				} | null;
			} | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
