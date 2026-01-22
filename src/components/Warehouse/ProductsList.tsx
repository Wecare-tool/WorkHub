import React, { useState, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, X, MapPin, Package, Box, RefreshCw } from 'lucide-react';
import { useMsal } from '@azure/msal-react';
import {
    fetchInventoryProducts,
    fetchWarehouseLocations,
    getAccessToken,
    InventoryProduct,
    InventoryProductsPaginatedResponse
} from '../../services/dataverse';
import { InventoryHistoryModal } from './InventoryHistoryModal';

interface LocationOption {
    id: string;
    name: string;
}

export const ProductsList: React.FC = () => {
    const { instance, accounts } = useMsal();
    const [data, setData] = useState<InventoryProduct[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Search & Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [locations, setLocations] = useState<LocationOption[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<string>('');
    const [onlyNegativeStock, setOnlyNegativeStock] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<InventoryProduct | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);
    const pageSize = 50;

    // Load locations on mount
    useEffect(() => {
        loadLocations();
    }, []);

    // Load data when page or filters change
    useEffect(() => {
        if (searchQuery || selectedLocation || onlyNegativeStock) {
            loadProducts();
        } else {
            setData([]);
            setTotalCount(0);
        }
    }, [currentPage, selectedLocation, onlyNegativeStock]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery || selectedLocation || onlyNegativeStock) {
                setCurrentPage(1);
                loadProducts();
            } else {
                setData([]);
                setTotalCount(0);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const loadLocations = async () => {
        if (!accounts[0]) return;
        try {
            const accessToken = await getAccessToken(instance, accounts[0]);
            const locationList = await fetchWarehouseLocations(accessToken);
            setLocations(locationList);
        } catch (err) {
            console.error('Error loading locations:', err);
        }
    };

    const loadProducts = useCallback(async () => {
        if (!accounts[0]) {
            setError('No authenticated account found');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const accessToken = await getAccessToken(instance, accounts[0]);
            const response: InventoryProductsPaginatedResponse = await fetchInventoryProducts(
                accessToken,
                currentPage,
                pageSize,
                searchQuery || undefined,
                selectedLocation ? [selectedLocation] : undefined,
                onlyNegativeStock ? 'negative' : 'all'
            );

            setData(response.data);
            setTotalCount(response.totalCount);
            setHasNextPage(response.hasNextPage);
            setHasPreviousPage(response.hasPreviousPage);
        } catch (err) {
            console.error('Error loading products:', err);
            setError('Failed to load data. Please try again.');
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [instance, accounts, currentPage, searchQuery, selectedLocation]);

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

    const clearFilters = () => {
        setSelectedLocation('');
        setOnlyNegativeStock(false);
        setSearchQuery('');
        setCurrentPage(1);
    };

    const totalPages = Math.ceil(totalCount / pageSize);
    const hasActiveFilters = selectedLocation || searchQuery || onlyNegativeStock;

    // Helper to group data by location
    const groupedData = data.reduce((acc, item) => {
        const location = item.locationName || 'Kho khác';
        if (!acc[location]) acc[location] = [];
        acc[location].push(item);
        return acc;
    }, {} as Record<string, InventoryProduct[]>);

    return (
        <div className="h-full flex flex-col bg-transparent text-[#fafafa] overflow-hidden font-['Inter']">
            {/* --- TOP CONTROL BAR --- */}
            <header className="px-6 py-8 flex flex-col gap-6 backdrop-blur-md bg-[#09090b]/20 border-b border-white/5 shadow-2xl">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-accent-primary/20 rounded-xl">
                                <Box className="text-accent-primary" size={24} />
                            </div>
                            <h1 className="text-3xl font-black tracking-tighter uppercase italic leading-none">
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">Inventory</span>
                                <span className="ml-2 text-accent-primary">Control</span>
                            </h1>
                        </div>
                        <p className="text-sm text-gray-400 font-medium tracking-wide flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${loading ? 'bg-accent-primary animate-pulse' : 'bg-green-500'}`}></span>
                            {loading ? 'Đang đồng bộ dữ liệu...' : `Hệ thống ghi nhận ${totalCount.toLocaleString()} mã hàng`}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Search Input */}
                        <div className="relative group min-w-[300px] flex-1">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search size={18} className="text-gray-500 group-focus-within:text-accent-primary transition-colors duration-300" />
                            </div>
                            <input
                                type="text"
                                placeholder="Tên sản phẩm, barcode..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="block w-full pl-11 pr-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-sm transition-all focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary/50 outline-none backdrop-blur-sm"
                            />
                        </div>

                        {/* Negative Filter Toggle */}
                        <div
                            onClick={() => {
                                setOnlyNegativeStock(!onlyNegativeStock);
                                setCurrentPage(1);
                            }}
                            className={`flex items-center gap-3 px-5 py-3 rounded-2xl border cursor-pointer transition-all duration-300 select-none ${onlyNegativeStock
                                ? 'bg-red-500/20 border-red-500/50 text-red-500 shadow-lg shadow-red-500/10'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/30'
                                }`}
                        >
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${onlyNegativeStock ? 'bg-red-500 border-red-500' : 'border-white/20'}`}>
                                {onlyNegativeStock && <X size={10} className="text-white" />}
                            </div>
                            <span className="text-sm font-bold tracking-tight">Tồn TT âm</span>
                        </div>

                        {/* Location Select */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <MapPin size={16} className="text-accent-primary" />
                            </div>
                            <select
                                value={selectedLocation}
                                onChange={(e) => {
                                    setSelectedLocation(e.target.value);
                                    setCurrentPage(1);
                                }}
                                title="Chọn vị trí kho"
                                className="pl-11 pr-10 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-gray-200 outline-none hover:border-white/30 appearance-none cursor-pointer backdrop-blur-sm"
                            >
                                <option value="" className="bg-[#18181b]">Tất cả vị trí kho</option>
                                {locations.map(loc => (
                                    <option key={loc.id} value={loc.id} className="bg-[#18181b]">{loc.name}</option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <ChevronRight size={16} className="text-gray-500 rotate-90" />
                            </div>
                        </div>

                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="p-3 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 hover:bg-red-500/20 transition-all active:scale-95 shadow-xl"
                                title="Xóa lọc"
                            >
                                <RefreshCw size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* --- MAIN CONTENT AREA --- */}
            <main className="flex-1 overflow-auto custom-scrollbar p-6">
                {error ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-70">
                        <div className="text-red-500 text-6xl">⚠️</div>
                        <h3 className="text-xl font-bold">Lỗi trích xuất dữ liệu</h3>
                        <p className="max-w-xs text-center text-gray-500">{error}</p>
                    </div>
                ) : !hasActiveFilters ? (
                    <div className="flex flex-col items-center justify-center h-[50vh] space-y-6">
                        <div className="relative">
                            <div className="absolute inset-0 bg-accent-primary/20 blur-[100px] rounded-full"></div>
                            <Search size={100} strokeWidth={0.5} className="relative text-accent-primary/20" />
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black uppercase tracking-tight text-white/80">Sẵn sàng kiểm kê</h3>
                            <p className="text-gray-500 max-w-sm font-medium">Chọn một kho cụ thể hoặc nhập từ khóa để xem báo cáo chi tiết.</p>
                        </div>
                    </div>
                ) : data.length === 0 && !loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div className="text-5xl mb-4">🔍</div>
                        <h3 className="text-lg font-bold text-white">Không tìm thấy sản phẩm</h3>
                        <p className="text-gray-500 text-sm">Vui lòng thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm.</p>
                    </div>
                ) : (
                    <div className="space-y-12 pb-24">
                        {Object.entries(groupedData).map(([location, products]) => (
                            <section key={location} className="animate-in fade-in slide-in-from-top-2 duration-500">
                                {/* Category Header */}
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="h-[2px] w-8 bg-accent-primary/50"></div>
                                    <h2 className="text-lg font-black uppercase tracking-[0.2em] text-accent-primary">
                                        {location}
                                    </h2>
                                    <div className="flex-1 h-[1px] bg-white/5"></div>
                                    <span className="text-[10px] font-black tracking-widest text-[#71717a] bg-white/5 px-4 py-1.5 rounded-full border border-white/5 uppercase">
                                        {products.length} mã hàng
                                    </span>
                                </div>

                                {/* Responsive Card Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {products.map((row) => (
                                        <div
                                            key={row.crdfd_kho_binh_dinhid}
                                            onClick={() => setSelectedProduct(row)}
                                            className="group relative bg-[#1c1c1e]/40 hover:bg-[#2c2c2e]/60 border border-white/5 hover:border-accent-primary/40 rounded-[2rem] p-5 cursor-pointer transition-all duration-500 shadow-xl overflow-hidden backdrop-blur-xl"
                                        >
                                            {/* Top Row: Name & Icon */}
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="min-w-0 pr-4">
                                                    <h3 className="text-sm font-bold text-white group-hover:text-accent-primary transition-colors line-clamp-2 leading-tight" title={row.productName}>
                                                        {row.productName || 'Không xác định'}
                                                    </h3>
                                                    <span className="inline-block mt-2 text-[10px] uppercase font-black tracking-widest text-[#71717a] group-hover:text-gray-300">
                                                        {row.crdfd_onvi || 'đơn vị'}
                                                    </span>
                                                </div>
                                                <div className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 ${(row.crdfd_tonkhothucte ?? 0) < 0 ? 'bg-red-500/10 text-red-500 ring-1 ring-red-500/20' :
                                                    (row.crdfd_tonkhothucte ?? 0) === 0 ? 'bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20' :
                                                        'bg-green-500/10 text-green-400 ring-1 ring-green-500/20'
                                                    }`}>
                                                    <Package size={20} className="group-hover:scale-110 transition-transform" />
                                                </div>
                                            </div>

                                            {/* Stats Display */}
                                            <div className="space-y-2 border-t border-white/5 pt-4">
                                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-[#71717a]">
                                                    <span>Thực tế</span>
                                                    <span className={`text-[15px] font-mono leading-none ${(row.crdfd_tonkhothucte ?? 0) < 0 ? 'text-red-500' :
                                                        (row.crdfd_tonkhothucte ?? 0) === 0 ? 'text-orange-400' : 'text-green-400'
                                                        }`}>
                                                        {(row.crdfd_tonkhothucte ?? 0).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-[#71717a]">
                                                    <span>Lý thuyết</span>
                                                    <span className="text-[14px] font-mono text-white/90">
                                                        {(row.crdfd_tonkholythuyet ?? 0).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-accent-primary/60 mt-1">
                                                    <span>Kế hoạch</span>
                                                    <span className="text-[12px] font-mono font-bold text-accent-primary">
                                                        {(row.crdfd_ton_kho_theo_ke_hoach ?? 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Subtle Decorative bar */}
                                            <div className={`absolute bottom-0 left-0 h-1 transition-all duration-500 group-hover:opacity-100 ${(row.crdfd_tonkhothucte ?? 0) < 0 ? 'bg-red-500 w-full opacity-50' :
                                                (row.crdfd_tonkhothucte ?? 0) === 0 ? 'bg-orange-500 w-1/3 opacity-30' : 'bg-green-500 w-1/4 opacity-20'
                                                }`}></div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </main>

            {/* --- MODERN FLOATING PAGINATION --- */}
            {hasActiveFilters && totalCount > pageSize && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 px-8 py-4 bg-[#1c1c1e]/80 backdrop-blur-2xl border border-white/10 rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/5 animate-in slide-in-from-bottom-10 duration-700">
                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase font-black tracking-widest text-[#71717a]">Trang</span>
                        <span className="text-lg font-black text-accent-primary">{currentPage}</span>
                        <span className="text-xs text-[#71717a]">/ {Math.max(1, totalPages)}</span>
                    </div>

                    <div className="h-6 w-[1px] bg-white/10"></div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handlePreviousPage}
                            disabled={!hasPreviousPage}
                            title="Trang trước"
                            className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-20 hover:bg-white/5 rounded-2xl transition-all"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <button
                            onClick={handleNextPage}
                            disabled={!hasNextPage}
                            title="Trang sau"
                            className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-20 hover:bg-white/5 rounded-2xl transition-all"
                        >
                            <ChevronRight size={24} />
                        </button>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {selectedProduct && (
                <InventoryHistoryModal
                    product={selectedProduct}
                    onClose={() => setSelectedProduct(null)}
                />
            )}
        </div>
    );
};
