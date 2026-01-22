import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="error-boundary" style={{
                    padding: '2rem',
                    textAlign: 'center',
                    color: '#ef4444'
                }}>
                    <h2>⚠️ Đã xảy ra lỗi</h2>
                    <p>Ứng dụng gặp sự cố không mong muốn.</p>
                    {import.meta.env.DEV && this.state.error && (
                        <details style={{ marginTop: '1rem', textAlign: 'left' }}>
                            <summary>Chi tiết lỗi (Development)</summary>
                            <pre style={{ 
                                background: '#f3f4f6', 
                                padding: '1rem', 
                                borderRadius: '4px',
                                overflow: 'auto'
                            }}>
                                {this.state.error.toString()}
                            </pre>
                        </details>
                    )}
                    <button
                        onClick={() => {
                            this.setState({ hasError: false, error: null });
                            window.location.reload();
                        }}
                        style={{
                            marginTop: '1rem',
                            padding: '0.5rem 1rem',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Tải lại trang
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

