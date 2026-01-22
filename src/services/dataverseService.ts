import { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
import { dataverseConfig } from "../config/authConfig";
import { DayRecord } from "../types/types";
import { getStandardHours, formatDate } from '../utils/workUtils';
import { cache } from '../utils/cacheUtils';
import { measureApiCall, createCacheKey } from '../utils/performanceUtils';

// Interface cho data từ Dataverse
interface DataverseChamCong {
    crdfd_bangchamconghangngayid: string;
    crdfd_ngay: string;              // Ngày làm việc
    crdfd_checkin?: string;      // Giờ vào
    crdfd_checkout?: string;     // Giờ ra
    registration?: {       // Thông tin đăng ký
        id: string;
        type: number;
        typeName: string;
        hours: number;
        status: string;
    };
    crdfd_sogiolam?: number;         // Số giờ làm
    crdfd_trangthai?: string;        // Trạng thái
    crdfd_ghichu?: string;           // Ghi chú
    _crdfd_tennhanvien_value?: string; // Lookup GUID
    statecode: number;
}

// Enum Loai Dang Ky
export enum RegistrationType {
    NghiPhep = 191920000,
    LamViecTaiNha = 191920001,
    TangCa = 191920002,
    CongTac = 191920003,
    DiTreVeSom = 191920004,
    NghiKhongLuong = 283640001
}

export enum ApprovalStatus {
    ChuaDuyet = 191920000,
    DaDuyet = 191920001,
    TuChoi = 191920002
}

export enum HinhThucRegistration {
    NghiPhepNam = 191920000,
    NghiKhongLuong = 191920001,
    NghiThaiSan = 191920002,
    NghiKetHon = 191920003,
    NghiTangChe = 191920004,
    NghiPhepTruGioOT = 191920015,
    TangCaSauGioLam = 191920005,
    TangCaNgayNghi = 191920013,
    TangCaNgayLeTet = 191920006,
    TangCaTrucDon = 191920007,
    TangCaNghiBu = 191920014,
    SaleonlineTangCaTrucHangTuan = 191920008,
    ViecCongTy = 191920009,
    LamBuTrongThang = 191920010,
    TruLuong = 191920011,
    ThieuCheckinCheckout = 191920012,
    CongTacSale = 191920016,
    CongTacVanPhong = 191920017,
    NghiNuoiConDuoi12Thang = 191920018,
    TangCaKhongNhanLuong = 191920019,
    ThienTaiDaiDich = 283640001
}

// Interface check Phieu Dang Ky
interface PhieuDangKy {
    crdfd_phieuangkyid: string; // ID (guessed) or just use the fetch result
    _crdfd_nhanvien_value: string;
    crdfd_loaiangky: number;      // OptionSet Value
    crdfd_tungay: string;         // ISO Date
    crdfd_enngay: string;         // ISO Date (assuming typo in user requirement is real column name)
    crdfd_sogio2?: number;
    crdfd_diengiai?: string;
    crdfd_captrenduyet?: number; // OptionSet: ApprovalStatus
    crdfd_hinhthuc?: number;     // OptionSet Value (Int32)
    crdfd_quanlytructiep?: string; // Text
    cr1bb_songay?: number;       // Number
    cr1bb_sopheptonnamtruoc?: number; // Number
    new_sophepconlaitoithangthucte?: number; // Number
    statecode: number;
}



/**
 * Lấy access token cho Dataverse
 */
export async function getAccessToken(
    instance: IPublicClientApplication,
    account: AccountInfo
): Promise<string> {
    const response = await instance.acquireTokenSilent({
        scopes: dataverseConfig.scopes,
        account: account,
    });
    return response.accessToken;
}

/**
 * Lấy Employee ID trực tiếp từ bảng systemusers
 * Flow: Azure AD Object ID → query systemusers → lấy _crdfd_employee2_value
 */
export async function fetchEmployeeIdFromSystemUser(
    accessToken: string,
    azureAdObjectId: string
): Promise<string | null> {
    // Query systemusers lấy _crdfd_employee2_value (Employee ID lookup)
    const filter = `azureactivedirectoryobjectid eq ${azureAdObjectId}`;
    const url = `${dataverseConfig.baseUrl}/systemusers?$filter=${encodeURIComponent(filter)}&$select=systemuserid,fullname,_crdfd_employee2_value`;

    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Error fetching systemuser:", response.status, errorText);
            return null;
        }

        const data = await response.json();

        if (data.value && data.value.length > 0) {
            const employeeId = data.value[0]._crdfd_employee2_value;

            if (employeeId) {
                return employeeId;
            }
        }
        return null;
    } catch (e) {
        console.error("Error fetching employee ID from systemuser:", e);
        return null;
    }
}

/**
 * Gọi Dataverse API lấy dữ liệu chấm công
 */
export async function fetchChamCongData(
    accessToken: string,
    year: number,
    month: number,
    employeeId?: string | null
): Promise<DayRecord[]> {
    // Tạo filter theo tháng
    const startStr = formatDate(year, month, 1);
    const nextMonthDate = new Date(year, month + 1, 1);
    const startStrNext = formatDate(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), 1);

    // 1. Fetch Timekeeping Data (Bang Cham Cong)
    const timekeepingPromise = (async () => {
        let filter = `statecode eq 0 and crdfd_ngay ge ${startStr} and crdfd_ngay lt ${startStrNext}`;
        if (employeeId) {
            filter += ` and _crdfd_tennhanvien_value eq ${employeeId}`;
        }
        const entitySetName = "crdfd_bangchamconghangngaies";
        const url = `${dataverseConfig.baseUrl}/${entitySetName}?$filter=${encodeURIComponent(filter)}`;

        const res = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Accept": "application/json",
            },
        });
        if (!res.ok) throw new Error("Failed to fetch timekeeping");
        const json = await res.json();
        return json.value as DataverseChamCong[];
    })();

    // 2. Fetch Registration Data (Phieu Dang Ky)
    const registrationPromise = employeeId ? fetchPhieuDangKy(accessToken, employeeId, startStr, startStrNext) : Promise.resolve([]);

    try {
        const [timekeepingData, registrationData] = await Promise.all([timekeepingPromise, registrationPromise]);

        // 3. Merge Data
        return mergeTimekeepingAndRegistration(timekeepingData, registrationData, year, month);

    } catch (e) {
        console.error("Error fetching data:", e);
        throw e;
    }
}

/**
 * Fetch Phieu Dang Ky
 */
