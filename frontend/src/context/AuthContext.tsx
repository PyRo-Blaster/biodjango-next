import React, { createContext, useState, useEffect, useContext } from 'react';

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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
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
        };

        initAuth();
    }, []);

    const login = (accessToken: string, refreshToken: string) => {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        setToken(accessToken);
        
        try {
            setUser(decodeUser(accessToken));
        } catch (e) {
            console.error("Login decode error", e);
        }
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setToken(null);
        setUser(null);
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
