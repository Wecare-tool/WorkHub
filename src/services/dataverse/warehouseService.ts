/**
 * Warehouse services - Inventory, Transactions, etc.
 * Note: This is a large service file. Consider further splitting if it grows.
 */

import { dataverseConfig } from '../../config/authConfig';
import { createFetchHeaders, createFetchHeadersWithAnnotations } from './common';
import { cache } from '../../utils/cacheUtils';
import { measureApiCall, createCacheKey } from '../../utils/performanceUtils';
import {
    TransactionSales,
    TransactionSalesPaginatedResponse,
    TransactionBuy,
    TransactionBuyPaginatedResponse,
    InventoryCheckItem,
    InventoryCheckPaginatedResponse,
    WarehouseLocationOption,
    InventoryProduct,
    InventoryProductsPaginatedResponse,
    InventoryHistoryExtendedRecord,
    InventoryHistorySummary
} from './types';
import { escapeODataString } from './common';

/**
 * Fetch Transaction Sales
 */
export async function fetchTransactionSales(
    accessToken: string,
    page: number = 1,
    pageSize: number = 50,
    searchText?: string
): Promise<TransactionSalesPaginatedResponse> {
    const skip = (page - 1) * pageSize;
    const columns = [
        "crdfd_transactionsalesid",
        "crdfd_maphieuxuat",
        "_crdfd_idchitietonhang_value",
        "crdfd_tensanphamtex",
        "crdfd_soluonggiaotheokho",
        "crdfd_onvitheokho",
        "crdfd_ngaygiaothucte",
        "crdfd_warehouse",
        "crdfd_product",
        "crdfd_unit",
        "crdfd_purchasingemployee",
        "crdfd_urgentpurchasingemployee",
        "crdfd_stockbyuser",
        "crdfd_orderedstock",
        "crdfd_strangestock",
        "crdfd_warehousestrangestock",
        "crdfd_historyconfidence",
        "crdfd_confidencelevel"
    ];

    const select = columns.join(",");
    let filter = "statecode eq 0";

    if (searchText) {
        const escaped = escapeODataString(searchText);
        filter += ` and (contains(crdfd_tensanphamtex, '${escaped}') or contains(crdfd_maphieuxuat, '${escaped}'))`;
    }

    const query = `$filter=${encodeURIComponent(filter)}&$select=${select}&$top=${pageSize}&$count=true&$orderby=createdon desc`;
    const url = `${dataverseConfig.baseUrl}/crdfd_transactionsales?${query}`;

    try {
        const response = await fetch(url, {
            headers: createFetchHeadersWithAnnotations(accessToken),
        });

        if (!response.ok) {
            console.error("Error fetching Transaction Sales:", await response.text());
            return { data: [], totalCount: 0, hasNextPage: false, hasPreviousPage: false };
        }

        const data = await response.json();
        const items = data.value || [];
        const totalCount = data['@odata.count'] || 0;

        const mappedItems: TransactionSales[] = items.map((item: TransactionSales & { [key: string]: unknown }) => ({
            ...item,
            crdfd_idchitietonhang_name: (item['_crdfd_idchitietonhang_value@OData.Community.Display.V1.FormattedValue'] as string),
        }));

        return {
            data: mappedItems,
            totalCount: totalCount,
            hasNextPage: (skip + pageSize) < totalCount,
            hasPreviousPage: page > 1
        };
    } catch (e) {
        console.error("Exception fetching Transaction Sales:", e);
        return { data: [], totalCount: 0, hasNextPage: false, hasPreviousPage: false };
    }
}

/**
 * Fetch Transaction Buys
 */
