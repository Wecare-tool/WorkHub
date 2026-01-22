import React from 'react';
import { TeamRegistration, ApprovalStatus } from '../services/dataverse';

interface LeaveListProps {
    registrations: TeamRegistration[];
    onSelect: (reg: TeamRegistration) => void;
}

export const LeaveList: React.FC<LeaveListProps> = ({ registrations, onSelect }) => {
    return (
        <div className="leave-list-container list-view-container">
            <div className="list-view-header">
                <div className="list-view-toolbar">
                    <h3 className="list-view-count">Danh sách phiếu đăng ký</h3>
                </div>
            </div>

            <div className="list-view-table-wrapper">
                <table className="list-view-table">
                    <thead>
                        <tr>
                            <th>Nhân viên</th>
                            <th>Loại</th>
                            <th>Thời gian</th>
                            <th>Lý do</th>
                            <th>Trạng thái</th>
                            <th style={{ width: '40px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {registrations.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="list-view-empty-state">
                                    Không có dữ liệu
                                </td>
                            </tr>
                        ) : (
                            registrations.map((reg) => (
                                <tr key={reg.crdfd_phieuangkyid} onClick={() => onSelect(reg)} className="clickable-row">
                                    <td>
                                        <div className="font-medium">{reg.employeeName}</div>
                                        <div className="text-sm text-muted">{reg.employeeCode}</div>
                                    </td>
                                    <td>{getTypeName(reg.crdfd_loaiangky)}</td>
                                    <td>
                                        <div>{formatDate(reg.crdfd_tungay)}</div>
                                        {reg.crdfd_tungay !== reg.crdfd_enngay && (
                                            <div className="text-sm text-muted">→ {formatDate(reg.crdfd_enngay)}</div>
                                        )}
                                        {reg.crdfd_sogio2 && reg.crdfd_sogio2 > 0 && (
                                            <div className="text-xs badge" style={{ marginTop: '0.25rem', display: 'inline-block' }}>{reg.crdfd_sogio2} giờ</div>
                                        )}
                                    </td>
                                    <td className="note-cell">{reg.crdfd_diengiai}</td>
                                    <td>
                                        <span className={`status-badge ${getStatusClass(reg.crdfd_captrenduyet)}`}>
                                            {getStatusText(reg.crdfd_captrenduyet)}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="btn-icon">👁️</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

function getTypeName(type: number): string {
    switch (type) {
        case 191920000: return "Nghỉ phép";
        case 191920001: return "Làm ở nhà";
        case 191920002: return "Tăng ca";
        case 191920003: return "Công tác";
        case 191920004: return "Đi trễ/Về sớm";
        case 283640001: return "Nghỉ không lương";
        default: return "Khác";
    }
}

function getStatusText(status?: number): string {
    switch (status) {
        case ApprovalStatus.ChuaDuyet: return "Chờ duyệt";
        case ApprovalStatus.DaDuyet: return "Đã duyệt";
        case ApprovalStatus.TuChoi: return "Từ chối";
        default: return "Chờ duyệt";
    }
}

function getStatusClass(status?: number): string {
    switch (status) {
        case ApprovalStatus.ChuaDuyet: return "status-pending";
        case ApprovalStatus.DaDuyet: return "status-approved";
        case ApprovalStatus.TuChoi: return "status-rejected";
        default: return "status-pending";
    }
}

function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN');
}
