import { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
import { dataverseConfig } from "../config/authConfig";
import { DayRecord } from "../types/types";
import { getStandardHours, formatDate } from '../utils/workUtils';

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
    crdfd_hinhthuc?: string;     // Text
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
        const start = new Date(reg.crdfd_tungay);
        const end = new Date(reg.crdfd_enngay);

        // Iterate date from start to end
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            // Check if date inside current month
            if (d.getMonth() !== month || d.getFullYear() !== year) continue;

            const dateStr = d.toISOString().split('T')[0];
            const existing = recordsMap.get(dateStr);

            // If existing has data (hours > 0), maybe skip? 
            // Requirement: "tu tinh vao cong" -> implies it counts as work.
            // If user checked in, we use check-in data. If missing checkin, use registration.

            if (!existing || existing.hoursWorked === 0) {
                // Map Registration Type to Status/Work
                const { status, hours, workVal } = mapRegistrationToStatus(reg.crdfd_loaiangky, reg.crdfd_sogio2);

                recordsMap.set(dateStr, {
                    date: dateStr,
                    hoursWorked: hours,
                    status: status,
                    workValue: workVal,
                    note: `DK: ${reg.crdfd_diengiai || ''}`,
                    registration: {
                        id: reg.crdfd_phieuangkyid,
                        type: reg.crdfd_loaiangky,
                        typeName: getRegistrationTypeName(reg.crdfd_loaiangky),
                        hours: reg.crdfd_sogio2 || 0,
                        status: getApprovalStatusText(reg.crdfd_captrenduyet)
                    }
                });
                if (existing) {
                    existing.registration = {
                        id: reg.crdfd_phieuangkyid,
                        type: reg.crdfd_loaiangky,
                        typeName: getRegistrationTypeName(reg.crdfd_loaiangky),
                        hours: reg.crdfd_sogio2 || 0,
                        status: getApprovalStatusText(reg.crdfd_captrenduyet)
                    };
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
        hinhThuc?: string;
        soNgay?: number;
    }
): Promise<boolean> {
    const url = `${dataverseConfig.baseUrl}/crdfd_phieuangkies(${registrationId})`;

    const payload: any = {};
    if (data.type !== undefined) payload.crdfd_loaiangky = data.type;
    if (data.startDate !== undefined) payload.crdfd_tungay = data.startDate;
    if (data.endDate !== undefined) payload.crdfd_enngay = data.endDate;
    if (data.hours !== undefined) payload.crdfd_sogio2 = data.hours;
    if (data.reason !== undefined) payload.crdfd_diengiai = data.reason;
    if (data.quanLyTructiep !== undefined) payload.crdfd_quanlytructiep = data.quanLyTructiep;
    if (data.capTrenDuyet !== undefined) payload.crdfd_captrenduyet = data.capTrenDuyet;
    if (data.hinhThuc !== undefined) payload.crdfd_hinhthuc = data.hinhThuc;
    if (data.soNgay !== undefined) payload.cr1bb_songay = data.soNgay;

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
            console.error("Error updating registration:", response.status, await response.text());
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
    cr44a_truongbophan?: string;         // Trưởng bộ phận duyệt
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
    let filter = `statecode eq 0 and _cr1bb_oituong_value eq ${subjectId}`;

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
                ownerName: item['_ownerid_value@OData.Community.Display.V1.FormattedValue'] || "Unknown",
            };
        });
    } catch (e) {
        console.error("Error calling DNTT API:", e);
        return [];
    }
}