async function fetchPhieuDangKy(
    accessToken: string,
    employeeId: string,
    startStr: string,
    endStr: string
): Promise<PhieuDangKy[]> {
    // Filter by employee and date overlap
    // Overlap logic: (StartA <= EndB) and (EndA >= StartB)
    // Here we simplified to look for registrations that might affect this month.
    // Assuming crdfd_tungay and crdfd_enngay are DateOnly or DateTime.

    const filter = `_crdfd_nhanvien_value eq ${employeeId} and statecode eq 0 and crdfd_tungay le ${endStr} and crdfd_enngay ge ${startStr}`;
    const select = "crdfd_phieuangkyid,_crdfd_nhanvien_value,crdfd_loaiangky,crdfd_tungay,crdfd_enngay,crdfd_sogio2,crdfd_diengiai,crdfd_captrenduyet,crdfd_hinhthuc,crdfd_quanlytructiep,cr1bb_songay,cr1bb_sopheptonnamtruoc,new_sophepconlaitoithangthucte";

    const url = `${dataverseConfig.baseUrl}/crdfd_phieuangkies?$filter=${encodeURIComponent(filter)}&$select=${select}`;

    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Error fetching registrations:", response.status, errorText);
            return [];
        }

        const data = await response.json();
        return data.value || [];
    } catch (e) {
        console.error("Error calling PhieuDangKy API:", e);
        return [];
    }
}

/**
 * Tạo Phiếu Đăng Ký
 */
export async function createPhieuDangKy(
    accessToken: string,
    employeeId: string,
    data: {
        type: number;
        startDate: string;
        endDate: string;
        hours: number;
        reason?: string;
        approvalStatus: number;
        hinhThuc: number;
    }
): Promise<boolean> {
    const url = `${dataverseConfig.baseUrl}/crdfd_phieuangkies`;

    // Chuẩn bị payload
    const payload = {
        "crdfd_Nhanvien@odata.bind": `/crdfd_employees(${employeeId})`,
        "crdfd_loaiangky": data.type,
        "crdfd_tungay": data.startDate,
        "crdfd_enngay": data.endDate,
        "crdfd_diengiai": data.reason || "",
        "crdfd_captrenduyet": data.approvalStatus,
        "crdfd_sogio2": data.hours,
        "crdfd_hinhthuc": data.hinhThuc
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Accept": "application/json",
            },
            body: JSON.stringify(payload)
        });

        if (response.ok || response.status === 204 || response.status === 201) {
            return true;
        } else {
            const errorText = await response.text();
            console.error("Error creating registration details:", response.status, errorText);
            throw new Error(`Dataverse Error (${response.status}): ${errorText}`);
        }
    } catch (e) {
        console.error("Exception creating registration:", e);
        return false;
    }
}

/**
 * Update Check-in/Check-out Time
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

    const payload: any = {};
    if (checkIn !== undefined) payload.crdfd_checkin = checkIn;
    if (checkOut !== undefined) payload.crdfd_checkout = checkOut;
    if (sogiolam !== undefined) payload.crdfd_sogiolam = sogiolam;
    if (ghichu !== undefined) payload.crdfd_ghichu = ghichu;

    try {
        const response = await fetch(url, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Accept": "application/json",
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) { // 204 No Content
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

/**
 * Merge logic
 */
