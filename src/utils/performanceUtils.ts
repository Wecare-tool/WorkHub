/**
 * Performance monitoring and optimization utilities
 */

/**
 * Measure execution time of an async function
 * Logs the result to console in development mode
 */
export async function measureApiCall<T>(
    name: string,
    fn: () => Promise<T>
): Promise<T> {
    const startTime = performance.now();

    try {
        const result = await fn();
        const endTime = performance.now();
        const duration = endTime - startTime;

        if (import.meta.env.DEV) {
            console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
        }

        return result;
    } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        if (import.meta.env.DEV) {
            console.error(`[Performance] ${name} failed after ${duration.toFixed(2)}ms`, error);
        }

        throw error;
    }
}

/**
 * Debounce function - delays execution until after wait time has elapsed
 * since the last time it was invoked
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function (this: any, ...args: Parameters<T>) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            fn.apply(this, args);
        }, delay);
    };
}

/**
 * Throttle function - ensures function is called at most once per specified time period
 */
export function throttle<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let lastCall = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function (this: any, ...args: Parameters<T>) {
        const now = Date.now();

        if (now - lastCall >= delay) {
            lastCall = now;
            fn.apply(this, args);
        } else {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                fn.apply(this, args);
            }, delay - (now - lastCall));
        }
    };
}

/**
 * Create a cache key from multiple parameters
 */
export function createCacheKey(...parts: (string | number | boolean | undefined)[]): string {
    return parts
        .filter(part => part !== undefined && part !== null)
        .map(part => String(part))
        .join('::');
}

/**
 * Batch multiple async operations with a delay between each
 * Useful for rate-limited APIs
 */
export async function batchWithDelay<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    delayMs: number = 100
): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i++) {
        const result = await fn(items[i]);
        results.push(result);

        // Don't delay after the last item
        if (i < items.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    return results;
}