export async function fetchTransactionBuys(
    accessToken: string,
    page: number = 1,
    pageSize: number = 50,
    searchText?: string
): Promise<TransactionBuyPaginatedResponse> {
    const skip = (page - 1) * pageSize;
    const columns = [
        "crdfd_transactionbuyid",
        "crdfd_name",
        "crdfd_masp",
        "crdfd_tensanpham",
        "crdfd_soluong",
        "createdon"
    ];

    const select = columns.join(",");
    let filter = "statecode eq 0";

    if (searchText) {
        const escaped = escapeODataString(searchText);
        filter += ` and (contains(crdfd_tensanpham, '${escaped}') or contains(crdfd_masp, '${escaped}'))`;
    }

    const query = `$filter=${encodeURIComponent(filter)}&$select=${select}&$top=${pageSize}&$count=true&$orderby=createdon desc`;
    const url = `${dataverseConfig.baseUrl}/crdfd_transactionbuys?${query}`;

    try {
        const response = await fetch(url, {
            headers: createFetchHeadersWithAnnotations(accessToken),
        });

        if (!response.ok) {
            console.error("Error fetching Transaction Buys:", await response.text());
            return { data: [], totalCount: 0, hasNextPage: false, hasPreviousPage: false };
        }

        const data = await response.json();
        const items = data.value || [];
        const totalCount = data['@odata.count'] || 0;

        const mappedItems: TransactionBuy[] = items.map((item: TransactionBuy) => ({
            ...item,
        }));

        return {
            data: mappedItems,
            totalCount: totalCount,
            hasNextPage: (skip + pageSize) < totalCount,
            hasPreviousPage: page > 1
        };
    } catch (e) {
        console.error("Exception fetching Transaction Buys:", e);
        return { data: [], totalCount: 0, hasNextPage: false, hasPreviousPage: false };
    }
}

/**
 * Fetch warehouse locations for filter dropdown
 */
export async function fetchWarehouseLocationsForFilter(
    accessToken: string
): Promise<WarehouseLocationOption[]> {
    const cacheKey = 'warehouse_locations';
    const cached = cache.get<WarehouseLocationOption[]>(cacheKey);

    if (cached) {
        return cached;
    }

    // OPTIMIZED: Reduced from 2000 to 1000 for better performance
    const url = `${dataverseConfig.baseUrl}/crdfd_kho_binh_dinhs?$select=_crdfd_vitrikho_value&$top=1000&$filter=statecode eq 0`;

    try {
        const locations = await measureApiCall('fetchWarehouseLocations', async () => {
            const response = await fetch(url, {
                headers: createFetchHeadersWithAnnotations(accessToken),
            });

            if (!response.ok) {
                console.error("Error fetching warehouse locations:", await response.text());
                return [];
            }

            const data = await response.json();
            const items = data.value || [];
            const locationMap = new Map<string, string>();

            items.forEach((item: { _crdfd_vitrikho_value?: string; [key: string]: unknown }) => {
                const id = item._crdfd_vitrikho_value;
                const name = (item['_crdfd_vitrikho_value@OData.Community.Display.V1.FormattedValue'] as string);

                if (id && name) {
                    locationMap.set(id, name);
                }
            });

            return Array.from(locationMap.entries()).map(([id, name]) => ({ id, name }));
        });

        cache.set(cacheKey, locations, 10 * 60 * 1000);
        return locations;
    } catch (e) {
        console.error("Exception fetching warehouse locations:", e);
        return [];
    }
}

/**
 * Fetch warehouse locations (alias for backward compatibility)
 */
export async function fetchWarehouseLocations(
    accessToken: string
): Promise<WarehouseLocationOption[]> {
    return fetchWarehouseLocationsForFilter(accessToken);
}

/**
 * Fetch Inventory Check data
 * OPTIMIZED: Reduced $top from 2000 to 500
 */
