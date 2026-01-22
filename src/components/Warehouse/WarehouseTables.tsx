import React, { useState, useEffect } from 'react';
import { Search, Filter, Columns, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMsal } from '@azure/msal-react';
import { fetchTransactionSales, getAccessToken, TransactionSales, TransactionSalesPaginatedResponse } from '../../services/dataverse';

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

export const WarehouseTables: React.FC = () => {
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
    const pageSize = 50; // Requested size

    // Load data when component mounts or page changes
    useEffect(() => {
        loadTransactionSales();
        setSelectedRows(new Set());
        setSelectAll(false);
    }, [currentPage]);

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

    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <div className="h-full flex flex-col bg-[var(--bg-card)] rounded-xl overflow-hidden border border-[var(--border)] shadow-lg backdrop-blur-md">
            {/* Table Header / Toolbar */}
            <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-header)] flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight">Transaction Sales</h2>
                        <p className="text-sm text-[var(--text-muted)] mt-1">
                            {loading ? 'Updating data...' : `${totalCount} records found`}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--accent-primary)] transition-colors" />
                            <input
                                type="text"
                                placeholder="Search records..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2 text-sm bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] w-64 transition-all"
                            />
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg border border-[var(--border)] transition-all hover:border-[var(--accent-primary)]">
                            <Filter size={16} />
                            <span>Filter</span>
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg border border-[var(--border)] transition-all hover:border-[var(--accent-primary)]">
                            <Columns size={16} />
                            <span>Columns</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto relative">
                {error ? (
                    <div className="flex items-center justify-center h-full text-red-400 gap-2">
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                ) : (
                    <table className="w-full text-[14px] border-collapse min-w-[1200px]">
                        <thead className="sticky top-0 bg-[var(--bg-card)] z-20 shadow-sm ring-1 ring-black/5">
                            <tr className="border-b border-[var(--border)]">
                                <th className="w-12 px-4 py-3 text-left bg-[var(--bg-card)]">
                                    <input
                                        type="checkbox"
                                        checked={selectAll}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 rounded border-[var(--border)] bg-[var(--bg-input)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] cursor-pointer"
                                        aria-label="Select all rows"
                                    />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap bg-[var(--bg-card)]">Vị trí kho</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap bg-[var(--bg-card)]">Tên sản phẩm</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap bg-[var(--bg-card)]">Đơn vị</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap bg-[var(--bg-card)]">NV mua hàng</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap bg-[var(--bg-card)]">NV Urgent</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap bg-[var(--bg-card)]">Tồn By User</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap bg-[var(--bg-card)]">Tồn Đặt</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap bg-[var(--bg-card)]">Tồn Kỳ Lạ</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap bg-[var(--bg-card)]">TK Kho</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap bg-[var(--bg-card)]">Confidence</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap bg-[var(--bg-card)]">Level</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {loading && data.length === 0 ? (
                                <tr>
                                    <td colSpan={13} className="px-6 py-12 text-center text-[var(--text-muted)] animate-pulse">
                                        Loading data...
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={13} className="px-6 py-12 text-center text-[var(--text-muted)]">
                                        No transactions found.
                                    </td>
                                </tr>
                            ) : (
                                data.map((row) => (
                                    <tr
                                        key={row.id}
                                        className={`group transition-colors hover:bg-[var(--bg-hover)] ${selectedRows.has(row.id) ? 'bg-[rgba(167,139,250,0.1)]' : ''
                                            }`}
                                    >
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedRows.has(row.id)}
                                                onChange={() => handleSelectRow(row.id)}
                                                className="w-4 h-4 rounded border-[var(--border)] bg-[var(--bg-input)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] cursor-pointer"
                                                aria-label={`Select row ${row.warehouse}`}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-[var(--accent-primary)] font-medium whitespace-nowrap group-hover:underline cursor-pointer">{row.warehouse}</td>
                                        <td className="px-4 py-3 text-[var(--text-primary)] font-medium max-w-[200px] truncate" title={row.product}>{row.product}</td>
                                        <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">{row.unit}</td>
                                        <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">{row.purchasingEmployee}</td>
                                        <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">{row.urgentPurchasingEmployee}</td>
                                        <td className="px-4 py-3 text-[var(--text-primary)] text-right font-mono whitespace-nowrap">{row.stockByUser}</td>
                                        <td className="px-4 py-3 text-[var(--text-primary)] text-right font-mono whitespace-nowrap">{row.orderedStock}</td>
                                        <td className="px-4 py-3 text-[var(--text-primary)] text-right font-mono whitespace-nowrap">{row.strangeStock}</td>
                                        <td className="px-4 py-3 text-[var(--text-primary)] text-right font-mono whitespace-nowrap">{row.warehouseStrangeStock}</td>
                                        <td className="px-4 py-3 text-[var(--text-primary)] text-right font-mono whitespace-nowrap">{row.historyConfidence}</td>
                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${row.confidenceLevel.includes('Lack')
                                                ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                                : row.confidenceLevel === 'No data'
                                                    ? 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                                                    : 'bg-green-500/10 text-green-500 border-green-500/20'
                                                }`}>
                                                {row.confidenceLevel}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Footer with Pagination */}
            <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-header)] flex items-center justify-between">
                <span className="text-sm text-[var(--text-muted)]">
                    Showing <span className="font-medium text-[var(--text-primary)]">{((currentPage - 1) * pageSize) + 1}</span> to <span className="font-medium text-[var(--text-primary)]">{Math.min(currentPage * pageSize, totalCount)}</span> of <span className="font-medium text-[var(--text-primary)]">{totalCount}</span> results
                </span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePreviousPage}
                        disabled={!hasPreviousPage}
                        className="p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg border border-[var(--border)] transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                        title="Previous Page"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <span className="text-sm font-medium text-[var(--text-primary)] px-4">
                        Page {currentPage} of {Math.max(1, totalPages)}
                    </span>
                    <button
                        onClick={handleNextPage}
                        disabled={!hasNextPage}
                        className="p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg border border-[var(--border)] transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                        title="Next Page"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};
