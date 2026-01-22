import React, { useState, useEffect } from 'react';
import { TeamRegistration, updatePhieuDangKy, RegistrationType, ApprovalStatus, getAccessToken } from '../services/dataverse';
import { useMsal } from '@azure/msal-react';
import { Save } from 'lucide-react';

interface LeaveDetailModalProps {
    registration: TeamRegistration;
    onClose: () => void;
    onUpdateSuccess: (updatedRegistration: TeamRegistration) => void;
}

export const LeaveDetailModal: React.FC<LeaveDetailModalProps> = ({ registration, onClose, onUpdateSuccess }) => {
    const { instance, accounts } = useMsal();
    const [processing, setProcessing] = useState(false);

    // Initialize form data directly from props
    const [editData, setEditData] = useState({
        type: registration.crdfd_loaiangky,
        startDate: registration.crdfd_tungay ? registration.crdfd_tungay.substring(0, 16) : '',
        endDate: registration.crdfd_enngay ? registration.crdfd_enngay.substring(0, 16) : '',
        hours: registration.crdfd_sogio2 || 0,
        reason: registration.crdfd_diengiai || '',
        quanLyTructiep: registration.crdfd_quanlytructiep || '',
        capTrenDuyet: registration.crdfd_captrenduyet || ApprovalStatus.ChuaDuyet,
        hinhThuc: registration.crdfd_hinhthuc || '',
        soNgay: registration.cr1bb_songay || 0
    });

    // Update form data if registration prop changes
    useEffect(() => {
        setEditData({
            type: registration.crdfd_loaiangky,
            startDate: registration.crdfd_tungay ? registration.crdfd_tungay.substring(0, 16) : '',
            endDate: registration.crdfd_enngay ? registration.crdfd_enngay.substring(0, 16) : '',
            hours: registration.crdfd_sogio2 || 0,
            reason: registration.crdfd_diengiai || '',
            quanLyTructiep: registration.crdfd_quanlytructiep || '',
            capTrenDuyet: registration.crdfd_captrenduyet || ApprovalStatus.ChuaDuyet,
            hinhThuc: registration.crdfd_hinhthuc || '',
            soNgay: registration.cr1bb_songay || 0
        });
    }, [registration]);

    const handleSave = async () => {
        if (!accounts[0]) return;
        setProcessing(true);
        try {
            const token = await getAccessToken(instance, accounts[0]);
            const success = await updatePhieuDangKy(token, registration.crdfd_phieuangkyid, {
                type: editData.type,
                startDate: editData.startDate,
                endDate: editData.endDate,
                hours: Number(editData.hours),
                reason: editData.reason,
                quanLyTructiep: editData.quanLyTructiep,
                capTrenDuyet: Number(editData.capTrenDuyet),
                hinhThuc: editData.hinhThuc ? Number(editData.hinhThuc) : undefined,
                soNgay: Number(editData.soNgay)
            });

            if (success) {
                onUpdateSuccess({
                    ...registration,
                    crdfd_loaiangky: editData.type,
                    crdfd_tungay: editData.startDate,
                    crdfd_enngay: editData.endDate,
                    crdfd_sogio2: Number(editData.hours),
                    crdfd_diengiai: editData.reason,
                    crdfd_quanlytructiep: editData.quanLyTructiep,
                    crdfd_captrenduyet: Number(editData.capTrenDuyet),
                    crdfd_hinhthuc: editData.hinhThuc ? Number(editData.hinhThuc) : undefined,
                    cr1bb_songay: Number(editData.soNgay)
                });
                onClose();
            } else {
                alert("Có lỗi xảy ra khi cập nhật!");
            }
        } catch (e) {
            console.error(e);
            alert("Lỗi kết nối!");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content modal-content-expanded flex flex-col overflow-hidden">
                <div className="modal-header shrink-0">
                    <h2>Chi tiết phiếu đăng ký</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-body p-5">
                    <div className="modal-grid-2">
                        {/* Panel trái - Thời gian & Loại hình */}
                        <div className="modal-panel modal-panel-left">
                            <div className="form-group">
                                <label className="block text-xs font-medium text-zinc-500 mb-1">Loại đăng ký</label>
                                <select
                                    className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-2 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                                    value={editData.type}
                                    title="Loại đăng ký"
                                    onChange={e => setEditData({ ...editData, type: Number(e.target.value) })}
                                >
                                    <option value={RegistrationType.NghiPhep}>Nghỉ phép</option>
                                    <option value={RegistrationType.DiTreVeSom}>Đi trễ / Về sớm</option>
                                    <option value={RegistrationType.LamViecTaiNha}>Làm việc tại nhà</option>
                                    <option value={RegistrationType.TangCa}>Tăng ca</option>
                                    <option value={RegistrationType.CongTac}>Công tác</option>
                                    <option value={RegistrationType.NghiKhongLuong}>Nghỉ không lương</option>
                                </select>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Từ ngày</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-2 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                                        value={editData.startDate}
                                        title="Từ ngày"
                                        onChange={e => setEditData({ ...editData, startDate: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Đến ngày</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-2 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                                        value={editData.endDate}
                                        title="Đến ngày"
                                        onChange={e => setEditData({ ...editData, endDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Số giờ</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-2 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                                        value={editData.hours}
                                        title="Số giờ"
                                        onChange={e => setEditData({ ...editData, hours: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Số ngày</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-2 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                                        value={editData.soNgay}
                                        title="Số ngày"
                                        onChange={e => setEditData({ ...editData, soNgay: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            {editData.type !== RegistrationType.NghiPhep && (
                                <div className="form-group">
                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Hình thức</label>
                                    <input
                                        type="text"
                                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-2 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                                        value={editData.hinhThuc}
                                        placeholder="Nhập hình thức..."
                                        onChange={e => setEditData({ ...editData, hinhThuc: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Panel phải - Phê duyệt & Ghi chú */}
                        <div className="modal-panel">
                            <div className="form-group">
                                <label className="block text-xs font-medium text-zinc-500 mb-1">Quản lý trực tiếp</label>
                                <input
                                    type="text"
                                    className="w-full bg-zinc-800/30 border border-zinc-700/30 rounded-lg p-2 text-sm text-zinc-400 focus:outline-none cursor-not-allowed"
                                    value={editData.quanLyTructiep}
                                    readOnly
                                    title="Quản lý trực tiếp (Chỉ đọc)"
                                />
                            </div>

                            <div className="form-group">
                                <label className="block text-xs font-medium text-zinc-500 mb-1">Cấp trên duyệt</label>
                                <select
                                    className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-2 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                                    value={editData.capTrenDuyet}
                                    title="Cấp trên duyệt"
                                    onChange={e => setEditData({ ...editData, capTrenDuyet: Number(e.target.value) })}
                                >
                                    <option value={ApprovalStatus.ChuaDuyet}>Chưa duyệt</option>
                                    <option value={ApprovalStatus.DaDuyet}>Đã duyệt</option>
                                    <option value={ApprovalStatus.TuChoi}>Từ chối</option>
                                </select>
                            </div>

                            <div className="form-group flex-1 flex flex-col">
                                <label className="block text-xs font-medium text-zinc-500 mb-1">Lý do / Diễn giải</label>
                                <textarea
                                    className="w-full flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-2 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-none"
                                    value={editData.reason}
                                    title="Lý do"
                                    onChange={e => setEditData({ ...editData, reason: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="modal-footer flex justify-center items-center bg-zinc-900/50 p-6 rounded-b-2xl border-t border-zinc-800">
                    <button
                        className="btn btn-primary w-full sm:w-64 flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl transition-all font-bold shadow-lg shadow-indigo-500/20"
                        onClick={handleSave}
                        disabled={processing}
                    >
                        {processing ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Đang lưu...
                            </>
                        ) : (
                            <>
                                <Save size={20} /> Lưu thông tin
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