export async function fetchInventoryCheck(
    accessToken: string,
    _page: number = 1,
    _pageSize: number = 50,
    searchText?: string,
    warehouseLocationIds?: string[],
    stockFilter: 'all' | 'negative' | 'nonzero' = 'all'
): Promise<InventoryCheckPaginatedResponse> {
    const select = [
        "crdfd_kho_binh_dinhid",
        "_crdfd_vitrikho_value",
        "_crdfd_tensanphamlookup_value",
        "crdfd_tensptext",
        "crdfd_masp",
        "crdfd_onvi",
        "crdfd_tonkhothucte",
        "crdfd_tonkholythuyet",
        "cr1bb_tonkhadung",
        "cr1bb_slhangloisaukiem",
        "crdfd_ton_kho_theo_ke_hoach"
    ].join(",");

    let filter = "statecode eq 0";

    if (warehouseLocationIds && warehouseLocationIds.length > 0) {
        const locationFilters = warehouseLocationIds.map((id: string) => `_crdfd_vitrikho_value eq ${id}`);
        filter += ` and (${locationFilters.join(" or ")})`;
    }

    if (searchText) {
        const escapedSearch = escapeODataString(searchText);
        filter += ` and (contains(crdfd_masp, '${escapedSearch}') or contains(crdfd_tensptext, '${escapedSearch}'))`;
    }

    if (stockFilter === 'negative') {
        filter += ` and crdfd_tonkhothucte lt 0`;
    } else if (stockFilter === 'nonzero') {
        filter += ` and crdfd_tonkhothucte ne 0`;
    }

    // OPTIMIZED: Reduced from 2000 to 500
    const query = `$filter=${encodeURIComponent(filter)}&$select=${select}&$top=500&$count=true&$orderby=crdfd_masp asc`;
    const url = `${dataverseConfig.baseUrl}/crdfd_kho_binh_dinhs?${query}`;

    try {
        return await measureApiCall('fetchInventoryCheck', async () => {
            const response = await fetch(url, {
                headers: createFetchHeadersWithAnnotations(accessToken),
            });

            if (!response.ok) {
                console.error("Error fetching inventory check:", await response.text());
                return { data: [], totalCount: 0, hasNextPage: false, hasPreviousPage: false };
            }

            const data = await response.json();
            const items = data.value || [];
            const totalCount = data['@odata.count'] || items.length;

            const mappedItems: InventoryCheckItem[] = items.map((item: InventoryCheckItem & { [key: string]: unknown }) => {
                const tonKhoThucTe = (item.crdfd_tonkhothucte as number) || 0;
                const hangLoiSauKiem = (item.cr1bb_slhangloisaukiem as number) || 0;

                const productName = (item['_crdfd_tensanphamlookup_value@OData.Community.Display.V1.FormattedValue'] as string)
                    || (item.crdfd_tensptext as string)
                    || (item.crdfd_masp as string)
                    || "Unknown";

                return {
                    crdfd_kho_binh_dinhid: item.crdfd_kho_binh_dinhid as string,
                    productName: productName,
                    productCode: (item.crdfd_masp as string) || "",
                    productId: (item._crdfd_tensanphamlookup_value as string) || "",
                    warehouseLocation: (item['_crdfd_vitrikho_value@OData.Community.Display.V1.FormattedValue'] as string) || "Unknown",
                    tonKhoThucTe: tonKhoThucTe,
                    tonKhoLyThuyet: (item.crdfd_tonkholythuyet as number) || 0,
                    tonKhaDung: (item.cr1bb_tonkhadung as number) || 0,
                    hangLoiSauKiem: hangLoiSauKiem,
                    tongTonKho: tonKhoThucTe + hangLoiSauKiem
                };
            });

            return {
                data: mappedItems,
                totalCount: totalCount,
                hasNextPage: false,
                hasPreviousPage: false
            };
        });
    } catch (e) {
        console.error("Exception fetching inventory check:", e);
        return { data: [], totalCount: 0, hasNextPage: false, hasPreviousPage: false };
    }
}

/**
 * Fetch Inventory Products
 * OPTIMIZED: Reduced $top from 2000 to 100 for better performance
 */
