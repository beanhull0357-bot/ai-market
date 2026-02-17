import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader, ShieldOff } from 'lucide-react';

interface AdminRouteProps {
    children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
    const { user, loading, isAdmin } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-terminal-bg flex items-center justify-center">
                <Loader className="animate-spin text-terminal-green" size={24} />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/auth" replace />;
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-terminal-bg flex items-center justify-center">
                <div style={{
                    textAlign: 'center', padding: 32,
                    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)', maxWidth: 400,
                }}>
                    <ShieldOff size={48} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                        Access Denied
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        관리자 권한이 필요합니다.
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
