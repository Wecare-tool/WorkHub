/**
 * Timekeeping (Chấm công) services
 */

import { dataverseConfig } from '../../config/authConfig';
import { DayRecord } from '../../types/types';
import { getStandardHours, formatDate } from '../../utils/workUtils';
import { createFetchHeaders } from './common';
import { DataverseChamCong, PhieuDangKy, ApprovalStatus, RegistrationType } from './types';
import { fetchPhieuDangKyForMonth } from './registrationService';

/**
 * Fetch timekeeping data from Dataverse
 */
async function fetchTimekeepingData(
    accessToken: string,
    startStr: string,
    startStrNext: string,
    employeeId?: string | null
): Promise<DataverseChamCong[]> {
    let filter = `statecode eq 0 and crdfd_ngay ge ${startStr} and crdfd_ngay lt ${startStrNext}`;
    if (employeeId) {
        filter += ` and _crdfd_tennhanvien_value eq ${employeeId}`;
    }
    const entitySetName = "crdfd_bangchamconghangngaies";
    const url = `${dataverseConfig.baseUrl}/${entitySetName}?$filter=${encodeURIComponent(filter)}`;

    const res = await fetch(url, {
        headers: createFetchHeaders(accessToken),
    });
    
    if (!res.ok) throw new Error("Failed to fetch timekeeping");
    const json = await res.json();
    return json.value as DataverseChamCong[];
}

/**
 * Transform Dataverse data to DayRecord[]
 */
function transformToRecords(dataverseData: DataverseChamCong[]): DayRecord[] {
    return dataverseData.map(item => {
        const hoursWorked = item.crdfd_sogiolam || 0;
        const datePart = item.crdfd_ngay.split('T')[0];
        const [y, m, d] = datePart.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const dayOfWeek = dateObj.getDay();
        const standardHours = getStandardHours(dayOfWeek);

        let status: DayRecord['status'] = 'normal';
        const trangthai = (item.crdfd_trangthai || "").toLowerCase();
        const ghichu = (item.crdfd_ghichu || "").toLowerCase();

        const isHoliday = trangthai.includes('lễ') || trangthai.includes('holiday') ||
            ghichu.includes('lễ') || ghichu.includes('holiday') ||
            ghichu.includes('cty nghỉ') || ghichu.includes('công ty nghỉ') ||
            ghichu.includes('tết') || trangthai.includes('tết');

        if (trangthai.includes('phép') || trangthai.includes('phep') || trangthai.includes('leave')) {
            status = 'leave';
        } else if (trangthai.includes('trễ') || trangthai.includes('tre') || trangthai.includes('late')) {
            status = 'late';
        } else if (trangthai.includes('nghỉ') || trangthai.includes('nghi') || trangthai.includes('off')) {
            status = 'off';
        } else if (isHoliday) {
            status = 'holiday';
        }

        const isWorkday = dayOfWeek !== 0;
        const hasLeaveStatus = status === 'leave' || status === 'off' || status === 'holiday';

        if (isWorkday && !hasLeaveStatus && status === 'normal') {
            const checkIn = item.crdfd_checkin;
            const checkOut = item.crdfd_checkout;

            const parseTimeToMinutes = (timeStr?: string): number | null => {
                if (!timeStr) return null;
                if (timeStr === '00:00:00' || timeStr === '--:--' || timeStr === '--:--:--') return null;

                if (timeStr.includes('T') || timeStr.includes('-')) {
                    try {
                        const d = new Date(timeStr);
                        if (!isNaN(d.getTime())) {
                            return d.getHours() * 60 + d.getMinutes();
                        }
                    } catch { }
                }

                const timeParts = timeStr.split(':');
                if (timeParts.length >= 2) {
                    const h = parseInt(timeParts[0]);
                    const m = parseInt(timeParts[1]);
                    if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
                }
                return null;
            };

            const checkInMinutes = parseTimeToMinutes(checkIn);
            const checkOutMinutes = parseTimeToMinutes(checkOut);

            if (checkInMinutes === null || checkOutMinutes === null) {
                status = 'warning';
            }
        }

        let calculatedWorkValue = 0;
        if (hoursWorked >= standardHours && standardHours > 0) {
            calculatedWorkValue = (dayOfWeek === 6) ? 0.5 : 1.0;
        } else if (standardHours > 0) {
            const ratio = hoursWorked / standardHours;
            const maxVal = (dayOfWeek === 6) ? 0.5 : 1.0;
            calculatedWorkValue = parseFloat((ratio * maxVal).toFixed(2));
        }

        return {
            date: datePart,
            hoursWorked,
            status,
            workValue: calculatedWorkValue,
            sogiolam: hoursWorked,
            recordId: item.crdfd_bangchamconghangngayid,
            note: item.crdfd_ghichu || undefined,
            checkIn: item.crdfd_checkin,
            checkOut: item.crdfd_checkout,
            registration: item.registration,
        };
    });
}

/**
 * Merge timekeeping and registration data
 */
