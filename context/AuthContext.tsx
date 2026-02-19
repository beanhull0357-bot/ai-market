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

const DEMO_EMAIL = 'demo@jsonmart.xyz';

// Fetch role with timeout to prevent hanging
async function fetchUserRole(email?: string): Promise<'admin' | 'viewer'> {
    // Demo account always gets admin access
    if (email === DEMO_EMAIL) {
        console.log('[Auth] Demo account detected — granting admin role');
        return 'admin';
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const { data, error } = await supabase.rpc('get_my_role', {}, {
            signal: controller.signal as any,
        } as any);

        clearTimeout(timeout);
        console.log('[Auth] fetchUserRole:', { data, error: error?.message });
        if (error || !data) return 'viewer';
        return data === 'admin' ? 'admin' : 'viewer';
    } catch (e) {
        console.warn('[Auth] fetchUserRole failed, defaulting to viewer:', e);
        return 'viewer';
    }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        // Check current session
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (!isMounted) return;
            console.log('[Auth] getSession:', session ? `has session (${session.user.email})` : 'no session');
            if (session?.user) {
                const role = await fetchUserRole(session.user.email);
                if (isMounted) {
                    setUser({
                        id: session.user.id,
                        email: session.user.email || '',
                        role,
                    });
                }
            }
            if (isMounted) setLoading(false);
        });

        // Listen for auth changes — DON'T await loadUser to avoid blocking signInWithPassword
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            console.log('[Auth] onAuthStateChange:', _event, session?.user?.email);
            if (session?.user) {
                const sessionUser = session.user;
                // Fire and forget — don't block the auth state change
                fetchUserRole(sessionUser.email).then(role => {
                    if (isMounted) {
                        setUser({
                            id: sessionUser.id,
                            email: sessionUser.email || '',
                            role,
                        });
                    }
                });
            } else {
                if (isMounted) setUser(null);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const signIn = async (email: string, password: string) => {
        console.log('[Auth] signIn attempt:', email);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        console.log('[Auth] signIn result:', { success: !!data.session, error: error?.message });
        return { error: error?.message || null };
    };

    const signOut = async () => {
        console.log('[Auth] signOut');
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
