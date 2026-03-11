import { RateLimiter } from 'sveltekit-rate-limiter/server';

export const apiRateLimiter = new RateLimiter({
	IP: [1000, 'm'], // 1000 requests per minute per IP
	IPUA: [2000, 'm']
});

export const authRateLimiter = new RateLimiter({
	IP: [5, 'm'], // 5 requests per minute per IP
	IPUA: [10, 'm']
});

export const generateLessonRateLimiter = new RateLimiter({
	IP: [10, 'm'], // 10 requests per minute per IP
	IPUA: [200, 'd'] // 200 requests per day per IP
});

export const submitAnswerRateLimiter = new RateLimiter({
	IP: [500, 'm'],
	IPUA: [10000, 'd']
});

export const llmDictionaryRateLimiter = new RateLimiter({
	IP: [5, 'm'],
	IPUA: [20, 'h']
});

export const chatPracticeRateLimiter = new RateLimiter({
	IP: [10, 'm'],
	IPUA: [50, 'h']
});

export const publishGameRateLimiter = new RateLimiter({
	IP: [5, 'm'],
	IPUA: [20, 'h']
});

// Test-out generates 10 questions in one LLM call — stricter limit
export const testOutRateLimiter = new RateLimiter({
	IP: [3, 'm'],   // 3 attempts per minute per IP
	IPUA: [20, 'd'] // 20 attempts per day per IP+UA
});