function mergeTimekeepingAndRegistration(
    timekeeping: DataverseChamCong[],
    registrations: PhieuDangKy[],
    year: number,
    month: number
): DayRecord[] {
    const recordsMap = new Map<string, DayRecord>();
    const timekeepingRecords = transformToRecords(timekeeping);
    timekeepingRecords.forEach(r => recordsMap.set(r.date, r));

    const processRegistration = (reg: PhieuDangKy) => {
        if (reg.crdfd_captrenduyet !== ApprovalStatus.DaDuyet) {
            return;
        }

        const start = new Date(reg.crdfd_tungay);
        const end = new Date(reg.crdfd_enngay);

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            if (d.getMonth() !== month || d.getFullYear() !== year) continue;

            const dateStr = d.toISOString().split('T')[0];
            const existing = recordsMap.get(dateStr);

            const registrationInfo = {
                id: reg.crdfd_phieuangkyid,
                type: reg.crdfd_loaiangky,
                typeName: getRegistrationTypeName(reg.crdfd_loaiangky),
                hours: reg.crdfd_sogio2 || 0,
                status: getApprovalStatusText(reg.crdfd_captrenduyet)
            };

            if (!existing || existing.hoursWorked === 0) {
                const { status, hours, workVal } = mapRegistrationToStatus(reg.crdfd_loaiangky, reg.crdfd_sogio2);
                recordsMap.set(dateStr, {
                    date: dateStr,
                    hoursWorked: hours,
                    status: status,
                    workValue: workVal,
                    note: `DK: ${reg.crdfd_diengiai || ''}`,
                    registration: registrationInfo
                });
            } else {
                existing.registration = registrationInfo;
                if (reg.crdfd_diengiai) {
                    existing.note = existing.note
                        ? `${existing.note} | DK: ${reg.crdfd_diengiai}`
                        : `DK: ${reg.crdfd_diengiai}`;
                }
            }
        }
    };

    registrations.forEach(processRegistration);
    return Array.from(recordsMap.values());
}

function getRegistrationTypeName(type: number): string {
    switch (type) {
        case RegistrationType.NghiPhep: return "Nghỉ phép";
        case RegistrationType.LamViecTaiNha: return "Làm việc tại nhà (WFH)";
        case RegistrationType.TangCa: return "Tăng ca";
        case RegistrationType.CongTac: return "Công tác";
        case RegistrationType.DiTreVeSom: return "Đi trễ / Về sớm";
        case RegistrationType.NghiKhongLuong: return "Nghỉ không lương";
        default: return "Khác";
    }
}

export function getApprovalStatusText(status?: number): string {
    switch (status) {
        case ApprovalStatus.ChuaDuyet: return "Chưa duyệt";
        case ApprovalStatus.DaDuyet: return "Đã duyệt";
        case ApprovalStatus.TuChoi: return "Từ chối";
        default: return "Chưa duyệt";
    }
}

function mapRegistrationToStatus(type: number, hours?: number): { status: DayRecord['status'], hours: number, workVal: number } {
    let status: DayRecord['status'] = 'normal';
    let workVal = 1;
    let h = hours || 8;

    switch (type) {
        case RegistrationType.NghiPhep:
            status = 'leave';
            workVal = 1;
            h = 0;
            break;
        case RegistrationType.LamViecTaiNha:
            status = 'normal';
            workVal = 1;
            break;
        case RegistrationType.CongTac:
            status = 'normal';
            workVal = 1;
            break;
        case RegistrationType.NghiKhongLuong:
            status = 'off';
            workVal = 0;
            h = 0;
            break;
        case RegistrationType.DiTreVeSom:
            status = 'late';
            break;
        case RegistrationType.TangCa:
            status = 'normal';
            break;
    }

    if (hours !== undefined && hours < 8 && type !== RegistrationType.TangCa) {
        workVal = hours / 8;
        h = hours;
    }

    return { status, hours: h, workVal };
}

/**
 * Fetch cham cong data (timekeeping + registrations merged)
 */
export async function fetchChamCongData(
    accessToken: string,
    year: number,
    month: number,
    employeeId?: string | null
): Promise<DayRecord[]> {
    const startStr = formatDate(year, month, 1);
    const nextMonthDate = new Date(year, month + 1, 1);
    const startStrNext = formatDate(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), 1);

    const timekeepingPromise = fetchTimekeepingData(accessToken, startStr, startStrNext, employeeId);
    const registrationPromise = employeeId 
        ? fetchPhieuDangKyForMonth(accessToken, employeeId, startStr, startStrNext)
        : Promise.resolve([]);

    try {
        const [timekeepingData, registrationData] = await Promise.all([timekeepingPromise, registrationPromise]);
        return mergeTimekeepingAndRegistration(timekeepingData, registrationData, year, month);
    } catch (e) {
        console.error("Error fetching data:", e);
        throw e;
    }
}

/**
 * Update check-in/check-out time
 */
export async function updateChamCongTime(
    accessToken: string,
    recordId: string,
    checkIn?: string,
    checkOut?: string,
    sogiolam?: number,
    ghichu?: string
): Promise<boolean> {
    const url = `${dataverseConfig.baseUrl}/crdfd_bangchamconghangngaies(${recordId})`;

    const payload: Record<string, unknown> = {};
    if (checkIn !== undefined) payload.crdfd_checkin = checkIn;
    if (checkOut !== undefined) payload.crdfd_checkout = checkOut;
    if (sogiolam !== undefined) payload.crdfd_sogiolam = sogiolam;
    if (ghichu !== undefined) payload.crdfd_ghichu = ghichu;

    try {
        const response = await fetch(url, {
            method: "PATCH",
            headers: {
                ...createFetchHeaders(accessToken),
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            return true;
        } else {
            console.error("Error updating time:", response.status, await response.text());
            return false;
        }
    } catch (e) {
        console.error("Exception updating time:", e);
        return false;
    }
}