export async function fetchInventoryProducts(
    accessToken: string,
    _page: number = 1,
    _pageSize: number = 50,
    searchText?: string,
    warehouseLocationIds?: string[],
    stockFilter: 'all' | 'negative' | 'nonzero' = 'all'
): Promise<InventoryProductsPaginatedResponse> {
    const select = [
        "crdfd_kho_binh_dinhid",
        "_crdfd_vitrikho_value",
        "_crdfd_tensanphamlookup_value",
        "crdfd_tensptext",
        "crdfd_masp",
        "crdfd_onvi",
        "crdfd_tonkhothucte",
        "crdfd_tonkholythuyet",
        "crdfd_ton_kho_theo_ke_hoach"
    ].join(",");

    let filter = "statecode eq 0";

    if (warehouseLocationIds && warehouseLocationIds.length > 0) {
        const locationFilters = warehouseLocationIds.map((id: string) => `_crdfd_vitrikho_value eq ${id}`);
        filter += ` and (${locationFilters.join(" or ")})`;
    }

    if (stockFilter === 'negative') {
        filter += ` and crdfd_tonkhothucte lt 0`;
    } else if (stockFilter === 'nonzero') {
        filter += ` and crdfd_tonkhothucte ne 0`;
    }

    if (searchText) {
        const escapedSearch = escapeODataString(searchText);
        filter += ` and (contains(crdfd_masp, '${escapedSearch}') or contains(crdfd_tensptext, '${escapedSearch}'))`;
    }

    // OPTIMIZED: Reduced from 2000 to 100
    const query = `$filter=${encodeURIComponent(filter)}&$select=${select}&$top=100&$count=true&$orderby=crdfd_masp asc`;
    const url = `${dataverseConfig.baseUrl}/crdfd_kho_binh_dinhs?${query}`;

    try {
        const response = await fetch(url, {
            headers: createFetchHeadersWithAnnotations(accessToken),
        });

        if (!response.ok) {
            console.error("Error fetching inventory products:", await response.text());
            return { data: [], totalCount: 0, hasNextPage: false, hasPreviousPage: false };
        }

        const data = await response.json();
        const items = data.value || [];
        const totalCount = data['@odata.count'] || items.length;

        const mappedItems: InventoryProduct[] = items.map((item: InventoryProduct & { [key: string]: unknown }) => ({
            crdfd_kho_binh_dinhid: item.crdfd_kho_binh_dinhid as string,
            productName: (item['_crdfd_tensanphamlookup_value@OData.Community.Display.V1.FormattedValue'] as string) 
                || (item.crdfd_tensptext as string) 
                || (item.crdfd_masp as string) 
                || "Unknown",
            productCode: (item.crdfd_masp as string) || "",
            crdfd_masp: item.crdfd_masp as string,
            crdfd_onvi: item.crdfd_onvi as string,
            locationName: (item['_crdfd_vitrikho_value@OData.Community.Display.V1.FormattedValue'] as string) || "Unknown",
            warehouseLocation: (item['_crdfd_vitrikho_value@OData.Community.Display.V1.FormattedValue'] as string) || "Unknown",
            currentStock: (item.crdfd_tonkhothucte as number) || 0,
            crdfd_tonkhothucte: (item.crdfd_tonkhothucte as number) || 0,
            crdfd_tonkholythuyet: (item.crdfd_tonkholythuyet as number) || 0,
            crdfd_ton_kho_theo_ke_hoach: (item.crdfd_ton_kho_theo_ke_hoach as number) || 0
        }));

        return {
            data: mappedItems,
            totalCount: totalCount,
            hasNextPage: false,
            hasPreviousPage: false
        };
    } catch (e) {
        console.error("Exception fetching inventory products:", e);
        return { data: [], totalCount: 0, hasNextPage: false, hasPreviousPage: false };
    }
}

/**
 * Fetch Inventory History Aggregation
 */
export async function fetchInventoryHistory(
    accessToken: string,
    productCode: string,
    productId: string
): Promise<{ records: InventoryHistoryExtendedRecord[], summary: InventoryHistorySummary }> {
    const cacheKey = createCacheKey('inventory_history', productCode, productId);
    const cached = cache.get<{ records: InventoryHistoryExtendedRecord[], summary: InventoryHistorySummary }>(cacheKey);

    if (cached) {
        return cached;
    }

    return await measureApiCall(`fetchInventoryHistory:${productCode}`, async () => {
        const [sales, buys, specialEvents] = await Promise.all([
            fetchProductSalesTransactions(accessToken, productCode),
            fetchProductBuyTransactions(accessToken, productCode),
            fetchProductSpecialEvents(accessToken, productId)
        ]);

        let totalImport = 0;
        let totalExport = 0;
        let totalReturnSale = 0;
        let totalReturnBuy = 0;
        let totalBalance = 0;

        const records: InventoryHistoryExtendedRecord[] = [];

        sales.forEach(s => {
            const qtyExport = s.crdfd_soluonggiaotheokho || 0;
            const qtyReturn = s.crdfd_soluongoitratheokhonew || 0;
            totalExport += qtyExport;
            totalReturnSale += qtyReturn;
            records.push({
                id: s.crdfd_transactionsalesid,
                type: 'Xuất',
                date: s.createdon || '',
                quantity: -qtyExport,
                quantityReturn: qtyReturn,
                reference: s.crdfd_maphieuxuat || ''
            });
        });

        buys.forEach(b => {
            const qtyImport = b.crdfd_soluonganhantheokho || 0;
            const qtyReturn = b.crdfd_soluongoitratheokhonew || 0;
            totalImport += qtyImport;
            totalReturnBuy += qtyReturn;
            records.push({
                id: b.crdfd_transactionbuyid,
                type: 'Nhập',
                date: b.createdon || '',
                quantity: qtyImport,
                quantityReturn: qtyReturn,
                reference: b.crdfd_name || '',
            });
        });

        specialEvents.forEach(e => {
            const qty = e.quantity || 0;
            totalBalance += qty;
            records.push({
                id: e.id,
                type: 'Cân kho',
                date: e.date || '',
                quantity: qty,
                reference: e.reference || '',
                note: e.note
            });
        });

        const currentStock = (totalImport - totalReturnBuy) - (totalExport - totalReturnSale) + totalBalance;
        records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const result = {
            records,
            summary: {
                totalImport,
                totalExport,
                totalReturnSale,
                totalReturnBuy,
                totalBalance,
                currentStock
            }
        };

        cache.set(cacheKey, result, 5 * 60 * 1000);
        return result;
    });
}

