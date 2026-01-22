import React, { useEffect, useState, useCallback } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { fetchPersonalRegistrations, fetchDNTTRecords, fetchEmployeeCode, fetchSubjectId, getAccessToken, TeamRegistration, DNTTRecord, getApprovalStatusText, updateDNTTStatus } from '../services/dataverse';
import { LeaveDetailModal } from './LeaveDetailModal';

interface LeaveDashboardProps {
    employeeId: string | null;
    year: number;
    month: number;
}

export const LeaveDashboard: React.FC<LeaveDashboardProps> = ({ employeeId, year, month }) => {
    const { instance, accounts } = useMsal();
    const isAuthenticated = useIsAuthenticated();

    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'registration' | 'dntt'>('registration');
    const [registrations, setRegistrations] = useState<TeamRegistration[]>([]);
    const [dnttRecords, setDnttRecords] = useState<DNTTRecord[]>([]);

    // Cache subjectId to avoid re-fetching
    const [subjectId, setSubjectId] = useState<string | null>(null);

    // Load data with month/year filter
    const loadData = useCallback(async () => {
        if (!isAuthenticated || !accounts[0] || !employeeId) return;

        setLoading(true);
        try {
            const token = await getAccessToken(instance, accounts[0]);

            // 1. Fetch Personal Registrations (Always)
            const regPromise = fetchPersonalRegistrations(token, employeeId, year, month);

            // 2. Fetch DNTT Records (Need Subject ID)
            let dnttPromise: Promise<DNTTRecord[]> = Promise.resolve([]);

            let currentSubjectId = subjectId;

            // If we don't have subjectId yet, fetch it chain: EmployeeID -> Code -> SubjectID
            if (!currentSubjectId) {
                const code = await fetchEmployeeCode(token, employeeId);
                // console.log("Employee Code:", code);
                if (code) {
                    const sid = await fetchSubjectId(token, code);
                    // console.log("Subject ID:", sid);
                    if (sid) {
                        setSubjectId(sid);
                        currentSubjectId = sid;
                    }
                }
            }

            if (currentSubjectId) {
                dnttPromise = fetchDNTTRecords(token, currentSubjectId, year, month);
            }

            const [regData, dnttData] = await Promise.all([regPromise, dnttPromise]);

            setRegistrations(regData);
            setDnttRecords(dnttData);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, accounts, instance, employeeId, year, month, subjectId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const formatCurrency = (amount?: number) => {
        if (!amount) return '-';
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const getRegistrationTypeName = (type: number): string => {
        switch (type) {
            case 191920000: return "Nghỉ phép";
            case 191920001: return "Làm việc tại nhà (WFH)";
            case 191920002: return "Tăng ca";
            case 191920003: return "Công tác";
            case 191920004: return "Đi trễ / Về sớm";
            case 283640001: return "Nghỉ không lương";
            default: return "Khác";
        }
    };

    const getStatusClass = (status?: number): string => {
        switch (status) {
            case 191920000: return "status-pending";
            case 191920001: return "status-approved";
            case 191920002: return "status-rejected";
            default: return "status-pending";
        }
    };

    // Modal State
    const [selectedItem, setSelectedItem] = useState<TeamRegistration | DNTTRecord | null>(null);
    const [selectedType, setSelectedType] = useState<'registration' | 'dntt' | null>(null);

    const closeModal = () => {
        setSelectedItem(null);
        setSelectedType(null);
    };

    const handleRowClick = (item: TeamRegistration | DNTTRecord, type: 'registration' | 'dntt') => {
        setSelectedItem(item);
        setSelectedType(type);
    };

    // Handle DNTT field update
    const [updating, setUpdating] = useState(false);
    const handleDNTTFieldChange = async (fieldName: string, value: number | null) => {
        if (!selectedItem || !accounts[0]) return;
        const dnttRecord = selectedItem as DNTTRecord;
        setUpdating(true);
        try {
            const token = await getAccessToken(instance, accounts[0]);
            const success = await updateDNTTStatus(token, dnttRecord.cr44a_enghithanhtoanid, fieldName, value);
            if (success) {
                // Refresh data
                await loadData();
                // Close modal
                closeModal();
            } else {
                alert('Cập nhật thất bại!');
            }
        } catch (e) {
            console.error('Error updating DNTT:', e);
            alert('Đã xảy ra lỗi!');
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="leave-dashboard list-view-container">
            {/* Unified Header */}
            <div className="list-view-header">
                <div className="list-view-toolbar">
                    <button
                        className={`tab-btn ${activeTab === 'registration' ? 'active' : ''}`}
                        onClick={() => setActiveTab('registration')}
                    >
                        📋 Phiếu đăng ký ({registrations.length})
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'dntt' ? 'active' : ''}`}
                        onClick={() => setActiveTab('dntt')}
                    >
                        💰 DNTT ({dnttRecords.length})
                    </button>
                </div>

                <div className="list-view-actions">
                    {activeTab === 'registration' && (
                        <a
                            href="https://wecare-ii.crm5.dynamics.com/main.aspx?appid=7c0ada0d-cf0d-f011-998a-6045bd1cb61e&newWindow=true&pagetype=entitylist&etn=crdfd_phieuangky&viewid=ec3c56bb-5723-4663-b1d7-a9c741ff27bd&viewType=1039"
                            target="_blank"
                            rel="noreferrer"
                            className="external-link-icon"
                            title="Mở trong Dynamics 365"
                        >
                            🔗
                        </a>
                    )}
                    {activeTab === 'dntt' && (
                        <a
                            href="https://wecare-ii.crm5.dynamics.com/main.aspx?appid=d6bc8d55-f810-f011-998a-6045bd1bb1cd&pagetype=entitylist&etn=cr44a_enghithanhtoan&viewid=1d9ecf7f-47b3-ee11-a568-000d3aa3f582&viewType=1039"
                            target="_blank"
                            rel="noreferrer"
                            className="external-link-icon"
                            title="Mở DNTT trong Dynamics 365"
                        >
                            🔗
                        </a>
                    )}
                </div>
            </div>

            {!employeeId && (
                <div className="list-view-empty-state">
                    <p>Vui lòng đăng nhập để xem phiếu đăng ký.</p>
                </div>
            )}

            {loading ? (
                <div className="list-view-empty-state">
                    <div className="spinner"></div>
                    <p>Đang tải dữ liệu...</p>
                </div>
            ) : (
                <div className="list-view-table-wrapper">
                    {/* Registration Tab */}
                    {activeTab === 'registration' && (
                        <>
                            {registrations.length === 0 ? (
                                <div className="list-view-empty-state">
                                    <p>Chưa có phiếu đăng ký nào trong tháng này.</p>
                                </div>
                            ) : (
                                <table className="list-view-table">
                                    <thead>
                                        <tr>
                                            <th>Loại</th>
                                            <th>Từ ngày</th>
                                            <th>Đến ngày</th>
                                            <th className="text-right">Số giờ</th>
                                            <th>Lý do</th>
                                            <th>Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {registrations.map((reg) => (
                                            <tr key={reg.crdfd_phieuangkyid} onClick={() => handleRowClick(reg, 'registration')}>
                                                <td className="font-medium">{getRegistrationTypeName(reg.crdfd_loaiangky)}</td>
                                                <td>{formatDate(reg.crdfd_tungay)}</td>
                                                <td>{formatDate(reg.crdfd_enngay)}</td>
                                                <td className="text-right">{reg.crdfd_sogio2 || '-'}</td>
                                                <td className="note-cell">{reg.crdfd_diengiai || '-'}</td>
                                                <td>
                                                    <span className={`status-badge ${getStatusClass(reg.crdfd_captrenduyet)}`}>
                                                        {getApprovalStatusText(reg.crdfd_captrenduyet)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </>
                    )}

                    {/* DNTT Tab */}
                    {activeTab === 'dntt' && (
                        <>
                            {dnttRecords.length === 0 ? (
                                <div className="list-view-empty-state">
                                    <p>Chưa có đề nghị thanh toán nào trong tháng này.</p>
                                </div>
                            ) : (
                                <table className="list-view-table">
                                    <thead>
                                        <tr>
                                            <th>Loại hồ sơ</th>
                                            <th className="text-right">Số tiền</th>
                                            <th>Diễn giải</th>
                                            <th>Ngày tạo</th>
                                            <th>Trạng thái</th>
                                            <th>Người tạo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dnttRecords.map((dntt) => (
                                            <tr key={dntt.cr44a_enghithanhtoanid} onClick={() => handleRowClick(dntt, 'dntt')}>
                                                <td>
                                                    <span className="badge-reg-type">{dntt.cr1bb_loaihosothanhtoan || '-'}</span>
                                                </td>
                                                <td className="amount-cell text-right">
                                                    {formatCurrency(dntt.cr44a_sotien_de_nghi)}
                                                </td>
                                                <td>{dntt.cr1bb_diengiai || '-'}</td>
                                                <td>
                                                    {formatDate(dntt.createdon)}
                                                </td>
                                                <td>
                                                    <span className={`status-badge ${dntt.cr44a_trangthai_denghithanhtoan === 'Đã duyệt' ? 'status-approved' :
                                                        dntt.cr44a_trangthai_denghithanhtoan === 'Từ chối duyệt' ? 'status-rejected' : 'status-pending'}`}>
                                                        {dntt.cr44a_trangthai_denghithanhtoan || 'N/A'}
                                                    </span>
                                                </td>
                                                <td>{dntt.ownerName || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Detail Modal */}
            {selectedItem && (
                selectedType === 'registration' ? (
                    <LeaveDetailModal
                        registration={selectedItem as TeamRegistration}
                        onClose={closeModal}
                        onUpdateSuccess={(updatedItem) => {
                            // Optimistic update
                            setRegistrations(prev => prev.map(item =>
                                item.crdfd_phieuangkyid === updatedItem.crdfd_phieuangkyid ? updatedItem : item
                            ));

                            // Background refresh to ensure data consistency
                            loadData();
                            closeModal();
                        }}
                    />
                ) : (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>Chi tiết đề nghị thanh toán</h3>
                                <button className="close-modal-btn" onClick={closeModal}>&times;</button>
                            </div>
                            <div className="modal-body">
                                <div className="detail-field">
                                    <label className="detail-label">Loại hồ sơ</label>
                                    <div className="detail-value highlight">
                                        {(selectedItem as DNTTRecord).cr1bb_loaihosothanhtoan || '-'}
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="detail-field">
                                        <label className="detail-label">Số tiền đề nghị</label>
                                        <div className="detail-value highlight" style={{ color: 'var(--success)' }}>
                                            {formatCurrency((selectedItem as DNTTRecord).cr44a_sotien_de_nghi)}
                                        </div>
                                    </div>
                                    <div className="detail-field">
                                        <label className="detail-label">Người đề nghị</label>
                                        <div className="detail-value">{(selectedItem as DNTTRecord).ownerName || '-'}</div>
                                    </div>
                                </div>
                                <div className="detail-field">
                                    <label className="detail-label">Diễn giải</label>
                                    <div className="detail-value">{(selectedItem as DNTTRecord).cr1bb_diengiai || '-'}</div>
                                </div>
                                <div className="detail-field">
                                    <label className="detail-label">Ngày tạo</label>
                                    <div className="detail-value">{formatDate((selectedItem as DNTTRecord).createdon)}</div>
                                </div>
                                <div className="detail-field">
                                    <label className="detail-label">Trạng thái đề nghị</label>
                                    <div className="detail-value">
                                        <span className={`status-badge ${(selectedItem as DNTTRecord).cr44a_trangthai_denghithanhtoan === 'Đã duyệt' ? 'status-approved' :
                                            (selectedItem as DNTTRecord).cr44a_trangthai_denghithanhtoan === 'Từ chối duyệt' ? 'status-rejected' : 'status-pending'}`}>
                                            {(selectedItem as DNTTRecord).cr44a_trangthai_denghithanhtoan || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                                <div className="detail-field">
                                    <label className="detail-label">Trưởng bộ phận</label>
                                    <div className="detail-value">
                                        <select
                                            className="status-select"
                                            aria-label="Trưởng bộ phận duyệt"
                                            value={(selectedItem as DNTTRecord).cr44a_truongbophan_value ?? ''}
                                            onChange={(e) => handleDNTTFieldChange('cr44a_truongbophan', e.target.value ? parseInt(e.target.value) : null)}
                                            disabled={updating}
                                        >
                                            <option value="">-- Chọn --</option>
                                            <option value="191920000">Chưa duyệt</option>
                                            <option value="191920001">Đã duyệt</option>
                                            <option value="191920002">Từ chối</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="detail-field">
                                    <label className="detail-label">Kế toán tổng hợp</label>
                                    <div className="detail-value">
                                        {(selectedItem as DNTTRecord).cr44a_ketoantonghop || '-'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            )}
        </div>
    );
};
