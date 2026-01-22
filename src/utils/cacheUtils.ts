/**
 * Simple in-memory cache with TTL (Time To Live) support
 */

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

class CacheManager {
    private cache: Map<string, CacheEntry<any>>;
    private defaultTTL: number; // in milliseconds

    constructor(defaultTTL: number = 5 * 60 * 1000) { // Default 5 minutes
        this.cache = new Map();
        this.defaultTTL = defaultTTL;
    }

    /**
     * Get value from cache
     * Returns null if key doesn't exist or has expired
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return entry.value as T;
    }

    /**
     * Set value in cache with optional TTL
     * @param key Cache key
     * @param value Value to cache
     * @param ttl Time to live in milliseconds (optional, uses default if not provided)
     */
    set<T>(key: string, value: T, ttl?: number): void {
        const expiresAt = Date.now() + (ttl ?? this.defaultTTL);
        this.cache.set(key, { value, expiresAt });
    }

    /**
     * Clear specific key or entire cache
     * @param key Optional key to clear. If not provided, clears entire cache
     */
    clear(key?: string): void {
        if (key) {
            this.cache.delete(key);
        } else {
            this.cache.clear();
        }
    }

    /**
     * Check if key exists and is not expired
     */
    has(key: string): boolean {
        return this.get(key) !== null;
    }

    /**
     * Get cache size
     */
    size(): number {
        return this.cache.size;
    }

    /**
     * Clean up expired entries
     */
    cleanup(): void {
        const now = Date.now();
        const keysToDelete: string[] = [];

        this.cache.forEach((entry, key) => {
            if (now > entry.expiresAt) {
                keysToDelete.push(key);
            }
        });

        keysToDelete.forEach(key => this.cache.delete(key));
    }
}

// Export singleton instance
export const cache = new CacheManager();

// Export class for custom instances if needed
export { CacheManager };
