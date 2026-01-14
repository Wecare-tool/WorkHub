import React, { useState } from 'react';
import { AccountInfo } from '@azure/msal-browser';
import {
    SettingOutlined,
    ToolOutlined,
    BarChartOutlined,
    InteractionOutlined,
    ContainerOutlined,
    CalendarOutlined,
    FormOutlined,
    AuditOutlined,
    LoginOutlined
} from '@ant-design/icons';
import { Settings } from './Settings';

interface SidebarProps {
    currentView: 'personal' | 'team' | 'audit' | 'management' | 'tools' | 'warehouse' | 'warehouse-tables' | 'warehouse-flow' | 'inventory-check';
    onChangeView: (view: 'personal' | 'team' | 'audit' | 'management' | 'tools' | 'warehouse' | 'warehouse-tables' | 'warehouse-flow' | 'inventory-check') => void;
    user: AccountInfo | null;
    isAuthenticated: boolean;
    onLogin: () => void;
    onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    currentView,
    onChangeView,
    user,
    isAuthenticated,
    onLogin
}) => {
    const [managementOpen, setManagementOpen] = useState(true);
    const [warehouseOpen, setWarehouseOpen] = useState(true);
    const [attendanceOpen, setAttendanceOpen] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    return (
        <>
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="logo-container">
                        <span className="logo-text">WorkHub</span>
                    </div>
                    <button
                        className="settings-toggle-btn"
                        onClick={() => setIsSettingsOpen(true)}
                        title="Cấu hình giao diện"
                    >
                        <SettingOutlined style={{ fontSize: 18 }} />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-group">
                        <button
                            className="nav-group-header"
                            onClick={() => setManagementOpen(!managementOpen)}
                        >
                            <span className="group-title">Management</span>
                            <span className="group-toggle">{managementOpen ? '▼' : '▶'}</span>
                        </button>

                        {managementOpen && (
                            <div className="nav-group-items">
                                <button
                                    className={`nav-item ${currentView === 'management' ? 'active' : ''}`}
                                    onClick={() => onChangeView('management')}
                                >
                                    <SettingOutlined className="icon" />
                                    <span className="label">Admin Page</span>
                                </button>
                                <button
                                    className={`nav-item ${currentView === 'tools' ? 'active' : ''}`}
                                    onClick={() => onChangeView('tools')}
                                >
                                    <ToolOutlined className="icon" />
                                    <span className="label">Tools</span>
                                </button>
                            </div>
                        )}
                    </div>


                    <div className="nav-group">
                        <button
                            className="nav-group-header"
                            onClick={() => setWarehouseOpen(!warehouseOpen)}
                        >
                            <span className="group-title">Warehouse</span>
                            <span className="group-toggle">{warehouseOpen ? '▼' : '▶'}</span>
                        </button>

                        {warehouseOpen && (
                            <div className="nav-group-items">
                                <button
                                    className={`nav-item ${currentView === 'warehouse-tables' ? 'active' : ''}`}
                                    onClick={() => onChangeView('warehouse-tables')}
                                >
                                    <BarChartOutlined className="icon" />
                                    <span className="label">Tables</span>
                                </button>
                                <button
                                    className={`nav-item ${currentView === 'warehouse-flow' ? 'active' : ''}`}
                                    onClick={() => onChangeView('warehouse-flow')}
                                >
                                    <InteractionOutlined className="icon" />
                                    <span className="label">Flow/Dataflow Monitor</span>
                                </button>
                                <button
                                    className={`nav-item ${currentView === 'inventory-check' ? 'active' : ''}`}
                                    onClick={() => onChangeView('inventory-check')}
                                >
                                    <ContainerOutlined className="icon" />
                                    <span className="label">Check tồn kho</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="nav-group">
                        <button
                            className="nav-group-header"
                            onClick={() => setAttendanceOpen(!attendanceOpen)}
                        >
                            <span className="group-title">Attendance</span>
                            <span className="group-toggle">{attendanceOpen ? '▼' : '▶'}</span>
                        </button>

                        {attendanceOpen && (
                            <div className="nav-group-items">
                                <button
                                    className={`nav-item ${currentView === 'personal' ? 'active' : ''}`}
                                    onClick={() => onChangeView('personal')}
                                >
                                    <CalendarOutlined className="icon" />
                                    <span className="label">TimeSheet</span>
                                </button>

                                <button
                                    className={`nav-item ${currentView === 'team' ? 'active' : ''}`}
                                    onClick={() => onChangeView('team')}
                                >
                                    <FormOutlined className="icon" />
                                    <span className="label">Adjustment Request</span>
                                </button>

                                <button
                                    className={`nav-item ${currentView === 'audit' ? 'active' : ''}`}
                                    onClick={() => onChangeView('audit')}
                                >
                                    <AuditOutlined className="icon" />
                                    <span className="label">Change History</span>
                                </button>
                            </div>
                        )}
                    </div>
                </nav>

                <div className="sidebar-footer">
                    <div className="version-info">
                        <span>@2026 HieuLe</span>
                        {(!isAuthenticated || !user) && (
                            <button className="login-btn-compact" onClick={onLogin} title="Đăng nhập">
                                <LoginOutlined />
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            {/* Settings Popup Overlay */}
            {
                isSettingsOpen && (
                    <div className="settings-popup-overlay" onClick={() => setIsSettingsOpen(false)}>
                        <div className="settings-popup-content" onClick={e => e.stopPropagation()}>
                            <div className="settings-popup-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <SettingOutlined className="text-accent" style={{ fontSize: 20 }} />
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Cấu hình giao diện</h2>
                                </div>
                                <button className="close-popup-btn" onClick={() => setIsSettingsOpen(false)}>
                                    &times;
                                </button>
                            </div>
                            <div className="settings-popup-body">
                                <Settings />
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
};
