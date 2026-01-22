/**
 * DNTT (Đề nghị thanh toán) services
 */

import { dataverseConfig } from '../../config/authConfig';
import { createFetchHeadersWithAnnotations, createFetchHeaders } from './common';
import { DNTTRecord } from './types';

/**
 * Fetch DNTT records for current user (Subject)
 */
export async function fetchDNTTRecords(
    accessToken: string,
    subjectId: string,
    year?: number,
    month?: number
): Promise<DNTTRecord[]> {
    let filter = `statecode eq 0 and (_cr1bb_oituong_value eq ${subjectId} or cr1bb_phongban eq 'Phòng Công nghệ')`;

    if (year !== undefined && month !== undefined) {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        filter += ` and cr1bb_ngaydukienthanhtoan ge ${startStr} and cr1bb_ngaydukienthanhtoan le ${endStr}`;
    }

    const select = "cr44a_enghithanhtoanid,_cr1bb_loaihosothanhtoan_value,cr44a_sotien_de_nghi,cr1bb_diengiai,cr1bb_ngaydukienthanhtoan,cr44a_trangthai_denghi_thanhtoan,cr44a_truongbophan,cr44a_ketoanthanhtoan,cr44a_ketoantonghop,_ownerid_value,createdon,statecode";
    const url = `${dataverseConfig.baseUrl}/cr44a_enghithanhtoans?$filter=${encodeURIComponent(filter)}&$select=${select}&$orderby=cr1bb_ngaydukienthanhtoan desc`;

    try {
        const response = await fetch(url, {
            headers: createFetchHeadersWithAnnotations(accessToken),
        });

        if (!response.ok) {
            console.error("Error fetching DNTT records:", await response.text());
            return [];
        }

        const data = await response.json();
        return (data.value || []).map((item: DNTTRecord & { [key: string]: unknown }) => ({
            ...item,
            cr1bb_loaihosothanhtoan: (item['_cr1bb_loaihosothanhtoan_value@OData.Community.Display.V1.FormattedValue'] as string)
                || (item['cr1bb_loaihosothanhtoan@OData.Community.Display.V1.FormattedValue'] as string)
                || "Unknown",
            cr44a_trangthai_denghithanhtoan: (item['cr44a_trangthai_denghi_thanhtoan@OData.Community.Display.V1.FormattedValue'] as string)
                || (item['cr44a_trangthai_denghi_thanhtoan'] as string)
                || "Unknown",
            cr44a_ketoantonghop: (item['cr44a_ketoantonghop@OData.Community.Display.V1.FormattedValue'] as string)
                || (item['cr44a_ketoantonghop'] as string)
                || "Unknown",
            cr44a_truongbophan: (item['cr44a_truongbophan@OData.Community.Display.V1.FormattedValue'] as string)
                || (item['cr44a_truongbophan'] as string)
                || "Unknown",
            cr44a_truongbophan_value: (() => {
                const raw = item['cr44a_truongbophan'];
                if (typeof raw === 'number') return raw;
                if (typeof raw === 'string') {
                    const n = Number(raw);
                    return Number.isFinite(n) ? n : null;
                }
                return null;
            })(),
            ownerName: (item['_ownerid_value@OData.Community.Display.V1.FormattedValue'] as string) || "Unknown",
        }));
    } catch (e) {
        console.error("Error calling DNTT API:", e);
        return [];
    }
}

/**
 * Update DNTT record approval field
 */
export async function updateDNTTStatus(
    accessToken: string,
    recordId: string,
    fieldName: string,
    value: number | null
): Promise<boolean> {
    const url = `${dataverseConfig.baseUrl}/cr44a_enghithanhtoans(${recordId})`;
    const payload: Record<string, unknown> = {};
    payload[fieldName] = value;

    try {
        const response = await fetch(url, {
            method: "PATCH",
            headers: {
                ...createFetchHeaders(accessToken),
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload)
        });

        if (response.ok || response.status === 204) {
            return true;
        } else {
            const errorText = await response.text();
            console.error("Error updating DNTT status:", response.status, errorText);
            return false;
        }
    } catch (e) {
        console.error("Exception updating DNTT status:", e);
        return false;
    }
}

