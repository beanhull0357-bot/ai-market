import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../supabaseClient';

interface User {
    id: string;
    email: string;
    role: 'admin' | 'viewer';
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isAdmin: boolean;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchUserRole(): Promise<'admin' | 'viewer'> {
    try {
        const { data, error } = await supabase.rpc('get_my_role');
        console.log('[Auth] fetchUserRole result:', { data, error: error?.message });
        if (error || !data) return 'viewer';
        return data === 'admin' ? 'admin' : 'viewer';
    } catch (e) {
        console.warn('[Auth] fetchUserRole exception, defaulting to viewer:', e);
        return 'viewer';
    }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check current session
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            console.log('[Auth] getSession:', session ? 'has session' : 'no session');
            if (session?.user) {
                const role = await fetchUserRole();
                setUser({
                    id: session.user.id,
                    email: session.user.email || '',
                    role,
                });
            }
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            console.log('[Auth] onAuthStateChange:', _event, session?.user?.email);
            if (session?.user) {
                const role = await fetchUserRole();
                setUser({
                    id: session.user.id,
                    email: session.user.email || '',
                    role,
                });
            } else {
                setUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        console.log('[Auth] signIn attempt:', email);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        console.log('[Auth] signIn result:', { success: !!data.session, error: error?.message });
        return { error: error?.message || null };
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            isAdmin: user?.role === 'admin',
            signIn,
            signOut,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
