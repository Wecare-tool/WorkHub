import React, { useMemo } from 'react';
import { TeamRegistration, ApprovalStatus } from '../services/dataverse';

interface LeaveStatsProps {
    registrations: TeamRegistration[];
}

export const LeaveStats: React.FC<LeaveStatsProps> = React.memo(({ registrations }) => {
    const stats = useMemo(() => {
        const total = registrations.length;
        const pending = registrations.filter(r => r.crdfd_captrenduyet === ApprovalStatus.ChuaDuyet).length;
        const approved = registrations.filter(r => r.crdfd_captrenduyet === ApprovalStatus.DaDuyet).length;
        const rejected = registrations.filter(r => r.crdfd_captrenduyet === ApprovalStatus.TuChoi).length;

        // Group by Type
        const byType: Record<string, number> = {};
        registrations.forEach(r => {
            const typeName = getTypeName(r.crdfd_loaiangky);
            byType[typeName] = (byType[typeName] || 0) + 1;
        });

        return { total, pending, approved, rejected, byType };
    }, [registrations]);

    // Helper to get type name (duplicated from service or move to types)
    // For now simple map here or import if exported. 
    // It was exported effectively via 'getRegistrationTypeName' in service but not exported function.
    // Let's just hardcode or user the one in service if possible. 
    // I'll assume I can duplicate or move it. I'll rely on what's available or simple switch.

    return (
        <div className="stats-grid">
            <div className="stat-card pending">
                <h3>Chờ duyệt</h3>
                <div className="value">{stats.pending}</div>
            </div>
            <div className="stat-card approved">
                <h3>Đã duyệt</h3>
                <div className="value">{stats.approved}</div>
            </div>
            <div className="stat-card">
                <h3>Tổng phiếu</h3>
                <div className="value">{stats.total}</div>
            </div>

            <div className="stat-card list">
                <h3>Theo loại</h3>
                <ul className="stat-list">
                    {Object.entries(stats.byType).map(([name, count]) => (
                        <li key={name}>
                            <span>{name}</span>
                            <strong>{count}</strong>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
});

function getTypeName(type: number): string {
    switch (type) {
        case 191920000: return "Nghỉ phép";
        case 191920001: return "Làm việc tại nhà";
        case 191920002: return "Tăng ca";
        case 191920003: return "Công tác";
        case 191920004: return "Đi trễ / Về sớm";
        case 283640001: return "Nghỉ không lương";
        default: return "Khác";
    }
}
