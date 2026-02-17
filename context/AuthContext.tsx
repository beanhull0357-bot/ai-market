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

async function fetchUserRole(userId: string): Promise<'admin' | 'viewer'> {
    const { data, error } = await supabase.rpc('get_my_role');
    if (error || !data) return 'viewer';
    return data === 'admin' ? 'admin' : 'viewer';
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const loadUser = async (sessionUser: { id: string; email?: string }) => {
        const role = await fetchUserRole(sessionUser.id);
        setUser({
            id: sessionUser.id,
            email: sessionUser.email || '',
            role,
        });
    };

    useEffect(() => {
        // Check current session
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session?.user) {
                await loadUser(session.user);
            }
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                await loadUser(session.user);
            } else {
                setUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
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
