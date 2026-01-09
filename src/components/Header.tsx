import React from 'react';

interface HeaderProps {
    year: number;
    month: number;
    onMonthChange: (year: number, month: number) => void;
    title: string;
    showDateNav: boolean;
}

const monthNames = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

export const Header: React.FC<HeaderProps> = ({
    year,
    month,
    onMonthChange,
    title,
    showDateNav
}) => {

    const handlePrevMonth = () => {
        if (month === 0) {
            onMonthChange(year - 1, 11);
        } else {
            onMonthChange(year, month - 1);
        }
    };

    const handleNextMonth = () => {
        if (month === 11) {
            onMonthChange(year + 1, 0);
        } else {
            onMonthChange(year, month + 1);
        }
    };

    return (
        <header className="header">
            <div className="header-content">
                <div className="header-left">
                    <h1 className="app-title">{title}</h1>
                </div>

                <div className="header-right">
                    {showDateNav && (
                        <div className="month-selector">
                            <button className="nav-btn" onClick={handlePrevMonth} aria-label="Tháng trước">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 18 9 12 15 6"></polyline>
                                </svg>
                            </button>
                            <span className="current-month">
                                {monthNames[month]} {year}
                            </span>
                            <button className="nav-btn" onClick={handleNextMonth} aria-label="Tháng sau">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};
