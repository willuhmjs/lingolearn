import { RateLimiter } from 'sveltekit-rate-limiter/server';

export const apiRateLimiter = new RateLimiter({
	IP: [100, 'm'], // 100 requests per minute per IP
	IPUA: [200, 'm']
});

export const authRateLimiter = new RateLimiter({
	IP: [5, 'm'], // 5 requests per minute per IP
	IPUA: [10, 'm']
});

export const generateLessonRateLimiter = new RateLimiter({
	IP: [10, 'm'],   // 10 requests per minute per IP
	IPUA: [200, 'd'] // 200 requests per day per IP
});

export const submitAnswerRateLimiter = new RateLimiter({
	IP: [15, 'm'],
	IPUA: [300, 'd']
});
