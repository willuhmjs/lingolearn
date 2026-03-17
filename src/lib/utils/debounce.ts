/**
 * Debounce utility to prevent rapid-fire function calls
 * @param fn - Function to debounce
 * @param ms - Milliseconds to wait before executing (default: 300ms)
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms = 300
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: any, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * One-time execution guard for critical operations
 * Ensures a function can only be called once
 * @param fn - Function to guard
 * @returns Guarded function
 */
export function once<T extends (...args: any[]) => any>(
  fn: T
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let called = false;
  return function (this: any, ...args: Parameters<T>): ReturnType<T> | undefined {
    if (!called) {
      called = true;
      return fn.apply(this, args);
    }
  };
}
