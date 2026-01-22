import React, { useState, useEffect } from 'react';
import { Search, Filter, Columns, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMsal } from '@azure/msal-react';
import { fetchTransactionSales, getAccessToken, TransactionSales, TransactionSalesPaginatedResponse } from '../../services/dataverse';

interface DataTrackerTableProps {
    selectedTable: string;
}

// Interface for table row display
interface DataRow {
    id: string;
    warehouse: string;
    product: string;
    unit: string;
    purchasingEmployee: string;
    urgentPurchasingEmployee: string;
    stockByUser: string;
    orderedStock: string;
    strangeStock: string;
    warehouseStrangeStock: string;
    historyConfidence: string;
    confidenceLevel: string;
}

export const DataTrackerTable: React.FC<DataTrackerTableProps> = ({ selectedTable }) => {
    const { instance, accounts } = useMsal();
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [selectAll, setSelectAll] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [data, setData] = useState<DataRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);
    const pageSize = 50;

    // Load data when component mounts or when page/table changes
    useEffect(() => {
        if (selectedTable === 'transaction_sales') {
            loadTransactionSales();
        }
        // Reset selection when changing tables
        setSelectedRows(new Set());
        setSelectAll(false);
    }, [selectedTable, currentPage]);

    const loadTransactionSales = async () => {
        if (!accounts[0]) {
            setError('No authenticated account found');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const accessToken = await getAccessToken(instance, accounts[0]);
            const response: TransactionSalesPaginatedResponse = await fetchTransactionSales(
                accessToken,
                currentPage,
                pageSize
            );

            // Transform Dataverse data to display format
            const transformedData: DataRow[] = response.data.map((item: TransactionSales) => ({
                id: item.crdfd_transactionsalesid,
                warehouse: item.warehouseName || item.crdfd_warehouse || '',
                product: item.productName || item.crdfd_product || '',
                unit: item.crdfd_unit || '',
                purchasingEmployee: item.purchasingEmployeeName || item.crdfd_purchasingemployee || '',
                urgentPurchasingEmployee: item.urgentPurchasingEmployeeName || item.crdfd_urgentpurchasingemployee || '',
                stockByUser: (item.crdfd_stockbyuser ?? 0).toFixed(2),
                orderedStock: (item.crdfd_orderedstock ?? 0).toFixed(2),
                strangeStock: (item.crdfd_strangestock ?? 0).toFixed(2),
                warehouseStrangeStock: (item.crdfd_warehousestrangestock ?? 0).toFixed(2),
                historyConfidence: (item.crdfd_historyconfidence ?? 0).toFixed(2),
                confidenceLevel: item.crdfd_confidencelevel || 'No data'
            }));

            setData(transformedData);
            setTotalCount(response.totalCount);
            setHasNextPage(response.hasNextPage);
            setHasPreviousPage(response.hasPreviousPage);
        } catch (err) {
            console.error('Error loading Transaction Sales:', err);
            setError('Failed to load data. Please try again.');
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAll = () => {
        if (selectAll) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(data.map(row => row.id)));
        }
        setSelectAll(!selectAll);
    };

    const handleSelectRow = (id: string) => {
        const newSelected = new Set(selectedRows);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedRows(newSelected);
        setSelectAll(newSelected.size === data.length);
    };

    const handleNextPage = () => {
        if (hasNextPage) {
            setCurrentPage(prev => prev + 1);
        }
    };

    const handlePreviousPage = () => {
        if (hasPreviousPage) {
            setCurrentPage(prev => prev - 1);
        }
    };

    const getTableName = () => {
        const tableNames: Record<string, string> = {
            transaction_sales: 'Transaction Sales',
            warehouse_inventory: 'Warehouse Inventory',
            warehouse_main: 'Warehouse',
            warehouse_audit: 'Danh sách kiểm hàng',
            system_process: 'Process',
        };
        return tableNames[selectedTable] || selectedTable;
    };

    // Show loading state
    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-[var(--bg-secondary)]">
                <div className="text-[var(--text-muted)]">Loading data...</div>
            </div>
        );
    }

    // Show error state
    if (error) {
        return (
            <div className="h-full flex items-center justify-center bg-[var(--bg-secondary)]">
                <div className="text-red-500">{error}</div>
            </div>
        );
    }

    // Show message for non-transaction_sales tables
    if (selectedTable !== 'transaction_sales') {
        return (
            <div className="h-full flex items-center justify-center bg-[var(--bg-secondary)]">
                <div className="text-[var(--text-muted)]">
                    Data for "{getTableName()}" is not yet implemented
                </div>
            </div>
        );
    }

    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-primary)]">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{getTableName()}</h2>
                        <button className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded transition-colors">
                            <span>All items</span>
                            <ChevronDown size={14} />
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-muted)]">
                            {selectedRows.size > 0 ? `${selectedRows.size} selected` : `${data.length} items (${totalCount} total)`}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded border border-[var(--border)] transition-colors">
                            <Columns size={14} />
                            <span>Edit columns</span>
                        </button>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded border border-[var(--border)] transition-colors">
                            <Filter size={14} />
                            <span>Edit filters</span>
                        </button>
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                            <input
                                type="text"
                                placeholder="Quick Search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] w-48"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 bg-[var(--bg-primary)] z-10">
                        <tr className="border-b border-[var(--border)]">
                            <th className="w-10 px-3 py-2 text-left">
                                <input
                                    type="checkbox"
                                    checked={selectAll}
                                    onChange={handleSelectAll}
                                    className="cursor-pointer accent-[var(--accent-primary)]"
                                    aria-label="Select all rows"
                                />
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">Vị trí kho</th>
                            <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">Tên sản phẩm</th>
                            <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">Đơn vị</th>
                            <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">NV mua hàng</th>
                            <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">NV mua hàng urgent</th>
                            <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">Tồn kho by User</th>
                            <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">Tồn hàng đặt</th>
                            <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">Tồn hàng kỳ lạ</th>
                            <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">Tồn kỳ lạ kho</th>
                            <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">Điểm tin tưởng lịch sử</th>
                            <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">Confident Level</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row) => (
                            <tr
                                key={row.id}
                                className={`border-b border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors ${selectedRows.has(row.id) ? 'bg-[var(--accent-primary-soft)]' : ''
                                    }`}
                            >
                                <td className="px-3 py-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedRows.has(row.id)}
                                        onChange={() => handleSelectRow(row.id)}
                                        className="cursor-pointer accent-[var(--accent-primary)]"
                                        aria-label={`Select row ${row.id}`}
                                    />
                                </td>
                                <td className="px-3 py-2 text-[var(--accent-primary)] hover:underline cursor-pointer">{row.warehouse}</td>
                                <td className="px-3 py-2 text-[var(--text-primary)]">{row.product}</td>
                                <td className="px-3 py-2 text-[var(--text-primary)]">{row.unit}</td>
                                <td className="px-3 py-2 text-[var(--accent-primary)] hover:underline cursor-pointer">{row.purchasingEmployee}</td>
                                <td className="px-3 py-2 text-[var(--accent-primary)] hover:underline cursor-pointer">{row.urgentPurchasingEmployee}</td>
                                <td className="px-3 py-2 text-[var(--text-primary)] text-right">{row.stockByUser}</td>
                                <td className="px-3 py-2 text-[var(--text-primary)] text-right">{row.orderedStock}</td>
                                <td className="px-3 py-2 text-[var(--text-primary)] text-right">{row.strangeStock}</td>
                                <td className="px-3 py-2 text-[var(--text-primary)] text-right">{row.warehouseStrangeStock}</td>
                                <td className="px-3 py-2 text-[var(--text-primary)] text-right">{row.historyConfidence}</td>
                                <td className="px-3 py-2">
                                    <span className={`px-2 py-0.5 rounded text-xs ${row.confidenceLevel === 'Lack of data'
                                        ? 'bg-red-500/10 text-red-500'
                                        : row.confidenceLevel === 'No data'
                                            ? 'bg-gray-500/10 text-gray-500'
                                            : 'bg-green-500/10 text-green-500'
                                        }`}>
                                        {row.confidenceLevel}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer with Pagination */}
            <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--bg-primary)] flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">
                    Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount} rows
                </span>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-muted)]">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={handlePreviousPage}
                        disabled={!hasPreviousPage}
                        className="p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded border border-[var(--border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Previous page"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        onClick={handleNextPage}
                        disabled={!hasNextPage}
                        className="p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded border border-[var(--border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Next page"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
