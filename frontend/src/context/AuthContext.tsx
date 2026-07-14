import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { installAuth } from '../api/client';

interface User {
    username: string;
    email: string;
    is_staff?: boolean;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, refresh: string) => void;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function decodeUser(token: string): User {
    const decoded = JSON.parse(atob(token.split('.')[1])) as {
        username?: string;
        email?: string;
        is_staff?: boolean;
    };
    return {
        username: decoded.username || 'User',
        email: decoded.email || '',
        is_staff: decoded.is_staff,
    };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));
    const [refresh, setRefresh] = useState<string | null>(localStorage.getItem('refresh_token'));
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const tokenRef = useRef(token);
    const refreshRef = useRef(refresh);
    tokenRef.current = token;
    refreshRef.current = refresh;

    const logout = useCallback(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setToken(null);
        setRefresh(null);
        setUser(null);
        navigate('/login');
    }, [navigate]);

    // Wire the auth seam so client.ts drives navigation on refresh failure
    // through React Router instead of window.location.href = '/login'.
    useEffect(() => {
        installAuth({
            getAccessToken: () => tokenRef.current,
            getRefreshToken: () => refreshRef.current,
            setAccessToken: (next) => {
                localStorage.setItem('access_token', next);
                setToken(next);
                try {
                    setUser(decodeUser(next));
                } catch {
                    // Malformed token — leave user state as-is; interceptor will 401 next call.
                }
            },
            onAuthFailure: logout,
        });
    }, [logout]);

    useEffect(() => {
        const storedToken = localStorage.getItem('access_token');
        if (storedToken) {
            try {
                const decoded = JSON.parse(atob(storedToken.split('.')[1])) as { exp: number };
                if (decoded.exp * 1000 < Date.now()) {
                    logout();
                } else {
                    setToken(storedToken);
                    setUser(decodeUser(storedToken));
                }
            } catch (error) {
                console.error("Invalid token", error);
                logout();
            }
        }
        setLoading(false);
    }, [logout]);

    const login = (accessToken: string, refreshToken: string) => {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        setToken(accessToken);
        setRefresh(refreshToken);

        try {
            setUser(decodeUser(accessToken));
        } catch (e) {
            console.error("Login decode error", e);
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
