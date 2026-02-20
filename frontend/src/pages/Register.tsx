import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { UserPlus, Lock, User, Mail, AlertCircle } from 'lucide-react';

export const Register = () => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        password_confirm: ''
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.password !== formData.password_confirm) {
            setError("Passwords do not match");
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await axios.post('/api/auth/register/', {
                username: formData.username,
                email: formData.email,
                password: formData.password,
                password_confirm: formData.password_confirm
            });
            // On success, redirect to login
            navigate('/login');
        } catch (err: any) {
            console.error("Registration failed", err);
            // DRF returns errors like { username: ["error"], password: ["error"] }
            const errorData = err.response?.data;
            let errorMsg = "Registration failed.";
            if (typeof errorData === 'object') {
                errorMsg = Object.values(errorData).flat().join(' ');
            }
            setError(errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                        <UserPlus className="h-6 w-6 text-green-600" />
                    </div>
                    <h2 className="mt-6 text-3xl font-extrabold text-slate-900">Create your account</h2>
                    <p className="mt-2 text-sm text-slate-600">
                        Already have an account?{' '}
                        <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
                            Sign in
                        </Link>
                    </p>
                </div>
                
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center gap-2 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <User className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                                name="username"
                                type="text"
                                required
                                className="appearance-none rounded-none rounded-t-md relative block w-full px-3 py-2 pl-10 border border-slate-300 placeholder-slate-500 text-slate-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                                placeholder="Username"
                                value={formData.username}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Mail className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                                name="email"
                                type="email"
                                required
                                className="appearance-none rounded-none relative block w-full px-3 py-2 pl-10 border border-slate-300 placeholder-slate-500 text-slate-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                                placeholder="Email address"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                                name="password"
                                type="password"
                                required
                                className="appearance-none rounded-none relative block w-full px-3 py-2 pl-10 border border-slate-300 placeholder-slate-500 text-slate-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                                placeholder="Password"
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                                name="password_confirm"
                                type="password"
                                required
                                className="appearance-none rounded-none rounded-b-md relative block w-full px-3 py-2 pl-10 border border-slate-300 placeholder-slate-500 text-slate-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                                placeholder="Confirm Password"
                                value={formData.password_confirm}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                        >
                            {isLoading ? 'Creating account...' : 'Register'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
