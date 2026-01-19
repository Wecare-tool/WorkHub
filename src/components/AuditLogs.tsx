import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

interface AuditLog {
    id: string;
    employee: string;
    modifiedBy: string;
    modifiedOn: string;
    checkIn: string;
    checkOut: string;
    department: string;
}

const GOOGLE_SHEETS_API_KEY = 'AIzaSyAdevMJ2NR7ePdNkHcneWMMA-XtQJgdHU8';
const SPREADSHEET_ID = '1BH3fOY-xclgp5OT1YoWgbDZ4ZkPNS-2fzwLdxoVg60U';
const SHEET_NAME = 'Attendance';
const API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}?key=${GOOGLE_SHEETS_API_KEY}`;

const CRM_BASE_URL = 'https://wecare-ii.crm5.dynamics.com/main.aspx?appid=7c0ada0d-cf0d-f011-998a-6045bd1cb61e&pagetype=entityrecord&etn=crdfd_bangchamconghangngay&id=';

// Helper to parse date string "DD/MM/YYYY : HH:mm:ss" or "DD/MM/YYYY HH:mm:ss" to timestamp
function parseDateLog(dateStr: string): number {
    if (!dateStr) return 0;
    try {
        // Try splitting by " : " first (legacy/original format)
        let parts = dateStr.includes(' : ') ? dateStr.split(' : ') : dateStr.split(' ');

        // If split by space yielded more than 2 parts (e.g. DD/MM/YYYY HH:mm:ss AM/PM or multiple spaces), 
        // we assume the first part is date and second is time. 
        // But for exact format "02/01/2026 04:28:00", split(' ') gives ["02/01/2026", "04:28:00"] which is correct.

        // Fallback for cases where it didn't split well or just date
        const datePart = parts[0];
        const timePart = parts.length > 1 ? parts[1] : '00:00:00';

        const [day, month, year] = datePart.split('/').map(Number);
        const [hours, minutes, seconds] = timePart.split(':').map(Number);

        if (!day || !month || !year) return 0;

        return new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0).getTime();
    } catch (e) {
        return 0;
    }
}

// Map Sheets API rows to AuditLog objects
function mapRowsToLogs(rows: string[][]): AuditLog[] {
    if (!rows || rows.length < 2) return [];

    // Skip header row
    const dataRows = rows.slice(1);

    return dataRows.map((row, index) => {
        return {
            id: row[6] || String(index), // Column 7 is ID (index 6)
            employee: row[0] || '',
            modifiedBy: row[1] || '',
            modifiedOn: row[2] || '',
            checkIn: row[3] || '',
            checkOut: row[4] || '',
            department: row[5] || '',
        };
    }).filter(log => log.employee); // Filter out empty rows
}

export const AuditLogs: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                setLoading(true);
                const response = await fetch(API_URL);
                if (!response.ok) {
                    const errorDetails = await response.json();
                    console.error('Google Sheets API Error:', errorDetails);
                    throw new Error(errorDetails.error?.message || 'Failed to fetch data');
                }
                const data = await response.json();
                const parsedLogs = mapRowsToLogs(data.values);

                // Sort by modifiedOn DESC (newest first)
                parsedLogs.sort((a, b) => parseDateLog(b.modifiedOn) - parseDateLog(a.modifiedOn));

                setLogs(parsedLogs);
            } catch (err: any) {
                console.error('Error fetching audit logs:', err);
                setError(`Lỗi: ${err.message || 'Không thể tải dữ liệu'}`);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, []);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        // Format: DD/MM/YYYY or DD/MM/YYYY : HH:mm:ss
        const parts = dateStr.split(' : ');
        return parts[0]; // Return just the date part
    };

    const formatTime = (dateStr: string) => {
        if (!dateStr) return '-';
        const parts = dateStr.split(' : ');
        return parts[1] || '-'; // Return time part
    };

    const filteredLogs = logs.filter(log => {
        const searchLower = searchTerm.toLowerCase();
        return (
            log.employee.toLowerCase().includes(searchLower) ||
            log.modifiedBy.toLowerCase().includes(searchLower) ||
            log.department.toLowerCase().includes(searchLower) ||
            log.modifiedOn.toLowerCase().includes(searchLower)
        );
    });

    const handleExportExcel = () => {
        try {
            // Prepare data for export
            const exportData = filteredLogs.map(log => ({
                'Nhân viên': log.employee,
                'Người chỉnh sửa': log.modifiedBy,
                'Ngày sửa': log.modifiedOn,
                'Ngày CC': formatDate(log.checkIn),
                'Check-in': formatTime(log.checkIn),
                'Check-out': formatTime(log.checkOut),
                'Phòng ban': log.department
            }));

            // Create worksheet
            const worksheet = XLSX.utils.json_to_sheet(exportData);

            // Create workbook
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Logs');

            // Generate filename with current date
            const date = new Date().toISOString().split('T')[0];
            const fileName = `AuditLogs_${date}.xlsx`;

            // Export file
            XLSX.writeFile(workbook, fileName);
        } catch (err) {
            console.error('Error exporting to Excel:', err);
            alert('Có lỗi xảy ra khi xuất file Excel');
        }
    };

    if (loading) {
        return (
            <div className="audit-logs">
                <div className="leave-list-container">
                    <div className="loading">
                        <div className="spinner"></div>
                        <p>Đang tải dữ liệu...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="audit-logs">
                <div className="leave-list-container">
                    <div className="empty-state">
                        <p>⚠️ {error}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="audit-logs list-view-container">
            {/* Header */}
            <div className="list-view-header">
                <div className="list-view-toolbar">
                    <div className="list-view-search">
                        <span className="list-view-search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="Tìm kiếm nhân viên, phòng ban, người sửa..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                className="list-view-search-clear"
                                onClick={() => setSearchTerm('')}
                                title="Xóa tìm kiếm"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    {filteredLogs.length > 0 && (
                        <span className="list-view-count">
                            {filteredLogs.length} kết quả
                        </span>
                    )}
                </div>
                <div className="list-view-actions">
                    <button
                        onClick={handleExportExcel}
                        className="btn btn-primary"
                        title="Xuất file Excel"
                    >
                        <span>📊</span> Xuất Excel
                    </button>
                    <a
                        href="https://docs.google.com/spreadsheets/d/1BH3fOY-xclgp5OT1YoWgbDZ4ZkPNS-2fzwLdxoVg60U/edit#gid=1068085002"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="external-link-icon"
                        title="Mở Google Sheet"
                    >
                        🔗
                    </a>
                </div>
            </div>

            {/* List View */}
            <div className="list-view-table-wrapper">
                {filteredLogs.length === 0 ? (
                    <div className="list-view-empty-state">
                        <p>{searchTerm ? 'Không tìm thấy kết quả phù hợp.' : 'Chưa có dữ liệu audit log.'}</p>
                    </div>
                ) : (
                    <table className="list-view-table">
                        <thead>
                            <tr>
                                <th>Nhân viên</th>
                                <th>Người chỉnh sửa</th>
                                <th>Ngày sửa</th>
                                <th>Ngày CC</th>
                                <th>Check-in</th>
                                <th>Check-out</th>
                                <th>Phòng ban</th>
                                <th style={{ width: '50px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.map((log) => (
                                <tr key={log.id}>
                                    <td className="font-medium">{log.employee}</td>
                                    <td>{log.modifiedBy}</td>
                                    <td>{log.modifiedOn}</td>
                                    <td>{formatDate(log.checkIn)}</td>
                                    <td>
                                        <span className="audit-new-value">{formatTime(log.checkIn)}</span>
                                    </td>
                                    <td>
                                        <span className="audit-new-value">{formatTime(log.checkOut)}</span>
                                    </td>
                                    <td>{log.department}</td>
                                    <td className="text-right">
                                        <a
                                            href={`${CRM_BASE_URL}${log.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="audit-row-link"
                                            title="Xem trên CRM"
                                        >
                                            👁️
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
