/**
 * Common utilities for Dataverse API calls
 */

/**
 * Create standard fetch headers for Dataverse API calls
 */
export function createFetchHeaders(accessToken: string): HeadersInit {
    return {
        "Authorization": `Bearer ${accessToken}`,
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        "Accept": "application/json",
    };
}

/**
 * Create fetch headers with formatted value annotations
 */
export function createFetchHeadersWithAnnotations(accessToken: string): HeadersInit {
    return {
        ...createFetchHeaders(accessToken),
        "Prefer": "odata.include-annotations=\"*\""
    };
}

/**
 * Handle API error responses
 */
export async function handleApiError(response: Response, context: string): Promise<never> {
    const errorText = await response.text();
    console.error(`Error in ${context}:`, response.status, errorText);
    throw new Error(`Dataverse API Error (${response.status}) in ${context}: ${errorText}`);
}

/**
 * Common fetch wrapper with error handling
 */
export async function fetchDataverse<T>(
    url: string,
    accessToken: string,
    options: RequestInit = {}
): Promise<T> {
    const headers = createFetchHeaders(accessToken);
    
    const response = await fetch(url, {
        ...options,
        headers: {
            ...headers,
            ...options.headers,
        },
    });

    if (!response.ok) {
        await handleApiError(response, 'fetchDataverse');
    }

    return response.json();
}

/**
 * Format date for OData queries (YYYY-MM-DD)
 */
export function formatDateForOData(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Build OData filter string safely
 */
export function buildODataFilter(baseFilter: string, additionalFilters?: string[]): string {
    if (!additionalFilters || additionalFilters.length === 0) {
        return baseFilter;
    }
    return `${baseFilter} and ${additionalFilters.join(' and ')}`;
}

/**
 * Escape single quotes for OData queries
 */
export function escapeODataString(str: string): string {
    return str.replace(/'/g, "''");
}

