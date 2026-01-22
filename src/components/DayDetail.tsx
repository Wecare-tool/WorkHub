import { useState, useEffect, FC, Dispatch, SetStateAction } from 'react';
import { useMsal } from '@azure/msal-react';
import { DayRecord } from '../types/types';
import { getStandardHours, getTimeFromISO, calculateActualHours } from '../utils/workUtils';
import {
    RegistrationType,
    ApprovalStatus,
    createPhieuDangKy,
    getAccessToken,
    updateChamCongTime
} from '../services/dataverse';
import { HINH_THUC_MAP, DEFAULT_HINH_THUC, REGISTRATION_TYPES } from '../constants/registrationConstants';

interface DayDetailProps {
    record: DayRecord | null;
    onClose: () => void;
    employeeId: string | null;
    onSaveSuccess: () => void;
}

export const DayDetail: FC<DayDetailProps> = ({ record, onClose, employeeId, onSaveSuccess }) => {
    const { instance, accounts } = useMsal();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const [formData, setFormData] = useState({
        type: RegistrationType.NghiPhep,
        startDate: '',
        endDate: '',
        hours: 8,
        approvalStatus: ApprovalStatus.ChuaDuyet,
        reason: '',
        hinhThuc: DEFAULT_HINH_THUC[RegistrationType.NghiPhep]
    });

    const [checkInTime, setCheckInTime] = useState('');
    const [checkOutTime, setCheckOutTime] = useState('');
    const [soGioLam, setSoGioLam] = useState<number>(0);
    const [ghiChu, setGhiChu] = useState('');
    const [isTimeChanged, setIsTimeChanged] = useState(false);

    useEffect(() => {
        if (record) {
            setFormData(prev => ({
                ...prev,
                startDate: `${record.date}T08:00`,
                endDate: `${record.date}T17:00`
            }));
            setCheckInTime(getTimeFromISO(record.checkIn));
            setCheckOutTime(getTimeFromISO(record.checkOut));
            setSoGioLam(record.sogiolam ?? record.hoursWorked ?? 0);
            setGhiChu(record.note || '');
            setIsTimeChanged(false);
        }
    }, [record]);

    if (!record) return null;

    const [y, m, d] = record.date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay();
    const standardHours = getStandardHours(dayOfWeek);

    const isInsufficient = record.hoursWorked < standardHours &&
        !['leave', 'off', 'holiday'].includes(record.status) &&
        standardHours > 0;

    const formatDisplayDate = (dateStr: string): string => {
        const parts = dateStr.split('-').map(Number);
        const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
        return dObj.toLocaleDateString('vi-VN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const handleFieldChange = (setter: Dispatch<SetStateAction<any>>, value: any) => {
        setter(value);
        setIsTimeChanged(true);
    };

    const handleTimeChange = (type: 'in' | 'out', value: string) => {
        const newIn = type === 'in' ? value : checkInTime;
        const newOut = type === 'out' ? value : checkOutTime;

        if (type === 'in') setCheckInTime(value);
        else setCheckOutTime(value);

        setSoGioLam(calculateActualHours(newIn, newOut, standardHours));
        setIsTimeChanged(true);
    };

    const resetTime = (type: 'in' | 'out') => {
        if (type === 'in') setCheckInTime(getTimeFromISO(record.checkIn));
        else setCheckOutTime(getTimeFromISO(record.checkOut));
    };

    const handleSaveTime = async () => {
        if (!record.recordId) return;

        setIsSubmitting(true);
        try {
            const token = await getAccessToken(instance, accounts[0]);

            const toISO = (timeStr: string) => {
                if (!timeStr) return undefined;
                try {
                    return new Date(`${record.date}T${timeStr}:00`).toISOString();
                } catch (e) {
                    return timeStr;
                }
            };

            const success = await updateChamCongTime(
                token,
                record.recordId,
                toISO(checkInTime),
                toISO(checkOutTime),
                soGioLam,
                ghiChu
            );

            if (success) {
                setIsTimeChanged(false);
                onSaveSuccess();
            }
        } catch (e) {
            console.error("Save error:", e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateRegistration = async () => {
        if (!employeeId || !formData.startDate || !formData.endDate) {
            alert("Vui lòng nhập đầy đủ thông tin!");
            return;
        }

        setIsSubmitting(true);
        try {
            const token = await getAccessToken(instance, accounts[0]);
            const payload = {
                ...formData,
                startDate: new Date(formData.startDate).toISOString(),
                endDate: new Date(formData.endDate).toISOString()
            };
            const success = await createPhieuDangKy(token, employeeId, payload);
            if (success) {
                alert("Đăng ký thành công!");
                onSaveSuccess();
                onClose();
            }
        } catch (e: any) {
            console.error("Registration error:", e);
            alert("Lỗi hệ thống: " + (e.message || ""));
        } finally {
            setIsSubmitting(false);
        }
    };

    const registrationOptions = REGISTRATION_TYPES.map(t => (
        <option key={t.value} value={t.value}>{t.label}</option>
    ));

    const hinhThucOptions = (HINH_THUC_MAP[formData.type] || []).map(h => (
        <option key={h.value} value={h.value}>{h.label}</option>
    ));

    return (
        <div className="day-detail-overlay" onClick={onClose}>
            <div className={`day-detail ${isCreating ? 'expanded' : ''}`} onClick={(e) => e.stopPropagation()}>
                <div className="day-detail-layout">
                    <div className="day-detail-left">
                        <div className="day-detail-header">
                            <h3>📅 Chi tiết ngày công</h3>
                            {!isCreating && <button className="close-btn" onClick={onClose}>✕</button>}
                        </div>

                        <div className="day-detail-content">
                            <div className="detail-row">
                                <span className="detail-label">📆 Ngày:</span>
                                <span className="detail-value">{formatDisplayDate(record.date)}</span>
                            </div>

                            <div className="detail-row">
                                <span className="detail-label">🎯 Công chuẩn:</span>
                                <span className="detail-value">{standardHours} giờ</span>
                            </div>

                            <div className="detail-row detail-row-border">
                                <span className="detail-label">⏱️ Số giờ làm:</span>
                                <div className="day-time-row">
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="day-hours-input"
                                        value={soGioLam}
                                        title="Số giờ làm"
                                        onChange={(e) => handleFieldChange(setSoGioLam, parseFloat(e.target.value) || 0)}
                                    />
                                    <span className="opacity-80-bold">giờ</span>
                                </div>
                            </div>

                            <div className="detail-row detail-row-column">
                                <span className="detail-label">🗒️ Ghi chú:</span>
                                <textarea
                                    className="day-note-area"
                                    value={ghiChu}
                                    title="Ghi chú"
                                    onChange={(e) => handleFieldChange(setGhiChu, e.target.value)}
                                    placeholder="Thêm ghi chú công việc..."
                                />
                            </div>

                            <div className="day-time-section">
                                <div className="day-time-row m-bottom-12">
                                    <span className="day-time-info-text">🕒 Khoảng thời gian Check In/Out:</span>
                                </div>

                                <div className="detail-row m-bottom-8">
                                    <span className="detail-label">📥 Check In:</span>
                                    <div className="time-input-container">
                                        <input
                                            type="time"
                                            className="time-edit-input"
                                            value={checkInTime}
                                            title="Check In"
                                            onChange={(e) => handleTimeChange('in', e.target.value)}
                                        />
                                        <button className="quick-time-btn clear" title="Khôi phục" onClick={() => resetTime('in')}>↺</button>
                                    </div>
                                </div>

                                <div className="detail-row">
                                    <span className="detail-label">📤 Check Out:</span>
                                    <div className="time-input-container">
                                        <input
                                            type="time"
                                            className="time-edit-input"
                                            value={checkOutTime}
                                            title="Check Out"
                                            onChange={(e) => handleTimeChange('out', e.target.value)}
                                        />
                                        <button className="quick-time-btn clear" title="Khôi phục" onClick={() => resetTime('out')}>↺</button>
                                    </div>
                                </div>
                            </div>

                            {(isTimeChanged || record.note !== ghiChu) && (
                                <div className="detail-actions m-top-10">
                                    <button
                                        className="save-time-btn"
                                        onClick={handleSaveTime}
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? 'Đang lưu...' : '💾 Lưu thay đổi'}
                                    </button>
                                </div>
                            )}

                            {isInsufficient && (
                                <div className="warning-box m-top-12">
                                    <div className="insufficient-header">
                                        ⚠️ Thiếu {standardHours - record.hoursWorked} giờ công chuẩn
                                    </div>
                                    {!record.registration && !isCreating && (
                                        <div className="action-hint">👉 Click bên dưới để đăng ký bù.</div>
                                    )}
                                </div>
                            )}

                            {record.registration && (
                                <div className="registration-info">
                                    <h4>📋 Thông tin đăng ký</h4>
                                    <div className="detail-row">
                                        <span className="detail-label">Loại:</span>
                                        <span className="detail-value">{record.registration.typeName}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Trạng thái:</span>
                                        <span className={`status-badge ${record.registration.status?.includes('Duyệt') ? 'status-approved' : 'status-pending'}`}>
                                            {record.registration.status}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {!isCreating && !record.registration && (
                                <div className="action-row">
                                    <button className="create-reg-btn" onClick={() => setIsCreating(true)}>
                                        📝 Tạo phiếu đăng ký mới
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {isCreating && (
                        <div className="day-detail-right">
                            <div className="day-detail-header">
                                <h3>📝 Đăng ký mới</h3>
                                <button className="close-btn" onClick={onClose}>✕</button>
                            </div>

                            <div className="registration-form-content">
                                <div className="form-group">
                                    <label>Loại đăng ký:</label>
                                    <select
                                        className="day-registration-select"
                                        value={formData.type}
                                        title="Loại đăng ký"
                                        onChange={(e) => {
                                            const type = parseInt(e.target.value);
                                            setFormData(prev => ({
                                                ...prev,
                                                type,
                                                hinhThuc: DEFAULT_HINH_THUC[type]
                                            }));
                                        }}
                                    >
                                        {registrationOptions}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Hình thức:</label>
                                    <select
                                        className="day-registration-select"
                                        value={formData.hinhThuc}
                                        title="Hình thức đăng ký"
                                        onChange={(e) => setFormData(prev => ({ ...prev, hinhThuc: parseInt(e.target.value) }))}
                                    >
                                        {hinhThucOptions}
                                    </select>
                                </div>

                                <div className="form-group-row">
                                    <div className="form-group">
                                        <label>Từ:</label>
                                        <input
                                            type="datetime-local"
                                            value={formData.startDate}
                                            title="Ngày bắt đầu"
                                            onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Đến:</label>
                                        <input
                                            type="datetime-local"
                                            value={formData.endDate}
                                            title="Ngày kết thúc"
                                            onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Số giờ:</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={formData.hours}
                                        title="Số giờ"
                                        onChange={(e) => setFormData(prev => ({ ...prev, hours: parseFloat(e.target.value) || 0 }))}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Lý do:</label>
                                    <textarea
                                        className="day-note-area registration-textarea"
                                        value={formData.reason}
                                        title="Lý do"
                                        onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                                        placeholder="Lý do chi tiết..."
                                    />
                                </div>

                                <div className="form-actions">
                                    <button className="submit-btn" onClick={handleCreateRegistration} disabled={isSubmitting}>
                                        {isSubmitting ? 'Đang gửi...' : '🚀 Gửi đăng ký'}
                                    </button>
                                    <button className="cancel-btn" onClick={() => setIsCreating(false)}>Hủy</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
