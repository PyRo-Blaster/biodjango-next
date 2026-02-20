import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Check, X, Clock } from 'lucide-react';

interface Request {
    id: string;
    user: { username: string; email: string };
    project_name: string;
    reason: string;
    status: string;
    created_at: string;
}

export const AdminDashboard = () => {
    const [requests, setRequests] = useState<Request[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchRequests = async () => {
        try {
            const response = await axios.get('/api/projects/access-requests/');
            setRequests(response.data);
        } catch (error) {
            console.error("Failed to fetch requests", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        try {
            await axios.patch(`/api/projects/access-requests/${id}/review/`, { status });
            fetchRequests(); // Refresh list
        } catch (error) {
            alert("Failed to update status");
        }
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Access Requests</h2>
            
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                        <tr>
                            <th className="px-6 py-3">User</th>
                            <th className="px-6 py-3">Project</th>
                            <th className="px-6 py-3">Reason</th>
                            <th className="px-6 py-3">Date</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {requests.map((req) => (
                            <tr key={req.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-slate-900">{req.user.username}</div>
                                    <div className="text-xs text-slate-500">{req.user.email}</div>
                                </td>
                                <td className="px-6 py-4 font-medium">{req.project_name}</td>
                                <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={req.reason}>
                                    {req.reason}
                                </td>
                                <td className="px-6 py-4 text-slate-500">
                                    {new Date(req.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium
                                        ${req.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 
                                          req.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {req.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {req.status === 'PENDING' && (
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleReview(req.id, 'APPROVED')}
                                                className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200"
                                                title="Approve"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleReview(req.id, 'REJECTED')}
                                                className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                                                title="Reject"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {requests.length === 0 && (
                    <div className="p-8 text-center text-slate-500">No requests found.</div>
                )}
            </div>
        </div>
    );
};
