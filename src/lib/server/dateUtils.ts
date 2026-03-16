/** Returns the UTC midnight Date for the current day. */
export function todayUtc(): Date {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
