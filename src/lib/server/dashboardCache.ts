import { cache } from './cache';

const DASHBOARD_TTL = 600; // 10 minutes

export interface DashboardAnalytics {
	urgentItems: Array<{
		vocabularyId: string;
		retrievabilityPct: number;
		lapses: number;
		lemma: string;
		meaning: string | null;
	}>;
	errorTypeCounts: Record<string, number>;
	totalOverrides: number;
	grammarCoverage: {
		total: number;
		interacted: number;
		mastered: number;
		locked: number;
		available: number;
	};
	sessionEma: number;
	adaptiveCap: number;
	banditArmMeans: Array<{ interleaveCount: number; mean: number; observations: number }>;
	bestBanditArm: { interleaveCount: number; mean: number; observations: number };
	highVarianceVocab: Array<{ lemma: string; level: string; elo: number; sigma: number }>;
	pfaAtRisk: Array<{ title: string; level: string; pCorrect: number | null }>;
	coOccurrencePairs: Array<{ from: string; to: string; strength: string }>;
	hasPersonalizedWeights: boolean;
	fsrsRetention: number;
}

function cacheKey(userId: string, languageId: string): string {
	return `dashboard_analytics:${userId}:${languageId}`;
}

export function getCachedDashboardAnalytics(
	userId: string,
	languageId: string
): DashboardAnalytics | null {
	return cache.get<DashboardAnalytics>(cacheKey(userId, languageId));
}

export function setCachedDashboardAnalytics(
	userId: string,
	languageId: string,
	data: DashboardAnalytics
): void {
	cache.set(cacheKey(userId, languageId), data, DASHBOARD_TTL);
}
