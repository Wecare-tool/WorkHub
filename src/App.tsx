import { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';

import { Header } from './components/Header';
import { Calendar } from './components/Calendar';
import { Sidebar } from './components/Sidebar';
import { DayDetail } from './components/DayDetail';
import { WorkSummary } from './components/WorkSummary';

// Lazy load route components
const LeaveDashboard = lazy(() => import('./components/LeaveDashboard').then(m => ({ default: m.LeaveDashboard })));
const AuditLogs = lazy(() => import('./components/AuditLogs').then(m => ({ default: m.AuditLogs })));
const Management = lazy(() => import('./components/Management').then(m => ({ default: m.Management })));
const Tools = lazy(() => import('./components/Tools').then(m => ({ default: m.Tools })));
const WarehouseLayout = lazy(() => import('./components/Warehouse/WarehouseLayout').then(m => ({ default: m.WarehouseLayout })));
const InventoryCheck = lazy(() => import('./components/Warehouse/InventoryCheck').then(m => ({ default: m.InventoryCheck })));

import { DayRecord, MonthSummary } from './types/types';
import { calculateMonthSummary } from './utils/workUtils';
import { fetchChamCongData, getAccessToken, fetchEmployeeIdFromSystemUser } from './services/dataverse';
import { dataverseConfig } from './config/authConfig';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

function App() {
    const { instance, accounts, inProgress } = useMsal();
    const isAuthenticated = useIsAuthenticated();

    const [currentViewState, setCurrentViewState] = useState<'personal' | 'team' | 'audit' | 'management' | 'tools' | 'warehouse' | 'warehouse-tables' | 'warehouse-flow' | 'inventory-check'>('personal');

    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());
    const [records, setRecords] = useState<DayRecord[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [summary, setSummary] = useState<MonthSummary>({
        standardDays: 0,
        actualDays: 0,
        insufficientDays: []
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [employeeId, setEmployeeId] = useState<string | null>(null);

    const handleLogin = useCallback(async () => {
        try {
            await instance.loginPopup({
                scopes: dataverseConfig.scopes,
            });
        } catch (e) {
            console.error('Login error:', e);
            setError('Đăng nhập thất bại. Vui lòng thử lại.');
        }
    }, [instance]);

    const handleLogout = useCallback(() => {
        instance.logoutPopup();
        setEmployeeId(null);
    }, [instance]);

    useEffect(() => {
        const fetchEmployeeId = async () => {
            if (isAuthenticated && accounts.length > 0 && !employeeId) {
                try {
                    const azureAdObjectId = accounts[0].localAccountId;
                    const token = await getAccessToken(instance, accounts[0]);
                    const id = await fetchEmployeeIdFromSystemUser(token, azureAdObjectId);
                    if (id) {
                        setEmployeeId(id);
                    } else {
                        setError('Không tìm thấy thông tin nhân viên trong Dataverse.');
                    }
                } catch (e) {
                    console.error("Error fetching employee ID:", e);
                }
            }
        };

        if (inProgress === InteractionStatus.None) {
            fetchEmployeeId();
        }
    }, [isAuthenticated, accounts, instance, inProgress, employeeId]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            if (isAuthenticated && accounts.length > 0 && employeeId) {
                const token = await getAccessToken(instance, accounts[0]);
                const data = await fetchChamCongData(token, year, month, employeeId);
                setRecords(data);
            } else {
                setRecords([]);
                if (!isAuthenticated) {
                    setError('Vui lòng đăng nhập để xem dữ liệu chấm công.');
                }
            }
        } catch (e) {
            console.error('Error loading data:', e);
            setError('Không thể tải dữ liệu từ Dataverse.');
            setRecords([]);
        } finally {
            setLoading(false);
        }

        setSelectedDate(null);
    }, [year, month, isAuthenticated, accounts, instance, employeeId]);

    useEffect(() => {
        if (inProgress === InteractionStatus.None) {
            loadData();
        }
    }, [loadData, inProgress]);

    useEffect(() => {
        const newSummary = calculateMonthSummary(records, year, month);
        setSummary(newSummary);
    }, [records, year, month]);

    const handleMonthChange = useCallback((newYear: number, newMonth: number) => {
        setYear(newYear);
        setMonth(newMonth);
    }, []);

    const handleSelectDate = useCallback((date: string) => {
        setSelectedDate(prev => date === prev ? null : date);
    }, []);

    const selectedRecord = useMemo(() => {
        if (!selectedDate) return null;
        return records.find(r => r.date === selectedDate) || ({
            date: selectedDate,
            hoursWorked: 0,
            status: 'normal',
            workValue: 0
        } as DayRecord);
    }, [records, selectedDate]);

    const getHeaderTitle = useMemo(() => {
        switch (currentViewState) {
            case 'personal': return 'TimeSheet';
            case 'team': return 'Adjustment Request';
            case 'audit': return 'Change History';
            case 'management': return 'Admin Page';
            case 'tools': return 'Tools';
            case 'warehouse-tables': return 'Warehouse Tables';
            case 'warehouse-flow': return 'Flow Monitor';
            case 'warehouse': return 'Warehouse';
            case 'inventory-check': return 'Check tồn kho';
            default: return 'WorkHub';
        }
    }, [currentViewState]);

    return (
        <ThemeProvider>
            <ErrorBoundary>
                <div className="app">
                <Sidebar
                    currentView={currentViewState}
                    onChangeView={setCurrentViewState}
                    user={accounts[0] || null}
                    isAuthenticated={isAuthenticated}
                    onLogin={handleLogin}
                    onLogout={handleLogout}
                />

                <div className="main-layout">
                    <Header
                        year={year}
                        month={month}
                        onMonthChange={handleMonthChange}
                        title={getHeaderTitle}
                        showDateNav={currentViewState === 'personal' || currentViewState === 'team'}
                    />

                    {currentViewState === 'personal' ? (
                        <>
                            {error && (
                                <div className="error-banner error-message-container">
                                    ⚠️ {error}
                                </div>
                            )}

                            <main className="main-content">
                                {inProgress !== InteractionStatus.None && (
                                    <div className="loading-state">
                                        <div className="spinner"></div>
                                        <p>Đang xác thực...</p>
                                    </div>
                                )}

                                {!isAuthenticated && inProgress === InteractionStatus.None && (
                                    <div className="welcome-screen">
                                        <h2>Welcome to WorkHub</h2>
                                        <p>Vui lòng đăng nhập để xem dữ liệu chấm công của bạn.</p>
                                    </div>
                                )}

                                {isAuthenticated && !loading && (
                                    <div className="content-grid">
                                        <div className="calendar-section">
                                            <Calendar
                                                year={year}
                                                month={month}
                                                records={records}
                                                selectedDate={selectedDate}
                                                onSelectDate={handleSelectDate}
                                            />
                                        </div>

                                        <div className="summary-section">
                                            <WorkSummary
                                                summary={summary}
                                                year={year}
                                                month={month}
                                            />
                                        </div>
                                    </div>
                                )}

                                {loading && isAuthenticated && (
                                    <div className="loading">
                                        <div className="spinner"></div>
                                        <p>Đang tải dữ liệu...</p>
                                    </div>
                                )}
                            </main>
                        </>
                    ) : currentViewState === 'team' ? (
                        <div className="main-content">
                            <Suspense fallback={<div className="loading"><div className="spinner"></div><p>Đang tải...</p></div>}>
                                <LeaveDashboard employeeId={employeeId} year={year} month={month} />
                            </Suspense>
                        </div>
                    ) : currentViewState === 'audit' ? (
                        <main className="main-content">
                            <Suspense fallback={<div className="loading"><div className="spinner"></div><p>Đang tải...</p></div>}>
                                <AuditLogs />
                            </Suspense>
                        </main>
                    ) : currentViewState === 'tools' ? (
                        <div className="main-content">
                            <Suspense fallback={<div className="loading"><div className="spinner"></div><p>Đang tải...</p></div>}>
                                <Tools />
                            </Suspense>
                        </div>
                    ) : currentViewState === 'inventory-check' ? (
                        <div className="main-content">
                            <Suspense fallback={<div className="loading"><div className="spinner"></div><p>Đang tải...</p></div>}>
                                <InventoryCheck />
                            </Suspense>
                        </div>
                    ) : currentViewState === 'warehouse' || currentViewState === 'warehouse-tables' || currentViewState === 'warehouse-flow' ? (
                        <div className="main-content">
                            <Suspense fallback={<div className="loading"><div className="spinner"></div><p>Đang tải...</p></div>}>
                                <WarehouseLayout activeView={
                                    currentViewState === 'warehouse-tables' ? 'tables' :
                                        currentViewState === 'warehouse-flow' ? 'flow' : undefined
                                } />
                            </Suspense>
                        </div>
                    ) : (
                        <div className="main-content">
                            <Suspense fallback={<div className="loading"><div className="spinner"></div><p>Đang tải...</p></div>}>
                                <Management />
                            </Suspense>
                        </div>
                    )}
                </div>

                {selectedRecord && (
                    <DayDetail
                        record={selectedRecord}
                        onClose={() => setSelectedDate(null)}
                        employeeId={employeeId}
                        onSaveSuccess={loadData}
                    />
                )}
            </div>
            </ErrorBoundary>
        </ThemeProvider>
    );
}

export default App;
