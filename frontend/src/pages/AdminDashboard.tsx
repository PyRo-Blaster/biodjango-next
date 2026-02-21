import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Check, X, Clock, FileText, Activity } from 'lucide-react';
import clsx from 'clsx';

interface Request {
    id: string;
    user: { username: string; email: string };
    project_name: string;
    reason: string;
    status: string;
    created_at: string;
}

interface AuditLog {
    id: number;
    actor_username: string;
    action: string;
    target_type: string;
    object_id: string;
    ip_address: string;
    timestamp: string;
    details: any;
}

export const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState<'requests' | 'audit'>('requests');
    const [requests, setRequests] = useState<Request[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchRequests = async () => {
        try {
            const response = await axios.get('/api/projects/access-requests/');
            setRequests(response.data);
        } catch (error) {
            console.error("Failed to fetch requests", error);
        }
    };

    const fetchAuditLogs = async () => {
        try {
            const response = await axios.get('/api/core/audit-logs/');
            setAuditLogs(response.data);
        } catch (error) {
            console.error("Failed to fetch audit logs", error);
        }
    };

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            await Promise.all([fetchRequests(), fetchAuditLogs()]);
            setIsLoading(false);
        };
        loadData();
    }, []);

    const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        try {
            await axios.patch(`/api/projects/access-requests/${id}/review/`, { status });
            fetchRequests(); // Refresh requests
        } catch (error) {
            alert("Failed to update status");
        }
    };

    if (isLoading) return (
        <div className="flex justify-center items-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800">Admin Dashboard</h2>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab('requests')}
                    className={clsx(
                        "px-4 py-2 rounded-md text-sm font-medium transition-all",
                        activeTab === 'requests' 
                            ? "bg-white text-primary-600 shadow-sm" 
                            : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    Access Requests
                </button>
                <button
                    onClick={() => setActiveTab('audit')}
                    className={clsx(
                        "px-4 py-2 rounded-md text-sm font-medium transition-all",
                        activeTab === 'audit' 
                            ? "bg-white text-primary-600 shadow-sm" 
                            : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    Audit Logs
                </button>
            </div>

            {/* Content */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {activeTab === 'requests' ? (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
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
                                        <span className={clsx(
                                            "px-2 py-1 rounded-full text-xs font-medium",
                                            req.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 
                                            req.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                        )}>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {req.status === 'PENDING' && (
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleReview(req.id, 'APPROVED')}
                                                    className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200 transition-colors"
                                                    title="Approve"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleReview(req.id, 'REJECTED')}
                                                    className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                                                    title="Reject"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {requests.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">No requests found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3">Timestamp</th>
                                <th className="px-6 py-3">Actor</th>
                                <th className="px-6 py-3">Action</th>
                                <th className="px-6 py-3">Target</th>
                                <th className="px-6 py-3">IP Address</th>
                                <th className="px-6 py-3">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {auditLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-900">
                                        {log.actor_username || 'System/Anonymous'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={clsx(
                                            "px-2 py-1 rounded text-xs font-bold uppercase",
                                            log.action === 'CREATE' ? "bg-green-100 text-green-700" :
                                            log.action === 'DELETE' ? "bg-red-100 text-red-700" :
                                            log.action === 'UPDATE' ? "bg-blue-100 text-blue-700" :
                                            "bg-slate-100 text-slate-700"
                                        )}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">
                                        <span className="font-mono text-xs bg-slate-100 px-1 rounded mr-1">{log.target_type}</span>
                                        <span className="text-xs text-slate-400">#{log.object_id}</span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                                        {log.ip_address || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 text-xs max-w-xs truncate" title={JSON.stringify(log.details, null, 2)}>
                                        {log.details?.name || JSON.stringify(log.details)}
                                    </td>
                                </tr>
                            ))}
                            {auditLogs.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">No audit logs found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
