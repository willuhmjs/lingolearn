/**
 * Haptic feedback utility for mobile devices
 * Uses the Vibration API where available
 */

// Check if vibration API is available
const isVibrateSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

/**
 * Haptic feedback patterns
 */
export const HapticPattern = {
	// Light tap for button presses
	LIGHT: [10],

	// Medium tap for selections
	MEDIUM: [20],

	// Strong tap for important actions
	STRONG: [30],

	// Success pattern (double tap)
	SUCCESS: [15, 50, 15],

	// Error pattern (triple tap)
	ERROR: [10, 30, 10, 30, 10],

	// Warning pattern
	WARNING: [20, 40, 20],

	// Notification pattern
	NOTIFICATION: [10, 20, 10],

	// Selection pattern (short burst)
	SELECTION: [5, 10, 5],
} as const;

/**
 * Trigger haptic feedback
 * @param pattern - The vibration pattern to use
 */
export function haptic(pattern: number | number[]): void {
	if (!isVibrateSupported) return;

	try {
		navigator.vibrate(pattern);
	} catch (error) {
		console.warn('Haptic feedback failed:', error);
	}
}

/**
 * Cancel any ongoing vibration
 */
export function cancelHaptic(): void {
	if (!isVibrateSupported) return;

	try {
		navigator.vibrate(0);
	} catch (error) {
		console.warn('Cancel haptic failed:', error);
	}
}

/**
 * Check if device supports haptic feedback
 */
export function isHapticSupported(): boolean {
	return isVibrateSupported;
}

/**
 * Convenience functions for common patterns
 */
export const haptics = {
	light: () => haptic(HapticPattern.LIGHT),
	medium: () => haptic(HapticPattern.MEDIUM),
	strong: () => haptic(HapticPattern.STRONG),
	success: () => haptic(HapticPattern.SUCCESS),
	error: () => haptic(HapticPattern.ERROR),
	warning: () => haptic(HapticPattern.WARNING),
	notification: () => haptic(HapticPattern.NOTIFICATION),
	selection: () => haptic(HapticPattern.SELECTION),
};
