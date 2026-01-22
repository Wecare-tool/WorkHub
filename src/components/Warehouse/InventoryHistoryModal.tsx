import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowDownLeft, ArrowUpRight, RotateCcw, ClipboardList, Scale, Package } from 'lucide-react';
import { useMsal } from '@azure/msal-react';
import { getAccessToken, fetchInventoryHistory, InventoryProduct, InventoryHistorySummary, InventoryHistoryExtendedRecord } from '../../services/dataverse';

interface InventoryHistoryModalProps {
    product: InventoryProduct;
    onClose: () => void;
}

export const InventoryHistoryModal: React.FC<InventoryHistoryModalProps> = ({ product, onClose }) => {
    const { instance, accounts } = useMsal();
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<InventoryHistorySummary | null>(null);
    const [records, setRecords] = useState<InventoryHistoryExtendedRecord[]>([]);
    const [activeTab, setActiveTab] = useState<'export' | 'import' | 'return' | 'check' | 'balance'>('export');

    useEffect(() => {
        const loadHistory = async () => {
            if (accounts.length > 0) {
                const token = await getAccessToken(instance, accounts[0]);
                if (token) {
                    try {
                        // Pass productCode (crdfd_masp) instead of ID, or fallback to ID if masp missing (though logic requires masp)
                        const code = product.crdfd_masp || product.productCode || "";
                        const id = product.productId || "";
                        const { records, summary } = await fetchInventoryHistory(token, code, id);
                        setRecords(records);
                        setSummary(summary);
                    } catch (error) {
                        console.error("Failed to load history", error);
                    }
                }
            }
            setLoading(false);
        };
        loadHistory();
    }, [product, accounts, instance]);

    // OPTIMIZED: Memoize filtered records to avoid re-filtering on every render
    const tabRecords = useMemo(() => {
        switch (activeTab) {
            case 'export':
                return records.filter(r => r.type === 'Xuất');
            case 'import':
                return records.filter(r => r.type === 'Nhập');
            case 'return':
                return records.filter(r => (r.quantityReturn && r.quantityReturn > 0));
            case 'check':
                return records.filter(r => r.type === 'Kiểm kho');
            case 'balance':
                return records.filter(r => r.type === 'Cân kho');
            default:
                return [];
        }
    }, [records, activeTab]);

    // OPTIMIZED: Memoize tab counts to avoid re-filtering on every render
    const tabCounts = useMemo(() => ({
        export: records.filter(r => r.type === 'Xuất').length,
        import: records.filter(r => r.type === 'Nhập').length,
        return: records.filter(r => (r.quantityReturn && r.quantityReturn > 0)).length,
        check: records.filter(r => r.type === 'Kiểm kho').length,
        balance: records.filter(r => r.type === 'Cân kho').length
    }), [records]);

    const formatNumber = (num?: number) => num ? num.toLocaleString('vi-VN') : '0';

    // Use Portal to render outside of current stacking context
    return createPortal(
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(8px)',
                padding: '1rem'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
                    width: '85%',
                    height: '90%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <Package size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">{product.productName}</h2>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{product.crdfd_masp}</span>
                                <span>•</span>
                                <span>{product.warehouseLocation || product.locationName}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Đóng" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                        <X size={24} />
                    </button>
                </div>

                {/* Summary Section */}
                <div className="p-4 bg-white border-b shadow-sm z-10">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <SummaryCard
                            label="Tổng Nhập"
                            value={formatNumber(summary?.totalImport)}
                            icon={<ArrowDownLeft size={18} />}
                            color="text-green-600 bg-green-50"
                        />
                        <SummaryCard
                            label="Tổng Xuất"
                            value={formatNumber(summary?.totalExport)}
                            icon={<ArrowUpRight size={18} />}
                            color="text-blue-600 bg-blue-50"
                        />
                        <SummaryCard
                            label="Trả Bán"
                            value={formatNumber(summary?.totalReturnSale)}
                            icon={<RotateCcw size={18} />}
                            color="text-orange-600 bg-orange-50"
                        />
                        <SummaryCard
                            label="Trả Mua"
                            value={formatNumber(summary?.totalReturnBuy)}
                            icon={<RotateCcw size={18} />}
                            color="text-amber-600 bg-amber-50"
                        />
                        <SummaryCard
                            label="Cân Kho"
                            value={formatNumber(summary?.totalBalance)}
                            subValue={summary?.totalBalance && summary.totalBalance > 0 ? '+' : ''}
                            icon={<Scale size={18} />}
                            color="text-purple-600 bg-purple-50"
                        />
                        <div className="flex flex-col p-3 rounded-lg border border-indigo-100 bg-indigo-50/50">
                            <span className="text-xs font-semibold text-indigo-500 uppercase">Tồn thực tế</span>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-xl font-bold text-indigo-700">
                                    {formatNumber(summary?.currentStock)}
                                </span>
                                <span className="text-xs text-indigo-400">{product.crdfd_onvi}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs Navigation */}
                <div className="flex border-b px-4 mt-2">
                    <TabButton active={activeTab === 'export'} onClick={() => setActiveTab('export')} label="Xuất hàng" icon={<ArrowUpRight size={16} />} count={tabCounts.export} />
                    <TabButton active={activeTab === 'import'} onClick={() => setActiveTab('import')} label="Nhập hàng" icon={<ArrowDownLeft size={16} />} count={tabCounts.import} />
                    <TabButton active={activeTab === 'return'} onClick={() => setActiveTab('return')} label="Đổi trả" icon={<RotateCcw size={16} />} count={tabCounts.return} />
                    <TabButton active={activeTab === 'check'} onClick={() => setActiveTab('check')} label="Kiểm kho" icon={<ClipboardList size={16} />} count={tabCounts.check} />
                    <TabButton active={activeTab === 'balance'} onClick={() => setActiveTab('balance')} label="Lịch sử cân kho" icon={<Scale size={16} />} count={tabCounts.balance} />
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-auto bg-gray-50 p-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">Ngày chứng từ</th>
                                        <th className="px-4 py-3">Số chứng từ / Reference</th>
                                        <th className="px-4 py-3 text-right">Số lượng</th>
                                        {(activeTab === 'export' || activeTab === 'import' || activeTab === 'return') && (
                                            <th className="px-4 py-3 text-right">SL Đổi trả</th>
                                        )}
                                        <th className="px-4 py-3">Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {tabRecords.length > 0 ? (
                                        tabRecords.map((record) => (
                                            <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 text-gray-600">
                                                    {new Date(record.date).toLocaleDateString('vi-VN')} <span className="text-xs text-gray-400 ml-1">{new Date(record.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </td>
                                                <td className="px-4 py-3 font-medium text-gray-700">
                                                    {record.reference || <span className="italic text-gray-300">N/A</span>}
                                                </td>
                                                <td className={`px-4 py-3 text-right font-semibold ${record.quantity > 0 ? 'text-green-600' : record.quantity < 0 ? 'text-blue-600' : 'text-gray-600'
                                                    }`}>
                                                    {record.quantity > 0 ? '+' : ''}{formatNumber(record.quantity)}
                                                </td>
                                                {(activeTab === 'export' || activeTab === 'import' || activeTab === 'return') && (
                                                    <td className="px-4 py-3 text-right text-orange-600">
                                                        {record.quantityReturn ? formatNumber(record.quantityReturn) : '-'}
                                                    </td>
                                                )}
                                                <td className="px-4 py-3 text-gray-500 max-w-xs truncate" title={record.note}>
                                                    {record.note || '-'}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                                                Không có dữ liệu
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

// Components
const SummaryCard = ({ label, value, subValue, icon, color }: any) => (
    <div className="flex flex-col p-3 rounded-lg border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-md ${color} bg-opacity-20`}>
                {icon}
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase">{label}</span>
        </div>
        <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-gray-800">
                {subValue}{value}
            </span>
        </div>
    </div>
);

const TabButton = ({ active, onClick, label, icon, count }: any) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${active
            ? 'border-blue-500 text-blue-600 bg-blue-50/50'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
    >
        {icon}
        {label}
        {count !== undefined && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                {count}
            </span>
        )}
    </button>
);
