import React, { useState, useEffect } from 'react';
import {
    CloseOutlined,
    ArrowDownOutlined,
    ArrowUpOutlined,
    HistoryOutlined,
    ControlOutlined,
    SolutionOutlined
} from '@ant-design/icons';
import { useMsal } from '@azure/msal-react';
import { getAccessToken, fetchInventoryHistory, InventoryHistoryRecord, InventoryProduct } from '../../services/dataverseService';

interface InventoryHistoryModalProps {
    product: InventoryProduct;
    onClose: () => void;
}

export const InventoryHistoryModal: React.FC<InventoryHistoryModalProps> = ({ product, onClose }) => {
    const { instance, accounts } = useMsal();
    const [history, setHistory] = useState<InventoryHistoryRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadHistory = async () => {
            if (!accounts[0]) return;
            setLoading(true);
            try {
                const token = await getAccessToken(instance, accounts[0]);
                const data = await fetchInventoryHistory(token, product.crdfd_kho_binh_dinhid);
                setHistory(data);
            } catch (err) {
                console.error("Error loading history:", err);
            } finally {
                setLoading(false);
            }
        };

        loadHistory();
    }, [product, accounts, instance]);

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'Nhập': return <ArrowUpOutlined className="text-green-500" style={{ fontSize: 18 }} />;
            case 'Xuất': return <ArrowDownOutlined className="text-red-500" style={{ fontSize: 18 }} />;
            case 'Cân': return <ControlOutlined className="text-amber-500" style={{ fontSize: 18 }} />;
            case 'Kiểm kho': return <SolutionOutlined className="text-blue-500" style={{ fontSize: 18 }} />;
            default: return <HistoryOutlined className="text-gray-500" style={{ fontSize: 18 }} />;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-header)] flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">Lịch sử biến động</h3>
                        <p className="text-sm text-[var(--text-muted)] mt-1">{product.productName}</p>
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
                <div className="flex-1 overflow-auto p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-[var(--text-muted)]">
                            <div className="w-8 h-8 border-4 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin"></div>
                            <p>Đang tải lịch sử...</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)] opacity-50">
                            <HistoryOutlined style={{ fontSize: 48 }} />
                            <p className="mt-2">Không có dữ liệu lịch sử</p>
                        </div>
                    ) : (
                        <div className="relative">
                            {/* Vertical Line */}
                            <div className="absolute left-[17px] top-2 bottom-2 w-0.5 bg-[var(--border)]"></div>

                            <div className="space-y-6 relative">
                                {history.map((record) => (
                                    <div key={record.id} className="flex gap-4">
                                        <div className="relative z-10 flex items-center justify-center w-9 h-9 bg-[var(--bg-card)] border border-[var(--border)] rounded-full shadow-sm">
                                            {getTypeIcon(record.type)}
                                        </div>
                                        <div className="flex-1 pt-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-[var(--text-primary)]">{record.type}</span>
                                                <span className="text-xs text-[var(--text-muted)]">
                                                    {new Date(record.date).toLocaleDateString('vi-VN')} {new Date(record.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-[var(--text-secondary)]">Phiếu: <span className="text-[var(--text-primary)] font-medium">{record.reference}</span></span>
                                                <span className={`font-mono font-bold ${record.quantity > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {record.quantity > 0 ? '+' : ''}{record.quantity.toLocaleString()}
                                                </span>
                                            </div>
                                            {record.note && (
                                                <p className="mt-2 text-xs text-[var(--text-muted)] bg-[var(--bg-input)] p-2 rounded italic">
                                                    "{record.note}"
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-header)] flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};
