import { RateLimiter } from 'sveltekit-rate-limiter/server';

export const apiRateLimiter = new RateLimiter({
	IP: [1000, 'm'], // 1000 requests per minute per IP
	IPUA: [2000, 'm']
});

export const authRateLimiter = new RateLimiter({
	IP: [5, 'm'], // 5 requests per minute per IP
	IPUA: [10, 'm']
});

// Daily token quota (aiQuota.ts) is now the primary budget guard for AI routes.
// These per-minute/per-hour limits just prevent burst abuse.
export const generateLessonRateLimiter = new RateLimiter({
	IP: [30, 'm'], // 30 requests per minute per IP
	IPUA: [500, 'd'] // 500 requests per day per IP+UA
});

export const submitAnswerRateLimiter = new RateLimiter({
	IP: [500, 'm'],
	IPUA: [10000, 'd']
});

export const llmDictionaryRateLimiter = new RateLimiter({
	IP: [20, 'm'], // 20 per minute per IP
	IPUA: [200, 'h'] // 200 per hour per IP+UA
});

export const chatPracticeRateLimiter = new RateLimiter({
	IP: [30, 'm'], // 30 per minute per IP
	IPUA: [300, 'h'] // 300 per hour per IP+UA
});

export const publishGameRateLimiter = new RateLimiter({
	IP: [5, 'm'],
	IPUA: [20, 'h']
});

export const quizAnswerRateLimiter = new RateLimiter({
	IP: [60, 'm'], // 60 per minute per IP
	IPUA: [600, 'h'] // 600 per hour per IP+UA
});

// Test-out generates 10 questions in one LLM call — keep burst limit but relax daily
export const testOutRateLimiter = new RateLimiter({
	IP: [10, 'm'], // 10 attempts per minute per IP
	IPUA: [100, 'd'] // 100 attempts per day per IP+UA
});