function mergeTimekeepingAndRegistration(
    timekeeping: DataverseChamCong[],
    registrations: PhieuDangKy[],
    year: number,
    month: number
): DayRecord[] {
    const recordsMap = new Map<string, DayRecord>();

    // 1. Process Timekeeping first
    const timekeepingRecords = transformToRecords(timekeeping);
    timekeepingRecords.forEach(r => recordsMap.set(r.date, r));

    // 2. Process Registrations (Apply to days without sufficient data?)
    // Need to iterate through each registration and expand to days

    // Helper to add days
    const processRegistration = (reg: PhieuDangKy) => {
        // Chỉ xử lý phiếu đã được DUYỆT
        if (reg.crdfd_captrenduyet !== ApprovalStatus.DaDuyet) {
            return;
        }

        const start = new Date(reg.crdfd_tungay);
        const end = new Date(reg.crdfd_enngay);

        // Iterate date from start to end
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            // Check if date inside current month
            if (d.getMonth() !== month || d.getFullYear() !== year) continue;

            const dateStr = d.toISOString().split('T')[0];
            const existing = recordsMap.get(dateStr);

            // Tạo registration info
            const registrationInfo = {
                id: reg.crdfd_phieuangkyid,
                type: reg.crdfd_loaiangky,
                typeName: getRegistrationTypeName(reg.crdfd_loaiangky),
                hours: reg.crdfd_sogio2 || 0,
                status: getApprovalStatusText(reg.crdfd_captrenduyet)
            };

            if (!existing || existing.hoursWorked === 0) {
                // Ngày không có dữ liệu chấm công - dùng hoàn toàn từ phiếu đăng ký
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
                // Ngày ĐÃ CÓ dữ liệu chấm công - chỉ attach registration info
                // Trường hợp: nghỉ phép nửa ngày (4h làm việc + 4h nghỉ phép)
                existing.registration = registrationInfo;

                // Cập nhật note nếu có
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
        default: return "Chưa duyệt"; // Default pending
    }
}

function mapRegistrationToStatus(type: number, hours?: number): { status: DayRecord['status'], hours: number, workVal: number } {
    let status: DayRecord['status'] = 'normal';
    let workVal = 1;
    let h = hours || 8;

    switch (type) {
        case RegistrationType.NghiPhep:
            status = 'leave';
            workVal = 1; // Paid leave
            h = 0; // No hours worked physically
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
            // Logic for calculation?
            break;
        case RegistrationType.TangCa:
            status = 'normal'; // Or specific OT status
            break;
    }

    // If specific hours provided (e.g. 4h leave), adjust workVal
    if (hours !== undefined && hours < 8 && type !== RegistrationType.TangCa) {
        workVal = hours / 8;
        h = hours;
    }

    return { status, hours: h, workVal };
}

/**
 * Transform Dataverse data thành DayRecord[]
 */
function transformToRecords(dataverseData: DataverseChamCong[]): DayRecord[] {
    return dataverseData.map(item => {
        const hoursWorked = item.crdfd_sogiolam || 0;

        // --- TIMEZONE SAFE DATE PARSING ---
        // Instead of new Date(item.crdfd_ngay), parse parts manually to avoid shifts
        const datePart = item.crdfd_ngay.split('T')[0];
        const [y, m, d] = datePart.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d); // Local time date object
        const dayOfWeek = dateObj.getDay();
        const standardHours = getStandardHours(dayOfWeek);

        // Xác định status
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

        // === WARNING DETECTION ===
        // Skip weekends (Sunday = 0), holidays, and days with leave/off status
        const isWorkday = dayOfWeek !== 0; // Monday-Saturday
        const hasLeaveStatus = status === 'leave' || status === 'off' || status === 'holiday';

        if (isWorkday && !hasLeaveStatus && status === 'normal') {
            const checkIn = item.crdfd_checkin;
            const checkOut = item.crdfd_checkout;

            // Helper to extract LOCAL time as minutes from various formats
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

        // --- WORK VALUE CALCULATION ---
        // If hoursWorked >= standardHours (e.g. 4/4 or 8/8), it's full công for that day.
        // For summary, full work day (Mon-Fri) is 1.0, half day (Sat) is 0.5.
        let calculatedWorkValue = 0;
        if (hoursWorked >= standardHours && standardHours > 0) {
            calculatedWorkValue = (dayOfWeek === 6) ? 0.5 : 1.0;
        } else if (standardHours > 0) {
            // Partial công
            const ratio = hoursWorked / standardHours;
            const maxVal = (dayOfWeek === 6) ? 0.5 : 1.0;
            calculatedWorkValue = parseFloat((ratio * maxVal).toFixed(2));
        }

        return {
            date: datePart, // YYYY-MM-DD
            hoursWorked,
            status,
            workValue: calculatedWorkValue,
            sogiolam: hoursWorked, // Ensure consistency
            recordId: item.crdfd_bangchamconghangngayid,
            note: item.crdfd_ghichu || undefined,
            checkIn: item.crdfd_checkin,
            checkOut: item.crdfd_checkout,
            registration: item.registration,
        };
    });
}


// ==========================================
// TEAM DASHBOARD SERVICES
// ==========================================

export interface TeamRegistration extends PhieuDangKy {
    employeeName: string;
    employeeCode?: string;
    _crdfd_nhanvien_value: string;
}

/**
 * Fetch toàn bộ phiếu đăng ký của team (hoặc tất cả nếu là admin/manager)
 * Có thể filter theo status hoặc date range
 */
export async function fetchTeamRegistrations(
    accessToken: string,
    month?: number,
    year?: number
): Promise<TeamRegistration[]> {
    // Nếu có month/year -> filter theo date
    // Default fetch status = Pending (0) or Approved (1)

    // Filter strategy:
    // Lấy tất cả các phiếu có statecode = 0 (Active)
    // Nếu muốn filter lịch sử, cần thêm điều kiện date.

    let filter = `statecode eq 0`;

    // Nếu có month/year, filter theo crdfd_tungay
    if (month !== undefined && year !== undefined) {
        const startStr = formatDate(year, month, 1);
        const nextMonthDate = new Date(year, month + 1, 1);
        const startStrNext = formatDate(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), 1);

        // Logic: Lấy các phiếu nằm trong tháng này OR status = Pending (để luôn thấy việc cần làm)
        // filter = `(${filter} and crdfd_tungay ge ${startStr} and crdfd_tungay lt ${startStrNext}) or (crdfd_captrenduyet eq ${ApprovalStatus.ChuaDuyet})`;

        // Simplified: Just fetch all for now, or fetch by range. 
        // User request: "duyệt các đơn", "xem thống kê". 
        // So we need ALL Pending AND History for this month.

        filter = `(crdfd_captrenduyet eq ${ApprovalStatus.ChuaDuyet}) or (crdfd_tungay ge ${startStr} and crdfd_tungay lt ${startStrNext})`;
    }

    const select = "crdfd_phieuangkyid,_crdfd_nhanvien_value,crdfd_loaiangky,crdfd_tungay,crdfd_enngay,crdfd_sogio2,crdfd_diengiai,crdfd_captrenduyet,crdfd_hinhthuc,crdfd_quanlytructiep,cr1bb_songay,cr1bb_sopheptonnamtruoc,new_sophepconlaitoithangthucte";

    // Removed expand to avoid errors with navigation properties. Using OData Formatted Value.
    const url = `${dataverseConfig.baseUrl}/crdfd_phieuangkies?$filter=${encodeURIComponent(filter)}&$select=${select}`;

    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Accept": "application/json",
                "Prefer": "odata.include-annotations=\"*\""
            },
        });

        if (!response.ok) {
            console.error("Error fetching team registrations:", await response.text());
            return [];
        }

        const data = await response.json();

        return (data.value || []).map((item: any) => {
            return {
                ...item,
                employeeName: item['_crdfd_nhanvien_value@OData.Community.Display.V1.FormattedValue'] || "Unknown",
                employeeCode: undefined
            };
        });
    } catch (e) {
        console.error("Error calling Team Registration API:", e);
        return [];
    }
}

/**
 * Fetch phiếu đăng ký cá nhân (theo employeeId và statecode = 0)
 * Optionally filter by year/month
 */
export async function fetchPersonalRegistrations(
    accessToken: string,
    employeeId: string,
    year?: number,
    month?: number
): Promise<TeamRegistration[]> {
    // Filter: statecode eq 0 AND employee lookup = employeeId
    let filter = `statecode eq 0 and _crdfd_nhanvien_value eq ${employeeId}`;

    // Add date filter if year/month provided
    if (year !== undefined && month !== undefined) {
        const startStr = formatDate(year, month, 1);
        const nextMonthDate = new Date(year, month + 1, 1);
        const startStrNext = formatDate(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), 1);

        // Filter registrations that overlap with the selected month
        filter += ` and crdfd_tungay lt ${startStrNext} and crdfd_enngay ge ${startStr}`;
    }

    const select = "crdfd_phieuangkyid,_crdfd_nhanvien_value,crdfd_loaiangky,crdfd_tungay,crdfd_enngay,crdfd_sogio2,crdfd_diengiai,crdfd_captrenduyet";

    const url = `${dataverseConfig.baseUrl}/crdfd_phieuangkies?$filter=${encodeURIComponent(filter)}&$select=${select}&$orderby=crdfd_tungay desc`;

    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Accept": "application/json",
                "Prefer": "odata.include-annotations=\"*\""
            },
        });

        if (!response.ok) {
            console.error("Error fetching personal registrations:", await response.text());
            return [];
        }

        const data = await response.json();

        return (data.value || []).map((item: any) => {
            return {
                ...item,
                employeeName: item['_crdfd_nhanvien_value@OData.Community.Display.V1.FormattedValue'] || "Unknown",
                employeeCode: undefined
            };
        });
    } catch (e) {
        console.error("Error calling Personal Registration API:", e);
        return [];
    }
}

/**
 * Cập nhật trạng thái duyệt (Approve/Reject)
 */
export async function updateRegistrationStatus(
    accessToken: string,
    registrationId: string,
    status: ApprovalStatus
): Promise<boolean> {
    const url = `${dataverseConfig.baseUrl}/crdfd_phieuangkies(${registrationId})`;

    const payload = {
        "crdfd_captrenduyet": status
    };

    try {
        const response = await fetch(url, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Accept": "application/json",
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            return true;
        } else {
            console.error("Error updating status:", response.status, await response.text());
            return false;
        }
    } catch (e) {
        console.error("Exception updating status:", e);
        return false;
    }
}

