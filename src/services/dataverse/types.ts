/**
 * Shared types and enums for Dataverse services
 */

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

// Interface cho data từ Dataverse
export interface DataverseChamCong {
    crdfd_bangchamconghangngayid: string;
    crdfd_ngay: string;
    crdfd_checkin?: string;
    crdfd_checkout?: string;
    registration?: {
        id: string;
        type: number;
        typeName: string;
        hours: number;
        status: string;
    };
    crdfd_sogiolam?: number;
    crdfd_trangthai?: string;
    crdfd_ghichu?: string;
    _crdfd_tennhanvien_value?: string;
    statecode: number;
}

// Interface Phieu Dang Ky
export interface PhieuDangKy {
    crdfd_phieuangkyid: string;
    _crdfd_nhanvien_value: string;
    crdfd_loaiangky: number;
    crdfd_tungay: string;
    crdfd_enngay: string;
    crdfd_sogio2?: number;
    crdfd_diengiai?: string;
    crdfd_captrenduyet?: number;
    crdfd_hinhthuc?: number;
    crdfd_quanlytructiep?: string;
    cr1bb_songay?: number;
    cr1bb_sopheptonnamtruoc?: number;
    new_sophepconlaitoithangthucte?: number;
    statecode: number;
}

export interface TeamRegistration extends PhieuDangKy {
    employeeName: string;
    employeeCode?: string;
}

export interface DNTTRecord {
    cr44a_enghithanhtoanid: string;
    cr1bb_loaihosothanhtoan?: string;
    cr44a_sotien_de_nghi?: number;
    cr1bb_diengiai?: string;
    cr1bb_ngaydukienthanhtoan?: string;
    cr44a_trangthai_denghithanhtoan?: string;
    cr44a_truongbophan?: string;
    cr44a_truongbophan_value?: number;
    cr44a_ketoanthanhtoan?: string;
    cr44a_ketoantonghop?: string;
    _ownerid_value?: string;
    ownerName?: string;
    createdon?: string;
    statecode: number;
}

export interface TransactionSales {
    crdfd_transactionsalesid: string;
    crdfd_maphieuxuat?: string;
    _crdfd_idchitietonhang_value?: string;
    crdfd_idchitietonhang_name?: string;
    crdfd_tensanphamtex?: string;
    crdfd_soluonggiaotheokho?: number;
    crdfd_onvitheokho?: string;
    crdfd_ngaygiaothucte?: string;
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

export interface TransactionBuy {
    crdfd_transactionbuyid: string;
    crdfd_name?: string;
    crdfd_masp?: string;
    crdfd_tensanpham?: string;
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

export interface InventoryCheckItem {
    crdfd_kho_binh_dinhid: string;
    productName: string;
    productCode: string;
    productId?: string;
    warehouseLocation: string;
    tonKhoThucTe: number;
    tonKhoLyThuyet: number;
    tonKhaDung: number;
    hangLoiSauKiem: number;
    tongTonKho: number;
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

export interface InventoryHistoryExtendedRecord extends InventoryHistoryRecord {
    originalData?: unknown;
    quantityReturn?: number;
}

export interface InventoryHistorySummary {
    totalImport: number;
    totalExport: number;
    totalReturnSale: number;
    totalReturnBuy: number;
    totalBalance: number;
    currentStock: number;
}

