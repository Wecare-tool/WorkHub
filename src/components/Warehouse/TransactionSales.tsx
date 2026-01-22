import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useMsal } from '@azure/msal-react';
import { fetchTransactionSales, getAccessToken, TransactionSales, TransactionSalesPaginatedResponse } from '../../services/dataverse';

export const TransactionSalesTable: React.FC = () => {
    const { instance, accounts } = useMsal();
    const [data, setData] = useState<TransactionSales[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);
    const pageSize = 50;

    // Load data when component mounts or page changes
    useEffect(() => {
        loadData();
    }, [currentPage]);

    const loadData = async () => {
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

            setData(response.data);
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

    // Format date helper
    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('vi-VN');
    };

    const filteredData = data.filter(item =>
        (item.crdfd_maphieuxuat?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (item.crdfd_tensanphamtex?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (item.crdfd_idchitietonhang_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col bg-[var(--bg-card)] rounded-xl overflow-hidden border border-[var(--border)] shadow-lg backdrop-blur-md">

            {/* Header with Search */}
            <div className="px-6 py-5 border-b border-[var(--border)] bg-[var(--bg-header)] flex items-center justify-end gap-4">
                <div className="relative w-full max-w-lg group ml-auto">
                    <input
                        type="text"
                        placeholder="Search transactions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-4 pr-12 h-12 bg-[var(--bg-secondary)] border border-transparent rounded-full text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:bg-[var(--bg-card)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all shadow-sm hover:bg-[var(--bg-card-hover)]"
                    />
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <Search className="text-[var(--text-muted)] group-focus-within:text-[var(--accent-primary)] transition-colors h-5 w-5" />
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
                    <table className="w-full text-xs border-collapse">
                        <thead className="sticky top-0 bg-[var(--bg-card)] z-20 shadow-sm ring-1 ring-black/5">
                            <tr className="border-b border-[var(--border)]">
                                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap bg-[var(--bg-card)]">Mã Phiếu Xuất</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider bg-[var(--bg-card)]">Chi Tiết Đơn Hàng</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider bg-[var(--bg-card)]">Tên Sản Phẩm</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap bg-[var(--bg-card)]">SL Giao (Kho)</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap bg-[var(--bg-card)]">ĐV Theo Kho</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap bg-[var(--bg-card)]">Ngày Giao TT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {loading && data.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-[var(--text-muted)] animate-pulse">
                                        Loading data...
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-[var(--text-muted)]">
                                        No transaction sales found.
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((row) => (
                                    <tr
                                        key={row.crdfd_transactionsalesid}
                                        className="group transition-colors hover:bg-[var(--bg-hover)]"
                                    >
                                        <td className="px-4 py-3 text-[var(--accent-primary)] font-medium whitespace-nowrap hover:underline cursor-pointer align-top">{row.crdfd_maphieuxuat}</td>
                                        <td className="px-4 py-3 text-[var(--text-primary)] align-top">{row.crdfd_idchitietonhang_name}</td>
                                        <td className="px-4 py-3 text-[var(--text-primary)] align-top">{row.crdfd_tensanphamtex}</td>
                                        <td className="px-4 py-3 text-[var(--text-primary)] text-right font-mono whitespace-nowrap align-top">{row.crdfd_soluonggiaotheokho}</td>
                                        <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap align-top">{row.crdfd_onvitheokho}</td>
                                        <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap align-top">{formatDate(row.crdfd_ngaygiaothucte)}</td>
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