/**
 * Cập nhật thông tin phiếu đăng ký (Edit Mode)
 */
export async function updatePhieuDangKy(
    accessToken: string,
    registrationId: string,
    data: {
        type?: number;
        startDate?: string;
        endDate?: string;
        hours?: number;
        reason?: string;
        quanLyTructiep?: string;
        capTrenDuyet?: number;
        hinhThuc?: number;
        soNgay?: number;
    }
): Promise<boolean> {
    const url = `${dataverseConfig.baseUrl}/crdfd_phieuangkies(${registrationId})`;

    const payload: any = {};
    if (data.type !== undefined) payload.crdfd_loaiangky = data.type;
    if (data.startDate !== undefined) payload.crdfd_tungay = data.startDate;
    if (data.endDate !== undefined) payload.crdfd_enngay = data.endDate;
    if (data.hours !== undefined && data.hours !== null) payload.crdfd_sogio2 = data.hours;
    if (data.reason !== undefined) payload.crdfd_diengiai = data.reason;
    if (data.quanLyTructiep !== undefined) payload.crdfd_quanlytructiep = data.quanLyTructiep;
    if (data.capTrenDuyet !== undefined) payload.crdfd_captrenduyet = data.capTrenDuyet;

    // Validate hinhThuc is number before adding (it's an OptionSet)
    if (data.hinhThuc !== undefined && typeof data.hinhThuc === 'number' && !isNaN(data.hinhThuc)) {
        payload.crdfd_hinhthuc = data.hinhThuc;
    }

    if (data.soNgay !== undefined && data.soNgay !== null) payload.cr1bb_songay = data.soNgay;

    console.log("Updating Registration Payload:", JSON.stringify(payload));

    try {
        const response = await fetch(url, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Accept": "application/json",
            },
            body: JSON.stringify(payload)
        });

        if (response.ok || response.status === 204) {
            return true;
        } else {
            const errorText = await response.text();
            console.error("Error updating registration:", response.status, errorText);
            return false;
        }
    } catch (e) {
        console.error("Exception updating registration:", e);
        return false;
    }
}

// ==========================================
// DNTT (Đề nghị thanh toán) SERVICES
// ==========================================

export interface DNTTRecord {
    cr44a_enghithanhtoanid: string;
    cr1bb_loaihosothanhtoan?: string;    // Loại hồ sơ thanh toán
    cr44a_sotien_de_nghi?: number;       // Số tiền đề nghị
    cr1bb_diengiai?: string;             // Diễn giải
    cr1bb_ngaydukienthanhtoan?: string;  // Ngày dự kiến thanh toán
    cr44a_trangthai_denghithanhtoan?: string; // Trạng thái
    cr44a_truongbophan?: string;         // Trưởng bộ phận duyệt (formatted)
    cr44a_truongbophan_value?: number;   // Trưởng bộ phận duyệt (raw OptionSet value)
    cr44a_ketoanthanhtoan?: string;      // Kế toán thanh toán duyệt
    cr44a_ketoantonghop?: string;         // Kế toán tổng hợp duyệt
    _ownerid_value?: string;             // Owner lookup
    ownerName?: string;                  // Owner name (formatted)
    createdon?: string;                  // Created date
    statecode: number;
}

/**
 * Fetch Employee Code using Employee ID (system user lookup)
 * Filter by statecode = 0 (Active)
 */
export async function fetchEmployeeCode(
    accessToken: string,
    employeeId: string
): Promise<string | null> {
    // Select crdfd_manhanvien from crdfd_employees table (was crdfd_nhanviens)
    // Filter by crdfd_employeeid (was crdfd_nhanvienid) and statecode
    // Note: Assuming employeeId passed here is already the UUID from systemusers or mapped correctly.
    // If employeeId is the crdfd_employeeid (GUID), then filter is: crdfd_employeeid eq ${employeeId}

    const filter = `crdfd_employeeid eq ${employeeId} and statecode eq 0`;
    const select = "crdfd_manhanvien";

    // Using collection fetch with filter
    const url = `${dataverseConfig.baseUrl}/crdfd_employees?$filter=${encodeURIComponent(filter)}&$select=${select}`;

    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Accept": "application/json"
            },
        });

        if (response.ok) {
            const data = await response.json();
            if (data.value && data.value.length > 0) {
                return data.value[0].crdfd_manhanvien;
            }
            return null;
        }
        console.error("Error fetching employee code:", await response.text());
        return null;
    } catch (e) {
        console.error("Exception fetching employee code:", e);
        return null;
    }
}

/**
 * Fetch Subject ID (Tong Hop Doi Tuong) using Employee Code
 * Filter by statecode = 0 (Active)
 */
export async function fetchSubjectId(
    accessToken: string,
    employeeCode: string
): Promise<string | null> {
    // Filter crdfd_tnghpitngs by cr44a_maoituong AND statecode = 0
    const filter = `cr44a_maoituong eq '${employeeCode}' and statecode eq 0`;
    // Correct ID column is crdfd_tnghpitngid (from error log)
    const select = "crdfd_tnghpitngid";
    const url = `${dataverseConfig.baseUrl}/crdfd_tnghpitngs?$filter=${encodeURIComponent(filter)}&$select=${select}`;

    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Accept": "application/json"
            },
        });

        if (response.ok) {
            const data = await response.json();
            if (data.value && data.value.length > 0) {
                // Must access the correct property name
                return data.value[0].crdfd_tnghpitngid;
            }
        }
        console.error("Error fetching subject ID or not found:", await response.text());
        return null;
    } catch (e) {
        console.error("Exception fetching subject ID:", e);
        return null;
    }
}

/**
 * Fetch DNTT records (Đề nghị thanh toán) for current user (Subject)
 */
