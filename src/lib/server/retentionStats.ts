import { prisma } from './prisma';

export interface RetentionBucket {
	label: string;
	count: number;
}

export interface RetentionStats {
	totalReviewed: number;
	avgRetentionPct: number | null;
	avgStabilityDays: number | null;
	totalLapses: number;
	retentionBuckets: RetentionBucket[];
	stabilityBuckets: RetentionBucket[];
	upcomingReviews: { in1Day: number; in7Days: number; in30Days: number };
	forgettingCurve: { days: number; retentionPct: number }[];
}

/**
 * Compute vocabulary retention analytics from FSRS progress records for a user.
 * Shared by the dashboard page load and the /api/user/retention-stats endpoint.
 */
export async function loadRetentionStats(userId: string): Promise<RetentionStats> {
	const progressRecords = await prisma.userVocabularyProgress.findMany({
		where: { userId },
		select: {
			stability: true,
			retrievability: true,
			repetitions: true,
			lapses: true,
			nextReviewDate: true,
			lastReviewDate: true
		}
	});

	const reviewed = progressRecords.filter(r => r.repetitions > 0);

	if (reviewed.length === 0) {
		return {
			totalReviewed: 0,
			avgRetentionPct: null,
			avgStabilityDays: null,
			totalLapses: 0,
			retentionBuckets: [],
			stabilityBuckets: [],
			upcomingReviews: { in1Day: 0, in7Days: 0, in30Days: 0 },
			forgettingCurve: []
		};
	}

	const now = new Date();

	// Re-compute current retrievability using elapsed time since last review.
	// The stored value was set at review time and has since decayed.
	// Formula: R(t) = (1 + t / (9 * S))^-1  (FSRS-4.5)
	const currentRetrievabilities = reviewed.map(r => {
		if (r.stability <= 0) return 1;
		const elapsedDays = r.lastReviewDate
			? (now.getTime() - r.lastReviewDate.getTime()) / (1000 * 60 * 60 * 24)
			: 0;
		return Math.max(0, Math.min(1, Math.pow(1 + elapsedDays / (9 * r.stability), -1)));
	});

	const avgRetentionPct = Math.round(
		(currentRetrievabilities.reduce((a, b) => a + b, 0) / reviewed.length) * 100
	);

	const avgStabilityDays = Math.round(
		reviewed.reduce((a, r) => a + r.stability, 0) / reviewed.length
	);

	const totalLapses = reviewed.reduce((a, r) => a + r.lapses, 0);

	// Retention distribution
	const retentionBucketDefs = [
		{ label: '0–25%',   min: 0,    max: 0.25 },
		{ label: '25–50%',  min: 0.25, max: 0.50 },
		{ label: '50–75%',  min: 0.50, max: 0.75 },
		{ label: '75–90%',  min: 0.75, max: 0.90 },
		{ label: '90–100%', min: 0.90, max: 1.01 }
	];
	const retentionBuckets: RetentionBucket[] = retentionBucketDefs.map(b => ({ label: b.label, count: 0 }));
	for (const r of currentRetrievabilities) {
		const idx = retentionBucketDefs.findIndex(b => r >= b.min && r < b.max);
		if (idx !== -1) retentionBuckets[idx].count++;
	}

	// Stability distribution
	const stabilityBucketDefs = [
		{ label: '<1 day',   min: 0,  max: 1   },
		{ label: '1–7 days', min: 1,  max: 7   },
		{ label: '1–3 wks',  min: 7,  max: 21  },
		{ label: '3–8 wks',  min: 21, max: 60  },
		{ label: '2+ mo',    min: 60, max: Infinity }
	];
	const stabilityBuckets: RetentionBucket[] = stabilityBucketDefs.map(b => ({ label: b.label, count: 0 }));
	for (const r of reviewed) {
		const idx = stabilityBucketDefs.findIndex(b => r.stability >= b.min && r.stability < b.max);
		if (idx !== -1) stabilityBuckets[idx].count++;
	}

	// Upcoming review forecast
	const in1Day   = new Date(now.getTime() + 1  * 24 * 60 * 60 * 1000);
	const in7Days  = new Date(now.getTime() + 7  * 24 * 60 * 60 * 1000);
	const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
	const upcomingReviews = {
		in1Day:   reviewed.filter(r => r.nextReviewDate <= in1Day).length,
		in7Days:  reviewed.filter(r => r.nextReviewDate <= in7Days).length,
		in30Days: reviewed.filter(r => r.nextReviewDate <= in30Days).length
	};

	// Forgetting curve for the median-stability item
	const sortedStabilities = reviewed.map(r => r.stability).sort((a, b) => a - b);
	const medianStability = sortedStabilities[Math.floor(sortedStabilities.length / 2)];
	const forgettingCurve = [1, 3, 7, 14, 30].map(days => ({
		days,
		retentionPct: medianStability > 0
			? Math.round(Math.pow(1 + days / (9 * medianStability), -1) * 100)
			: 0
	}));

	return {
		totalReviewed: reviewed.length,
		avgRetentionPct,
		avgStabilityDays,
		totalLapses,
		retentionBuckets,
		stabilityBuckets,
		upcomingReviews,
		forgettingCurve
	};
}
