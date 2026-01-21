import React, { useState, useEffect } from 'react';
import {
    CloseOutlined,
    ArrowDownOutlined,
    ArrowUpOutlined,
    HistoryOutlined,
    ControlOutlined,
    SolutionOutlined,
    RotateLeftOutlined,
    RotateRightOutlined
} from '@ant-design/icons';
import { useMsal } from '@azure/msal-react';
import {
    getAccessToken,
    InventoryProduct,
    fetchProductInventorySummary,
    ProductInventorySummary,
    fetchDetailedInventoryHistory,
    DetailedInventoryRecord
} from '../../services/dataverseService';

interface InventoryHistoryModalProps {
    product: InventoryProduct;
    onClose: () => void;
}

type TabType = 'Xuất hàng' | 'Nhập hàng' | 'Đổi trả' | 'Kiểm kho' | 'Lịch sử cân kho';

export const InventoryHistoryModal: React.FC<InventoryHistoryModalProps> = ({ product, onClose }) => {
    const { instance, accounts } = useMsal();
    const [summary, setSummary] = useState<ProductInventorySummary | null>(null);
    const [history, setHistory] = useState<DetailedInventoryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('Xuất hàng');

    useEffect(() => {
        const loadSummary = async () => {
            if (!accounts[0]) return;
            setLoading(true);
            try {
                const token = await getAccessToken(instance, accounts[0]);
                const data = await fetchProductInventorySummary(token, product);
                setSummary(data);
            } catch (err) {
                console.error("Error loading summary:", err);
            } finally {
                setLoading(false);
            }
        };

        loadSummary();
    }, [product, accounts, instance]);

    useEffect(() => {
        const loadTabHistory = async () => {
            if (!accounts[0]) return;
            setHistoryLoading(true);
            try {
                const token = await getAccessToken(instance, accounts[0]);
                const categoryMap: Record<TabType, any> = {
                    'Xuất hàng': 'Xuất',
                    'Nhập hàng': 'Nhập',
                    'Đổi trả': 'Đổi trả',
                    'Kiểm kho': 'Kiểm kho',
                    'Lịch sử cân kho': 'Cân'
                };
                const data = await fetchDetailedInventoryHistory(token, product, categoryMap[activeTab]);
                setHistory(data);
            } catch (err) {
                console.error("Error loading tab history:", err);
            } finally {
                setHistoryLoading(false);
            }
        };

        loadTabHistory();
    }, [activeTab, product, accounts, instance]);

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'Nhập':
            case 'Xi Nhập': return <ArrowUpOutlined className="text-green-500" style={{ fontSize: 18 }} />;
            case 'Xuất':
            case 'Xi Xuất': return <ArrowDownOutlined className="text-red-500" style={{ fontSize: 18 }} />;
            case 'Cân': return <ControlOutlined className="text-amber-500" style={{ fontSize: 18 }} />;
            case 'Kiểm kho': return <SolutionOutlined className="text-blue-500" style={{ fontSize: 18 }} />;
            case 'Trả bán': return <RotateLeftOutlined className="text-orange-500" style={{ fontSize: 18 }} />;
            case 'Trả mua': return <RotateRightOutlined className="text-purple-500" style={{ fontSize: 18 }} />;
            default: return <HistoryOutlined className="text-gray-500" style={{ fontSize: 18 }} />;
        }
    };

    const formatNum = (num: number) => {
        return num.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
    };

    const summaryCards = [
        { label: 'TỔNG NHẬP', value: (summary?.totalNhap || 0) - (summary?.traMua || 0) + (summary?.xiNhap || 0) + (summary?.transferNhap || 0), color: 'text-green-600', icon: <ArrowUpOutlined /> },
        { label: 'TỔNG XUẤT', value: (summary?.totalXuat || 0) - (summary?.traBan || 0) + (summary?.xiXuat || 0) + (summary?.transferXuat || 0), color: 'text-blue-600', icon: <ArrowDownOutlined /> },
        { label: 'TRẢ BÁN', value: summary?.traBan || 0, color: 'text-orange-600', icon: <RotateLeftOutlined /> },
        { label: 'TRẢ MUA', value: summary?.traMua || 0, color: 'text-purple-600', icon: <RotateRightOutlined /> },
        { label: 'CÂN KHO', value: summary?.canKho || 0, color: 'text-amber-600', icon: <ControlOutlined /> },
        { label: 'TỒN THỰC TẾ', value: summary?.tonThucTe || 0, color: 'text-indigo-600', icon: <HistoryOutlined />, highlight: true },
    ];

    const tabs: TabType[] = ['Xuất hàng', 'Nhập hàng', 'Đổi trả', 'Kiểm kho', 'Lịch sử cân kho'];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-header)] flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">{product.productName}</h3>
                        <p className="text-sm text-[var(--text-muted)] mt-1">{product.productCode} • {product.locationName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-full transition-colors"
                        title="Đóng"
                    >
                        <CloseOutlined style={{ fontSize: 20 }} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col p-6 gap-6">
                    {/* Summary Boxes */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {summaryCards.map((card, idx) => (
                            <div key={idx} className={`p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-sm ${card.highlight ? 'ring-2 ring-indigo-500/20' : ''}`}>
                                <div className="flex items-center gap-2 mb-2 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                                    <span className={card.color}>{card.icon}</span>
                                    {card.label}
                                </div>
                                <div className={`text-xl font-black ${card.highlight ? 'text-indigo-600' : 'text-[var(--text-primary)]'}`}>
                                    {loading ? '...' : formatNum(card.value)}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-[var(--border)] overflow-x-auto no-scrollbar">
                        {tabs.map(tab => (activeTab === tab) ? (
                            <button
                                key={tab}
                                className="px-6 py-3 text-sm font-bold text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)] whitespace-nowrap"
                            >
                                {tab} <span className="ml-1 opacity-60 text-xs font-normal">
                                    {activeTab === tab && !historyLoading ? history.length : ''}
                                </span>
                            </button>
                        ) : (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className="px-6 py-3 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all whitespace-nowrap"
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* History List */}
                    <div className="flex-1 overflow-auto">
                        {historyLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3 text-[var(--text-muted)]">
                                <div className="w-8 h-8 border-4 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin"></div>
                                <p>Đang tải dữ liệu...</p>
                            </div>
                        ) : history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)] opacity-50">
                                <HistoryOutlined style={{ fontSize: 48 }} />
                                <p className="mt-2">Không có dữ liệu</p>
                            </div>
                        ) : (
                            <div className="min-w-full inline-block align-middle">
                                <table className="min-w-full divide-y divide-[var(--border)]">
                                    <thead className="bg-[var(--bg-header)] sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Ngày chứng từ</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Số chứng từ / Reference</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Số lượng</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Ghi chú</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border)]">
                                        {history.map((record) => (
                                            <tr key={record.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--text-secondary)]">
                                                    {new Date(record.date).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-[var(--text-primary)]">
                                                    <span className="flex items-center gap-2">
                                                        {getTypeIcon(record.type)}
                                                        {record.reference}
                                                    </span>
                                                </td>
                                                <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-bold ${record.quantity > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {record.quantity > 0 ? '+' : ''}{formatNum(record.quantity)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-[var(--text-muted)] italic">
                                                    {record.note || record.type}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-header)] flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-sm font-bold bg-[var(--accent-primary)] text-white rounded-xl hover:shadow-lg hover:shadow-[var(--accent-primary)]/30 transition-all active:scale-95"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};