export async function fetchDNTTRecords(
    accessToken: string,
    subjectId: string,
    year?: number,
    month?: number
): Promise<DNTTRecord[]> {
    // Filter: statecode eq 0 (Active) AND Subject Lookup matches subjectId
    // Corrected lookup column: _cr1bb_oituong_value
    let filter = `statecode eq 0 and (_cr1bb_oituong_value eq ${subjectId} or cr1bb_phongban eq 'Phòng Công nghệ')`;

    // Add date filter if year/month provided
    if (year !== undefined && month !== undefined) {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        // Filter by Expected Payment Date (cr1bb_ngaydukienthanhtoan)
        filter += ` and cr1bb_ngaydukienthanhtoan ge ${startStr} and cr1bb_ngaydukienthanhtoan le ${endStr}`;
    }

    const select = "cr44a_enghithanhtoanid,_cr1bb_loaihosothanhtoan_value,cr44a_sotien_de_nghi,cr1bb_diengiai,cr1bb_ngaydukienthanhtoan,cr44a_trangthai_denghi_thanhtoan,cr44a_truongbophan,cr44a_ketoanthanhtoan,cr44a_ketoantonghop,_ownerid_value,createdon,statecode";

    const url = `${dataverseConfig.baseUrl}/cr44a_enghithanhtoans?$filter=${encodeURIComponent(filter)}&$select=${select}&$orderby=cr1bb_ngaydukienthanhtoan desc`;

    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Accept": "application/json",
                "Prefer": "odata.include-annotations=\"*\""
            },
        });

        if (!response.ok) {
            console.error("Error fetching DNTT records:", await response.text());
            return [];
        }

        const data = await response.json();

        return (data.value || []).map((item: any) => {
            return {
                ...item,
                // Map lookup formatted value for Loai Ho So
                cr1bb_loaihosothanhtoan: item['_cr1bb_loaihosothanhtoan_value@OData.Community.Display.V1.FormattedValue']
                    || item['cr1bb_loaihosothanhtoan@OData.Community.Display.V1.FormattedValue']
                    || "Unknown",
                // Map Choice formatted value for Trang Thai
                cr44a_trangthai_denghithanhtoan: item['cr44a_trangthai_denghi_thanhtoan@OData.Community.Display.V1.FormattedValue']
                    || item['cr44a_trangthai_denghi_thanhtoan']
                    || "Unknown",
                // Map Choice formatted value for Ke Toan Tong Hop
                cr44a_ketoantonghop: item['cr44a_ketoantonghop@OData.Community.Display.V1.FormattedValue']
                    || item['cr44a_ketoantonghop']
                    || "Unknown",
                // Map Choice formatted value for Truong Bo Phan
                cr44a_truongbophan: item['cr44a_truongbophan@OData.Community.Display.V1.FormattedValue']
                    || item['cr44a_truongbophan']
                    || "Unknown",
                // Raw value for editing
                cr44a_truongbophan_value: item['cr44a_truongbophan'] ?? null,
                ownerName: item['_ownerid_value@OData.Community.Display.V1.FormattedValue'] || "Unknown",
            };
        });
    } catch (e) {
        console.error("Error calling DNTT API:", e);
        return [];
    }
}

/**
 * Update DNTT record approval field
 * @param accessToken Dataverse access token
 * @param recordId DNTT record ID (cr44a_enghithanhtoanid)
 * @param fieldName Field to update (e.g., 'cr44a_truongbophan')
 * @param value New OptionSet value (number)
 */
