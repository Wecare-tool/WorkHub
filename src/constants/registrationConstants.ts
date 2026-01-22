import { RegistrationType, HinhThucRegistration } from '../services/dataverse';

export const REGISTRATION_TYPES = [
    { value: RegistrationType.NghiPhep, label: 'Nghỉ phép' },
    { value: RegistrationType.LamViecTaiNha, label: 'Làm việc tại nhà (WFH)' },
    { value: RegistrationType.TangCa, label: 'Tăng ca' },
    { value: RegistrationType.CongTac, label: 'Công tác' },
    { value: RegistrationType.DiTreVeSom, label: 'Đi trễ / Về sớm' },
    { value: RegistrationType.NghiKhongLuong, label: 'Nghỉ không lương' },
];

export const HINH_THUC_MAP: Record<number, { value: number; label: string }[]> = {
    [RegistrationType.NghiPhep]: [
        { value: HinhThucRegistration.NghiPhepNam, label: 'Nghỉ phép năm' },
        { value: HinhThucRegistration.NghiThaiSan, label: 'Nghỉ thai sản' },
        { value: HinhThucRegistration.NghiKetHon, label: 'Nghỉ kết hôn' },
        { value: HinhThucRegistration.NghiTangChe, label: 'Nghỉ tang chế' },
        { value: HinhThucRegistration.NghiPhepTruGioOT, label: 'Nghỉ phép trừ giờ OT' },
        { value: HinhThucRegistration.NghiNuoiConDuoi12Thang, label: 'Nghỉ nuôi con dưới 12 tháng' },
    ],
    [RegistrationType.NghiKhongLuong]: [
        { value: HinhThucRegistration.NghiKhongLuong, label: 'Nghỉ không lương' },
        { value: HinhThucRegistration.ThienTaiDaiDich, label: 'Thiên tai / Đại dịch' },
    ],
    [RegistrationType.TangCa]: [
        { value: HinhThucRegistration.TangCaSauGioLam, label: 'Tăng ca sau giờ làm' },
        { value: HinhThucRegistration.TangCaNgayNghi, label: 'Tăng ca ngày nghỉ' },
        { value: HinhThucRegistration.TangCaNgayLeTet, label: 'Tăng ca ngày Lễ/Tết' },
        { value: HinhThucRegistration.TangCaTrucDon, label: 'Tăng ca trực đơn' },
        { value: HinhThucRegistration.TangCaNghiBu, label: 'Tăng ca - nghỉ bù' },
        { value: HinhThucRegistration.SaleonlineTangCaTrucHangTuan, label: 'Saleonline tăng ca trực hàng tuần' },
        { value: HinhThucRegistration.TangCaKhongNhanLuong, label: 'Tăng ca không nhân lương' },
    ],
    [RegistrationType.CongTac]: [
        { value: HinhThucRegistration.CongTacSale, label: 'Công tác sale' },
        { value: HinhThucRegistration.CongTacVanPhong, label: 'Công tác văn phòng' },
    ],
    [RegistrationType.DiTreVeSom]: [
        { value: HinhThucRegistration.ViecCongTy, label: 'Việc công ty (đi trễ / về sớm)' },
        { value: HinhThucRegistration.LamBuTrongThang, label: 'Làm bù trong tháng (đi trễ / về sớm)' },
        { value: HinhThucRegistration.TruLuong, label: 'Trừ lương (đi trễ / về sớm)' },
        { value: HinhThucRegistration.ThieuCheckinCheckout, label: 'Thiếu checkin/checkout (đi trễ / về sớm)' },
    ],
    [RegistrationType.LamViecTaiNha]: [
        { value: HinhThucRegistration.ViecCongTy, label: 'Làm việc tại nhà (WFH)' },
    ],
};

export const DEFAULT_HINH_THUC: Record<number, number> = {
    [RegistrationType.NghiPhep]: HinhThucRegistration.NghiPhepNam,
    [RegistrationType.TangCa]: HinhThucRegistration.TangCaSauGioLam,
    [RegistrationType.CongTac]: HinhThucRegistration.CongTacSale,
    [RegistrationType.DiTreVeSom]: HinhThucRegistration.ViecCongTy,
    [RegistrationType.NghiKhongLuong]: HinhThucRegistration.NghiKhongLuong,
    [RegistrationType.LamViecTaiNha]: HinhThucRegistration.ViecCongTy,
};
