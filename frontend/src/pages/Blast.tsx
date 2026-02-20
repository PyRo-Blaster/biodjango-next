import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Loader2, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import { BlastViewer } from '../components/BlastViewer';
import clsx from 'clsx';

interface TaskResponse {
    id: string;
    status: 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE';
    result?: {
        output: string;
    };
    error_message?: string;
}

export const Blast = () => {
    const [sequence, setSequence] = useState('');
    const [evalue, setEvalue] = useState('1e-6');
    const [db, setDb] = useState('swissprot');
    
    const [taskId, setTaskId] = useState<string | null>(null);
    const [taskStatus, setTaskStatus] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Polling effect
    useEffect(() => {
        let intervalId: any;

        if (taskId && taskStatus !== 'SUCCESS' && taskStatus !== 'FAILURE') {
            intervalId = setInterval(async () => {
                try {
                    const response = await axios.get<TaskResponse>(`/api/analysis/tasks/${taskId}/`);
                    setTaskStatus(response.data.status);
                    
                    if (response.data.status === 'SUCCESS' && response.data.result) {
                        setResult(response.data.result.output);
                        // setTaskId(null); // Keep taskId to show result
                    } else if (response.data.status === 'FAILURE') {
                        setError(response.data.error_message || "Task failed");
                        // setTaskId(null); // Keep taskId to show error
                    }
                } catch (err) {
                    console.error("Polling error", err);
                    setTaskId(null); // Stop polling on network error
                }
            }, 2000); // Poll every 2 seconds
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [taskId, taskStatus]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setResult(null);
        setTaskId(null);
        setTaskStatus(null);

        try {
            const response = await axios.post('/api/analysis/blast/', {
                sequence,
                evalue: parseFloat(evalue),
                db
            });
            setTaskId(response.data.id);
            setTaskStatus('PENDING');
        } catch (err: any) {
            console.error("Submission failed", err);
            setError(err.response?.data?.detail || "Submission failed. Please check your inputs.");
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-2xl font-bold text-slate-800">BLAST Search</h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Input Form */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Sequence (FASTA)</label>
                                <textarea
                                    value={sequence}
                                    onChange={(e) => setSequence(e.target.value)}
                                    placeholder=">Seq1&#10;MTEITAAMVKELRESTGAGMMDCKNALSETNGDFDKAVQLLREKGLGKAAKKADRLAAEG"
                                    className="w-full h-48 p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono text-sm resize-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">E-Value</label>
                                <select
                                    value={evalue}
                                    onChange={(e) => setEvalue(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                                >
                                    <option value="10">10</option>
                                    <option value="1">1</option>
                                    <option value="0.1">0.1</option>
                                    <option value="1e-3">1e-3</option>
                                    <option value="1e-6">1e-6</option>
                                    <option value="1e-10">1e-10</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Database</label>
                                <select
                                    value={db}
                                    onChange={(e) => setDb(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                                >
                                    <option value="test_db">Test DB</option>
                                    <option value="swissprot">SwissProt</option>
                                    <option value="pdbaa">PDB</option>
                                    {/* Add more DBs if configured */}
                                </select>
                            </div>

                            <button
                                type="submit"
                                disabled={!!taskId}
                                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {taskId ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Run BLAST'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Results Section */}
                <div className="lg:col-span-2">
                    {taskId ? (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center min-h-[300px] text-center space-y-4">
                             {taskStatus === 'SUCCESS' ? (
                                <div className="space-y-4 w-full text-left">
                                     <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                        <div className="flex items-center gap-4">
                                            <h3 className="font-semibold text-green-600 flex items-center gap-2">
                                                <FileText className="w-5 h-5" />
                                                Analysis Complete
                                            </h3>
                                            <button 
                                                onClick={() => {
                                                    setTaskId(null);
                                                    setResult(null);
                                                    setTaskStatus(null);
                                                }}
                                                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-md transition-colors"
                                            >
                                                Start New Search
                                            </button>
                                        </div>
                                        <span className="text-xs text-slate-400">Task ID: {taskId}</span>
                                     </div>
                                     <div className="w-full text-left">
                                        {result && <BlastViewer output={result} />}
                                     </div>
                                </div>
                             ) : taskStatus === 'FAILURE' ? (
                                <div className="text-red-500 flex flex-col items-center">
                                    <AlertCircle className="w-12 h-12 mb-2" />
                                    <p className="font-medium">Analysis Failed</p>
                                    <p className="text-sm mt-2 bg-red-50 p-2 rounded">{error}</p>
                                </div>
                             ) : (
                                 <div className="text-primary-600 flex flex-col items-center animate-pulse">
                                     <RefreshCw className="w-12 h-12 mb-4 animate-spin" />
                                     <p className="font-medium text-lg">Running Analysis...</p>
                                     <p className="text-slate-500">Status: {taskStatus}</p>
                                 </div>
                             )}
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                            <Search className="w-16 h-16 mb-4 opacity-20" />
                            <p>Enter sequence to start BLAST search</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