export async function updateDNTTStatus(
    accessToken: string,
    recordId: string,
    fieldName: string,
    value: number | null
): Promise<boolean> {
    const url = `${dataverseConfig.baseUrl}/cr44a_enghithanhtoans(${recordId})`;

    const payload: any = {};
    payload[fieldName] = value;

    try {
        const response = await fetch(url, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Accept": "application/json",
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

// ==========================================
// TRANSACTION SALES SERVICES
// ==========================================

export interface TransactionSales {
    crdfd_transactionsalesid: string;
    crdfd_maphieuxuat?: string;
    _crdfd_idchitietonhang_value?: string;
    crdfd_idchitietonhang_name?: string;
    crdfd_tensanphamtex?: string;
    crdfd_soluonggiaotheokho?: number;
    crdfd_onvitheokho?: string;
    crdfd_ngaygiaothucte?: string;
    // Added fields
    crdfd_warehouse?: string;
    warehouseName?: string;
    crdfd_product?: string;
    productName?: string;
    crdfd_unit?: string;
    crdfd_purchasingemployee?: string;
    purchasingEmployeeName?: string;
    crdfd_urgentpurchasingemployee?: string;
    urgentPurchasingEmployeeName?: string;
    crdfd_stockbyuser?: number;
    crdfd_orderedstock?: number;
    crdfd_strangestock?: number;
    crdfd_warehousestrangestock?: number;
    crdfd_historyconfidence?: number;
    crdfd_confidencelevel?: string;
    crdfd_soluongoitratheokhonew?: number;
    createdon?: string;
}

export interface TransactionSalesPaginatedResponse {
    data: TransactionSales[];
    totalCount: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

export async function fetchTransactionSales(
    accessToken: string,
    page: number = 1,
    pageSize: number = 50,
    searchText?: string
): Promise<TransactionSalesPaginatedResponse> {
    const skip = (page - 1) * pageSize;

    // Select columns
    const columns = [
        "crdfd_transactionsalesid",
        "crdfd_maphieuxuat",
        "_crdfd_idchitietonhang_value",
        "crdfd_tensanphamtex",
        "crdfd_soluonggiaotheokho",
        "crdfd_onvitheokho",
        "crdfd_ngaygiaothucte",
        // Extended columns
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
        filter += ` and (contains(crdfd_tensanphamtex, '${searchText}') or contains(crdfd_maphieuxuat, '${searchText}'))`;
    }

    const query = `$filter=${encodeURIComponent(filter)}&$select=${select}&$top=${pageSize}&$count=true&$orderby=createdon desc`;

    const url = `${dataverseConfig.baseUrl}/crdfd_transactionsales?${query}`;

    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Accept": "application/json",
                "Prefer": "odata.include-annotations=\"*\""
            },
        });

        if (!response.ok) {
            console.error("Error fetching available Transaction Sales:", await response.text());
            return { data: [], totalCount: 0, hasNextPage: false, hasPreviousPage: false };
        }

        const data = await response.json();
        const items = data.value || [];
        const totalCount = data['@odata.count'] || 0;

        const mappedItems: TransactionSales[] = items.map((item: any) => ({
            crdfd_transactionsalesid: item.crdfd_transactionsalesid,
            crdfd_maphieuxuat: item.crdfd_maphieuxuat,
            _crdfd_idchitietonhang_value: item._crdfd_idchitietonhang_value,
            crdfd_idchitietonhang_name: item['_crdfd_idchitietonhang_value@OData.Community.Display.V1.FormattedValue'],
            crdfd_tensanphamtex: item.crdfd_tensanphamtex,
            crdfd_soluonggiaotheokho: item.crdfd_soluonggiaotheokho,
            crdfd_onvitheokho: item.crdfd_onvitheokho,
            crdfd_ngaygiaothucte: item.crdfd_ngaygiaothucte,

            crdfd_stockbyuser: item.crdfd_stockbyuser,
            crdfd_orderedstock: item.crdfd_orderedstock,
            crdfd_strangestock: item.crdfd_strangestock,
            crdfd_warehousestrangestock: item.crdfd_warehousestrangestock,
            crdfd_historyconfidence: item.crdfd_historyconfidence,
            crdfd_confidencelevel: item.crdfd_confidencelevel,
            crdfd_warehouse: item.crdfd_warehouse,
            // warehouseName: item['_crdfd_warehouse_value@OData.Community.Display.V1.FormattedValue'], // Assuming lookup if needed
            crdfd_product: item.crdfd_product,
            // productName: item['_crdfd_product_value@OData.Community.Display.V1.FormattedValue'],
            crdfd_unit: item.crdfd_unit,
            crdfd_purchasingemployee: item.crdfd_purchasingemployee,
            // purchasingEmployeeName: item['_crdfd_purchasingemployee_value@OData.Community.Display.V1.FormattedValue'],
            crdfd_urgentpurchasingemployee: item.crdfd_urgentpurchasingemployee,
            // urgentPurchasingEmployeeName: item['_crdfd_urgentpurchasingemployee_value@OData.Community.Display.V1.FormattedValue'],
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

// ==========================================
// TRANSACTION BUY SERVICES
// ==========================================

export interface TransactionBuy {
    crdfd_transactionbuyid: string;
    crdfd_name?: string; // Mã phiếu mua/nhập
    crdfd_masp?: string;
    crdfd_tensanpham?: string; // Or similar to sales
    crdfd_soluong?: number;
    crdfd_soluonganhantheokho?: number;
    crdfd_soluongoitratheokhonew?: number;
    createdon?: string;
}

export interface TransactionBuyPaginatedResponse {
    data: TransactionBuy[];
    totalCount: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

// ==========================================
// INVENTORY CHECK SERVICES (Kiểm tra tồn kho)
// ==========================================

export interface InventoryCheckItem {
    crdfd_kho_binh_dinhid: string; // warehouseInventoryId
    productName: string;
    productCode: string; // crdfd_masp
    productId?: string; // _crdfd_tensanphamlookup_value (GUID)
    warehouseLocation: string; // lookup formatted value
    tonKhoThucTe: number;
    tonKhoLyThuyet: number;
    tonKhaDung: number;            // cr1bb_tonkhadung
    hangLoiSauKiem: number;        // cr1bb_slhangloisaukiem
    tongTonKho: number;            // calculated: tonKhoThucTe + hangLoiSauKiem
}

export interface InventoryCheckPaginatedResponse {
    data: InventoryCheckItem[];
    totalCount: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

export interface WarehouseLocationOption {
    id: string;
    name: string;
}

/**
 * Fetch warehouse locations for filter dropdown
 * NOTE: Since we don't know the exact Warehouse master table name, 
 * we will derive the list of warehouses from the unique values in the Inventory table.
 */
export async function fetchWarehouseLocationsForFilter(
    accessToken: string
): Promise<WarehouseLocationOption[]> {
    // Check cache first (TTL: 10 minutes for warehouse locations)
    const cacheKey = 'warehouse_locations';
    const cached = cache.get<WarehouseLocationOption[]>(cacheKey);

    if (cached) {
        return cached;
    }

    // Query inventory to find unique warehouse locations
    // We select just the lookup column to minimize data
    // Reduced from 2000 to 1000 for better performance
    const url = `${dataverseConfig.baseUrl}/crdfd_kho_binh_dinhs?$select=_crdfd_vitrikho_value&$top=1000&$filter=statecode eq 0`;

    try {
        const locations = await measureApiCall('fetchWarehouseLocations', async () => {
            const response = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "OData-MaxVersion": "4.0",
                    "OData-Version": "4.0",
                    "Accept": "application/json",
                    "Prefer": "odata.include-annotations=\"*\""
                },
            });

            if (!response.ok) {
                console.error("Error fetching warehouse locations from inventory:", await response.text());
                return [];
            }

            const data = await response.json();
            const items = data.value || [];

            // Extract unique locations
            const locationMap = new Map<string, string>();

            items.forEach((item: any) => {
                const id = item._crdfd_vitrikho_value;
                const name = item['_crdfd_vitrikho_value@OData.Community.Display.V1.FormattedValue'];

                if (id && name) {
                    locationMap.set(id, name);
                }
            });

            return Array.from(locationMap.entries()).map(([id, name]) => ({ id, name }));
        });

        // Cache for 10 minutes
        cache.set(cacheKey, locations, 10 * 60 * 1000);
        return locations;
    } catch (e) {
        console.error("Exception fetching warehouse locations:", e);
        return [];
    }
}

/**
 * Fetch Inventory Check data from crdfd_kho_binh_dinhs
 */
export async function fetchInventoryCheck(
    accessToken: string,
    _page: number = 1,
    _pageSize: number = 50,
    searchText?: string,
    warehouseLocationIds?: string[],
    stockFilter: 'all' | 'negative' | 'nonzero' = 'all'
): Promise<InventoryCheckPaginatedResponse> {
    // NOTE: Dataverse/Dynamics sometimes does not support $skip on certain entities or configurations.
    // For "Skip Clause is not supported" error, we must either use paging cookies or client-side pagination.
    // Given the requirements, we will use a larger $top and handle simple cases, 
    // OR just fetch the first page. For proper pagination we'd need to implement NextLink.
    // To keep it simple and robust for this context: We will fetch reasonable amount of data and let client paginate 
    // if it fits in one batch, OR just show first N results.
    // Let's rely on Search for finding specific items instead of deep pagination.

    // We will attempt client-side pagination simulation by fetching a larger chunk if needed, 
    // or just fetch page 1 for now (since skip is broken).
    // Actually, to fix "Skip Clause is not supported", we REMOVE $skip.

    // Select columns including lookups
    // Verified select columns from Dataverse list
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

    // Build filter
    let filter = "statecode eq 0";

    // Filter by warehouse locations (multiple)
    if (warehouseLocationIds && warehouseLocationIds.length > 0) {
        const locationFilters = warehouseLocationIds.map((id: string) => `_crdfd_vitrikho_value eq ${id}`);
        filter += ` and (${locationFilters.join(" or ")})`;
    }

    if (searchText) {
        const escapedSearch = searchText.replace(/'/g, "''");
        filter += ` and (contains(crdfd_masp, '${escapedSearch}') or contains(crdfd_tensptext, '${escapedSearch}'))`;
    }

    if (stockFilter === 'negative') {
        filter += ` and crdfd_tonkhothucte lt 0`;
    } else if (stockFilter === 'nonzero') {
        filter += ` and crdfd_tonkhothucte ne 0`;
    }

    // OPTIMIZED: Reduced from 2000 to 500 for better performance
    const query = `$filter=${encodeURIComponent(filter)}&$select=${select}&$top=500&$count=true&$orderby=crdfd_masp asc`;
    const url = `${dataverseConfig.baseUrl}/crdfd_kho_binh_dinhs?${query}`;

    try {
        return await measureApiCall('fetchInventoryCheck', async () => {
            const response = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "OData-MaxVersion": "4.0",
                    "OData-Version": "4.0",
                    "Accept": "application/json",
                    "Prefer": "odata.include-annotations=\"*\""
                },
            });

            if (!response.ok) {
                console.error("Error fetching inventory check:", await response.text());
                return { data: [], totalCount: 0, hasNextPage: false, hasPreviousPage: false };
            }

            const data = await response.json();
            const items = data.value || [];
            const totalCount = data['@odata.count'] || items.length;

            const mappedItems: InventoryCheckItem[] = items.map((item: any) => {
                const tonKhoThucTe = item.crdfd_tonkhothucte || 0;
                const hangLoiSauKiem = item.cr1bb_slhangloisaukiem || 0;

                // Updated name mapping: prioritize lookup formatted value for the cleaner name
                const productName = item['_crdfd_tensanphamlookup_value@OData.Community.Display.V1.FormattedValue']
                    || item.crdfd_tensptext
                    || item.crdfd_masp
                    || "Unknown";

                return {
                    crdfd_kho_binh_dinhid: item.crdfd_kho_binh_dinhid,
                    productName: productName,
                    productCode: item.crdfd_masp || "",
                    productId: item._crdfd_tensanphamlookup_value || "", // Map Product GUID
                    warehouseLocation: item['_crdfd_vitrikho_value@OData.Community.Display.V1.FormattedValue'] || "Unknown",
                    tonKhoThucTe: tonKhoThucTe,
                    tonKhoLyThuyet: item.crdfd_tonkholythuyet || 0,
                    tonKhaDung: item.cr1bb_tonkhadung || 0,
                    hangLoiSauKiem: hangLoiSauKiem,
                    tongTonKho: tonKhoThucTe + hangLoiSauKiem
                };
            });

            return {
                data: mappedItems,
                totalCount: totalCount,
                hasNextPage: false, // Since we removed skip, we can't easily valid next page without nextLink
                hasPreviousPage: false
            };
        });
    } catch (e) {
        console.error("Exception fetching inventory check:", e);
        return { data: [], totalCount: 0, hasNextPage: false, hasPreviousPage: false };
    }
}

// ==========================================
// INVENTORY PRODUCTS SERVICES (Cho ProductsList.tsx)
// ==========================================

export interface InventoryProduct {
    crdfd_kho_binh_dinhid: string;
    productName: string;
    productCode?: string;
    crdfd_masp?: string;
    productId?: string;
    crdfd_onvi?: string;
    locationName?: string;
    warehouseLocation?: string;
    currentStock?: number;
    crdfd_tonkhothucte?: number;
    crdfd_tonkholythuyet?: number;
    crdfd_ton_kho_theo_ke_hoach?: number;
}

export interface InventoryProductsPaginatedResponse {
    data: InventoryProduct[];
    totalCount: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

export interface InventoryHistoryRecord {
    id: string;
    type: string;
    date: string;
    quantity: number;
    reference: string;
    note?: string;
}

/**
 * Fetch warehouse locations for filter dropdown (alias for backward compatibility)
 */
export async function fetchWarehouseLocations(
    accessToken: string
): Promise<WarehouseLocationOption[]> {
    return fetchWarehouseLocationsForFilter(accessToken);
}

/**
 * Fetch Inventory Products (For ProductsList.tsx)
 */
export async function fetchInventoryProducts(
    accessToken: string,
    _page: number = 1,
    _pageSize: number = 50,
    searchText?: string,
    warehouseLocationIds?: string[],
    stockFilter: 'all' | 'negative' | 'nonzero' = 'all'
): Promise<InventoryProductsPaginatedResponse> {
    // Reuse logic from fetchInventoryCheck but mapping to different interface
    // Also handling Skip removal

    // Verified select columns from Dataverse list
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

    // Filter by warehouse locations (multiple)
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
        const escapedSearch = searchText.replace(/'/g, "''");
        filter += ` and (contains(crdfd_masp, '${escapedSearch}') or contains(crdfd_tensptext, '${escapedSearch}'))`;
    }

    // REMOVED $skip
    const query = `$filter=${encodeURIComponent(filter)}&$select=${select}&$top=2000&$count=true&$orderby=crdfd_masp asc`;
    const url = `${dataverseConfig.baseUrl}/crdfd_kho_binh_dinhs?${query}`;

    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Accept": "application/json",
                "Prefer": "odata.include-annotations=\"*\""
            },
        });

        if (!response.ok) {
            console.error("Error fetching inventory products:", await response.text());
            return { data: [], totalCount: 0, hasNextPage: false, hasPreviousPage: false };
        }

        const data = await response.json();
        const items = data.value || [];
        const totalCount = data['@odata.count'] || items.length;

        const mappedItems: InventoryProduct[] = items.map((item: any) => ({
            crdfd_kho_binh_dinhid: item.crdfd_kho_binh_dinhid,
            productName: item['_crdfd_tensanphamlookup_value@OData.Community.Display.V1.FormattedValue'] || item.crdfd_tensptext || item.crdfd_masp || "Unknown",
            productCode: item.crdfd_masp || "",
            crdfd_masp: item.crdfd_masp,
            crdfd_onvi: item.crdfd_onvi,
            locationName: item['_crdfd_vitrikho_value@OData.Community.Display.V1.FormattedValue'] || "Unknown",
            warehouseLocation: item['_crdfd_vitrikho_value@OData.Community.Display.V1.FormattedValue'] || "Unknown",
            currentStock: item.crdfd_tonkhothucte || 0,
            crdfd_tonkhothucte: item.crdfd_tonkhothucte || 0,
            crdfd_tonkholythuyet: item.crdfd_tonkholythuyet || 0,
            crdfd_ton_kho_theo_ke_hoach: item.crdfd_ton_kho_theo_ke_hoach || 0
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
 * Fetch Inventory History for a product
 */
// ==========================================
// INVENTORY HISTORY AGGREGATION SERVICES
// ==========================================

export interface InventoryHistorySummary {
    totalImport: number;
    totalExport: number;
    totalReturnSale: number;
    totalReturnBuy: number;
    totalBalance: number; // Cân kho
    currentStock: number;
}

export interface InventoryHistoryExtendedRecord extends InventoryHistoryRecord {
    originalData?: any;
    quantityReturn?: number; // Cho đổi trả
}

/**
 * Fetch Inventory History Aggregation
 */
export async function fetchInventoryHistory(
    accessToken: string,
    productCode: string,
    productId: string
): Promise<{ records: InventoryHistoryExtendedRecord[], summary: InventoryHistorySummary }> {

    // Check cache first (TTL: 5 minutes)
    const cacheKey = createCacheKey('inventory_history', productCode, productId);
    const cached = cache.get<{ records: InventoryHistoryExtendedRecord[], summary: InventoryHistorySummary }>(cacheKey);

    if (cached) {
        return cached;
    }

    return await measureApiCall(`fetchInventoryHistory:${productCode}`, async () => {
        // 1. Fetch all sources in parallel
        // User requested to NOT load 'crdfd_kiemkhoqrs' (K LOAD BANG NAY)
        // So we remove checks fetching.
        const [sales, buys, specialEvents] = await Promise.all([
            fetchProductSalesTransactions(accessToken, productCode),
            fetchProductBuyTransactions(accessToken, productCode),
            fetchProductSpecialEvents(accessToken, productId)
        ]);

        // Checks is now empty array
        const checks: any[] = [];

        // 2. Aggregate Summary
        let totalImport = 0;
        let totalExport = 0;
        let totalReturnSale = 0;
        let totalReturnBuy = 0;
        let totalBalance = 0;

        const records: InventoryHistoryExtendedRecord[] = [];

        // Process Sales
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

        // Process Buys
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

        // Process Special Events (Cân kho)
        specialEvents.forEach(e => {
            const qty = e.quantity || 0; // Assumption
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

        // Process Inventory Checks (Kiểm kho) - Info only
        checks.forEach(c => {
            records.push({
                id: c.crdfd_kiemkhoqrid,
                type: 'Kiểm kho',
                date: c.createdon || '',
                quantity: c.crdfd_soluong || 0, // Assumption
                reference: c.crdfd_name || '',
            });
        });

        // Calculate Current Stock
        // Formula: (Nhập - Trả Mua) - (Xuất - Trả Bán) + Cân Kho
        const currentStock = (totalImport - totalReturnBuy) - (totalExport - totalReturnSale) + totalBalance;

        // Sort by date desc
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

        // Cache for 5 minutes
        cache.set(cacheKey, result, 5 * 60 * 1000);

        return result;
    });
}

// --- Helper Fetchers ---

async function fetchProductSalesTransactions(token: string, productCode: string): Promise<TransactionSales[]> {
    const filter = `statecode eq 0 and crdfd_masanpham eq '${productCode}'`; // Correct column: crdfd_masanpham
    const select = "crdfd_transactionsalesid,crdfd_maphieuxuat,crdfd_soluonggiaotheokho,crdfd_soluongoitratheokhonew,createdon";
    // Fix: Table name pluralized -> crdfd_transactionsaleses
    const url = `${dataverseConfig.baseUrl}/crdfd_transactionsaleses?$filter=${encodeURIComponent(filter)}&$select=${select}&$orderby=createdon desc`;

    try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
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
    const filter = `statecode eq 0 and crdfd_masanpham eq '${productCode}'`; // Correct column: crdfd_masanpham
    // Note: TransactionBuy has crdfd_masp according to previous code
    const select = "crdfd_transactionbuyid,crdfd_name,crdfd_soluonganhantheokho,crdfd_soluongoitratheokhonew,createdon";
    // Plural check: crdfd_transactionbuies?
    const url = `${dataverseConfig.baseUrl}/crdfd_transactionbuies?$filter=${encodeURIComponent(filter)}&$select=${select}&$orderby=createdon desc`;

    try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
            // Fallback singular if needed, but let's try plural based on standard
            console.warn("Retrying fetch buys with singular table name?");
            // For now return empty or simple retry logic could be added
            return [];
        }
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

    // User confirmed columns: crdfd_sanphamcankho (Lookup), crdfd_soluong, cr1bb_vitrikho (Lookup), cr1bb_makiemkho (Lookup)
    // Filter by _crdfd_sanphamcankho_value eq productId
    // Also likely crdfd_loaionhang eq 191920002 for "Cân kho" type.

    const filter = `_crdfd_sanphamcankho_value eq ${productId} and crdfd_loaionhang eq 191920002 and statecode eq 0`;
    const select = "crdfd_specialeventid,crdfd_soluong,createdon,crdfd_name,_cr1bb_vitrikho_value,_cr1bb_makiemkho_value";
    const url = `${dataverseConfig.baseUrl}/crdfd_specialevents?$filter=${encodeURIComponent(filter)}&$select=${select}&$orderby=createdon desc`;

    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Prefer": "odata.include-annotations=\"*\""
            }
        });
        if (!response.ok) return [];
        const data = await response.json();
        return (data.value || []).map((item: any) => {
            const auditCode = item['_cr1bb_makiemkho_value@OData.Community.Display.V1.FormattedValue'];
            return {
                id: item.crdfd_specialeventid,
                type: 'Cân kho',
                date: item.createdon,
                quantity: item.crdfd_soluong || 0,
                reference: item.crdfd_name,
                note: auditCode ? `Cân kho: ${auditCode}` : 'Điều chỉnh cân kho'
            };
        });
    } catch (e) {
        console.error("Error fetching special events", e);
        return [];
    }
}

export async function fetchTransactionBuys(
    accessToken: string,
    page: number = 1,
    pageSize: number = 50,
    searchText?: string
): Promise<TransactionBuyPaginatedResponse> {
    const skip = (page - 1) * pageSize;

    // Guessing columns based on common patterns. 
    // If these are wrong, we might need to adjust after first run error.
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
        filter += ` and (contains(crdfd_tensanpham, '${searchText}') or contains(crdfd_masp, '${searchText}'))`;
    }

    const query = `$filter=${encodeURIComponent(filter)}&$select=${select}&$top=${pageSize}&$count=true&$orderby=createdon desc`;

    // Note: Table name from TableGallery is 'crdfd_transactionbuy' (singular)
    // But usually APIs are plural. 'crdfd_transactionbuys'?
    // TableGallery url says: etn=crdfd_transactionbuy. 
    // Standard OData set name is usually pluralized. 
    // Let's try 'crdfd_transactionbuys'. If 404, we try singular.
    const url = `${dataverseConfig.baseUrl}/crdfd_transactionbuys?${query}`;

    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Accept": "application/json",
                "Prefer": "odata.include-annotations=\"*\""
            },
        });

        if (!response.ok) {
            console.error("Error fetching Transaction Buys:", await response.text());
            return { data: [], totalCount: 0, hasNextPage: false, hasPreviousPage: false };
        }

        const data = await response.json();
        const items = data.value || [];
        const totalCount = data['@odata.count'] || 0;

        const mappedItems: TransactionBuy[] = items.map((item: any) => ({
            crdfd_transactionbuyid: item.crdfd_transactionbuyid,
            crdfd_name: item.crdfd_name,
            crdfd_masp: item.crdfd_masp,
            crdfd_tensanpham: item.crdfd_tensanpham,
            // Check if quantity is different column name
            crdfd_soluong: item.crdfd_soluong,
            createdon: item.createdon
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
