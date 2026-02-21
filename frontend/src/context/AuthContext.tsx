import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
// import { jwtDecode } from 'jwt-decode';

interface User {
    username: string;
    email: string;
    is_staff?: boolean; // From JWT payload if available
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, refresh: string) => void;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    console.log("AuthProvider mounting...");
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const storedToken = localStorage.getItem('access_token');
            if (storedToken) {
                try {
                    // Temporary workaround to debug import issue
                    // const decoded: any = jwtDecode(storedToken);
                    const decoded = JSON.parse(atob(storedToken.split('.')[1]));
                    
                    // Check expiration
                    if (decoded.exp * 1000 < Date.now()) {
                        // Token expired, try refresh (TODO: Implement refresh logic)
                        logout();
                    } else {
                        setToken(storedToken);
                        setUser({ 
                            username: decoded.username || 'User', 
                            email: decoded.email || '',
                            is_staff: decoded.is_staff
                        });
                        // Setup default axios header
                        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
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
            // const decoded: any = jwtDecode(accessToken);
            const decoded = JSON.parse(atob(accessToken.split('.')[1]));
            setUser({ 
                username: decoded.username || 'User', 
                email: decoded.email || '',
                is_staff: decoded.is_staff
            });
        } catch (e) {
            console.error("Login decode error", e);
        }
        
        axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setToken(null);
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
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