// Helper functions
async function fetchProductSalesTransactions(token: string, productCode: string): Promise<TransactionSales[]> {
    const filter = `statecode eq 0 and crdfd_masanpham eq '${productCode}'`;
    const select = "crdfd_transactionsalesid,crdfd_maphieuxuat,crdfd_soluonggiaotheokho,crdfd_soluongoitratheokhonew,createdon";
    const url = `${dataverseConfig.baseUrl}/crdfd_transactionsaleses?$filter=${encodeURIComponent(filter)}&$select=${select}&$orderby=createdon desc`;

    try {
        const res = await fetch(url, { headers: createFetchHeaders(token) });
        if (!res.ok) {
            console.error(`Error fetching Sale history. Status: ${res.status}`, await res.text());
            return [];
        }
        const data = await res.json();
        return data.value || [];
    } catch (e) {
        console.error("Exception fetching sales history", e);
        return [];
    }
}

async function fetchProductBuyTransactions(token: string, productCode: string): Promise<TransactionBuy[]> {
    const filter = `statecode eq 0 and crdfd_masanpham eq '${productCode}'`;
    const select = "crdfd_transactionbuyid,crdfd_name,crdfd_soluonganhantheokho,crdfd_soluongoitratheokhonew,createdon";
    const url = `${dataverseConfig.baseUrl}/crdfd_transactionbuies?$filter=${encodeURIComponent(filter)}&$select=${select}&$orderby=createdon desc`;

    try {
        const res = await fetch(url, { headers: createFetchHeaders(token) });
        if (!res.ok) {
            console.error(`Error fetching Buy history. Status: ${res.status}`, await res.text());
            return [];
        }
        const data = await res.json();
        return data.value || [];
    } catch (e) {
        console.error("Exception fetching buy history", e);
        return [];
    }
}

async function fetchProductSpecialEvents(accessToken: string, productId: string): Promise<InventoryHistoryExtendedRecord[]> {
    if (!productId) return [];

    const filter = `_crdfd_sanphamcankho_value eq ${productId} and crdfd_loaionhang eq 191920002 and statecode eq 0`;
    const select = "crdfd_specialeventid,crdfd_soluong,createdon,crdfd_name,_cr1bb_vitrikho_value,_cr1bb_makiemkho_value";
    const url = `${dataverseConfig.baseUrl}/crdfd_specialevents?$filter=${encodeURIComponent(filter)}&$select=${select}&$orderby=createdon desc`;

    try {
        const response = await fetch(url, {
            headers: createFetchHeadersWithAnnotations(accessToken)
        });
        if (!response.ok) return [];
        const data = await response.json();
        return (data.value || []).map((item: { [key: string]: unknown }) => {
            const auditCode = (item['_cr1bb_makiemkho_value@OData.Community.Display.V1.FormattedValue'] as string);
            return {
                id: item.crdfd_specialeventid as string,
                type: 'Cân kho',
                date: item.createdon as string,
                quantity: (item.crdfd_soluong as number) || 0,
                reference: item.crdfd_name as string,
                note: auditCode ? `Cân kho: ${auditCode}` : 'Điều chỉnh cân kho'
            };
        });
    } catch (e) {
        console.error("Error fetching special events", e);
        return [];
    }
}

