import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    SearchOutlined,
    LeftOutlined,
    RightOutlined,
    ReloadOutlined
} from '@ant-design/icons';
import { useMsal } from '@azure/msal-react';
import {
    getAccessToken,
    fetchInventoryCheck,
    fetchWarehouseLocationsForFilter,
    InventoryCheckItem,
    InventoryCheckPaginatedResponse,
    WarehouseLocationOption
} from '../../services/dataverseService';

const ITEMS_PER_PAGE = 20;

export const InventoryCheck: React.FC = () => {
    const { instance, accounts } = useMsal();
    const [isNegativeFilter, setIsNegativeFilter] = useState(false);
    const [isNonZeroFilter, setIsNonZeroFilter] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    // Data states
    const [inventoryData, setInventoryData] = useState<InventoryCheckItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [locations, setLocations] = useState<WarehouseLocationOption[]>([]);
    const [selectedLocations, setSelectedLocations] = useState<string[]>([]);


    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedLocations, isNonZeroFilter, isNegativeFilter]);

    // Load warehouse locations for filter
    useEffect(() => {
        const loadLocations = async () => {
            if (accounts.length === 0) return;

            try {
                const token = await getAccessToken(instance, accounts[0]);
                const locs = await fetchWarehouseLocationsForFilter(token);
                setLocations(locs);
            } catch (err) {
                console.error("Error loading locations:", err);
            }
        };

        loadLocations();
    }, [instance, accounts]);

    // Load inventory data
    const loadData = useCallback(async () => {
        if (accounts.length === 0) return;

        setLoading(true);
        setError(null);

        try {
            const token = await getAccessToken(instance, accounts[0]);

            // Now perform server-side searching and filtering
            const response: InventoryCheckPaginatedResponse = await fetchInventoryCheck(
                token,
                1,
                2000, // Fetch up to 2000 matches
                debouncedSearch || undefined,
                selectedLocations.length > 0 ? selectedLocations : undefined,
                isNegativeFilter ? 'negative' : (isNonZeroFilter ? 'nonzero' : 'all')
            );

            setInventoryData(response.data);
        } catch (err) {
            console.error("Error loading inventory:", err);
            setError("Không thể tải dữ liệu tồn kho");
        } finally {
            setLoading(false);
        }
    }, [instance, accounts, selectedLocations, debouncedSearch, isNegativeFilter, isNonZeroFilter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredData = useMemo(() => {
        return inventoryData;
    }, [inventoryData]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredData.slice(start, start + ITEMS_PER_PAGE);
    }, [currentPage, filteredData]);

    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const handleLocationFilter = (locationId: string) => {
        setSelectedLocations(prev => {
            if (prev.includes(locationId)) {
                return prev.filter(id => id !== locationId);
            } else {
                return [...prev, locationId];
            }
        });
    };

    const toggleNonZeroFilter = () => {
        setIsNonZeroFilter(prev => {
            if (!prev) setIsNegativeFilter(false); // Mutually exclusive for simplicity in service
            return !prev;
        });
    };

    const toggleNegativeFilter = () => {
        setIsNegativeFilter(prev => {
            if (!prev) setIsNonZeroFilter(false); // Mutually exclusive for simplicity in service
            return !prev;
        });
    };

    const handleRefresh = () => {
        loadData();
    };

    const renderPagination = () => {
        const pages: (number | string)[] = [];

        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 3) {
                pages.push(1, 2, 3, 4, '...', totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
            } else {
                pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
            }
        }
        return pages;
    };

    return (
        <div className="inventory-check">
            {/* Unified Header */}
            <div className="inventory-check-header">
                {/* Toolbar */}
                <div className="inventory-check-toolbar">
                    <div className="inventory-check-location-tags">
                        {/* Status Tags */}
                        <button
                            className={`location-tag ${isNonZeroFilter ? 'active' : ''}`}
                            onClick={toggleNonZeroFilter}
                        >
                            Khác 0
                        </button>
                        <button
                            className={`location-tag ${isNegativeFilter ? 'active' : ''}`}
                            onClick={toggleNegativeFilter}
                        >
                            Âm kho
                        </button>

                        {/* Warehouse Tags */}
                        {locations.map(loc => (
                            <button
                                key={loc.id}
                                className={`location-tag ${selectedLocations.includes(loc.id) ? 'active' : ''}`}
                                onClick={() => handleLocationFilter(loc.id)}
                            >
                                {loc.name}
                            </button>
                        ))}
                    </div>

                    <div className="inventory-check-search">
                        <SearchOutlined className="search-icon" style={{ fontSize: 14 }} />
                        <input
                            type="text"
                            placeholder="Tìm mã SP, tên SP..."
                            value={searchTerm}
                            onChange={handleSearch}
                        />
                    </div>

                    {/* Refresh */}
                    <button
                        className="inventory-check-filter-btn"
                        onClick={handleRefresh}
                        disabled={loading}
                        title="Làm mới"
                    >
                        <ReloadOutlined className={loading ? 'spinning' : ''} style={{ fontSize: 14 }} />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="inventory-check-table-container">
                <table className="inventory-check-table">
                    <thead>
                        <tr>
                            <th>Mã sản phẩm</th>
                            <th>Tên sản phẩm</th>
                            <th>ĐVT</th>
                            <th className="text-right">Tồn thực tế</th>
                            <th className="text-right">Tồn lý thuyết</th>
                            <th className="text-right">Tồn khả dụng</th>
                            <th className="text-right">Hàng lỗi</th>
                            <th>Vị trí kho</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && inventoryData.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="loading-cell">
                                    <ReloadOutlined spin /> Đang tải dữ liệu...
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td colSpan={8} className="no-data text-danger">{error}</td>
                            </tr>
                        ) : paginatedData.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="no-data">Không tìm thấy sản phẩm nào</td>
                            </tr>
                        ) : (
                            paginatedData.map((item) => (
                                <tr key={item.crdfd_kho_binh_dinhid}>
                                    <td className="font-medium text-accent-primary">{item.productCode}</td>
                                    <td>{item.productName}</td>
                                    <td>Cái</td>
                                    <td className={`text-right ${item.tonKhoThucTe < 0 ? 'text-danger' : ''}`}>
                                        {item.tonKhoThucTe.toLocaleString()}
                                    </td>
                                    <td className="text-right">{item.tonKhoLyThuyet.toLocaleString()}</td>
                                    <td className="text-right">{item.tonKhaDung.toLocaleString()}</td>
                                    <td className="text-right text-warning">
                                        {item.hangLoiSauKiem > 0 ? item.hangLoiSauKiem.toLocaleString() : '-'}
                                    </td>
                                    <td>{item.warehouseLocation}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && !loading && (
                <div className="inventory-check-pagination">
                    <span className="pagination-info">
                        Hiển thị {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} / {totalItems}
                    </span>

                    <div className="pagination-controls">
                        <button
                            className="pagination-btn"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => prev - 1)}
                            title="Trang trước"
                        >
                            <LeftOutlined style={{ fontSize: 14 }} />
                        </button>

                        {renderPagination().map((page, index) => (
                            typeof page === 'number' ? (
                                <button
                                    key={index}
                                    className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                                    onClick={() => setCurrentPage(page)}
                                >
                                    {page}
                                </button>
                            ) : (
                                <span key={index} className="pagination-ellipsis">{page}</span>
                            )
                        ))}

                        <button
                            className="pagination-btn"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            title="Trang sau"
                        >
                            <RightOutlined style={{ fontSize: 14 }} />
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
};
