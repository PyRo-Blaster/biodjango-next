import React, { useState } from 'react';
import { Upload, FileText, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '../api/client';
import { ExportPDFButton } from '../components/ExportPDFButton';
import clsx from 'clsx';
import { RateLimitAlert } from '../components/RateLimitAlert';
import { useAnalysisTool } from '../hooks/useAnalysisTool';

interface AnalysisSummary {
    sequences: {
        id: string;
        num_cysteines: number;
        molecular_weight: number;
    }[];
    total_summary: {
        total_isoelectric_point: number;
        total_molecular_weight: number;
        extinction_coefficient: number;
        total_sequences_count: number;
    };
}

export const SequenceAnalysis = () => {
    const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [textInput, setTextInput] = useState('');
    const [result, setResult] = useState<AnalysisSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { loading, errorInfo, execute, resetError } = useAnalysisTool<AnalysisSummary>();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setResult(null);
        resetError();

        if (activeTab === 'upload' && !file) {
            setError("Please select a FASTA file.");
            return;
        }
        if (activeTab === 'paste' && !textInput.trim()) {
            setError("Please paste sequence content.");
            return;
        }

        const formData = new FormData();

        if (activeTab === 'upload' && file) {
            formData.append('fasta_file', file);
        } else {
            formData.append('fasta_content', textInput);
        }

        const response = await execute(async () => {
            const resultData = await apiClient.post<AnalysisSummary>('/analysis/sequence-analysis/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            return resultData.data;
        });

        if (response) {
            setResult(response);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800">Sequence Analysis</h2>
                {result && (
                    <ExportPDFButton 
                        type="PEPTIDE" 
                        data={result} 
                        filename="sequence_analysis_report.pdf" 
                    />
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Input Section */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="flex border-b border-slate-200">
                            <button
                                onClick={() => setActiveTab('upload')}
                                className={clsx(
                                    "flex-1 py-3 text-sm font-medium transition-colors",
                                    activeTab === 'upload' ? "bg-primary-50 text-primary-700 border-b-2 border-primary-500" : "text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                Upload File
                            </button>
                            <button
                                onClick={() => setActiveTab('paste')}
                                className={clsx(
                                    "flex-1 py-3 text-sm font-medium transition-colors",
                                    activeTab === 'paste' ? "bg-primary-50 text-primary-700 border-b-2 border-primary-500" : "text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                Paste Text
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {errorInfo?.isRateLimited && (
                                <RateLimitAlert
                                    retryAfter={errorInfo.retryAfter || 10}
                                    message={errorInfo.message}
                                    onRetryReady={resetError}
                                />
                            )}

                            {activeTab === 'upload' ? (
                                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                                    <input
                                        type="file"
                                        accept=".fasta,.fa,.txt"
                                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                    <p className="text-sm text-slate-600 font-medium">
                                        {file ? file.name : "Click to upload FASTA"}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">.fasta, .txt supported</p>
                                </div>
                            ) : (
                                <textarea
                                    value={textInput}
                                    onChange={(e) => setTextInput(e.target.value)}
                                    placeholder=">Seq1&#10;MTEITAAMVKELRESTGAGMMDCKNALSETNGDFDKAVQLLREKGLGKAAKKADRLAAEG"
                                    className="w-full h-48 p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono text-sm resize-none"
                                />
                            )}

                            {(error || (errorInfo && !errorInfo.isRateLimited)) && (
                                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <span>{error || errorInfo?.message}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Analyze Sequences'}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="lg:col-span-2">
                    {result ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-primary-500" />
                                    Cumulative Summary
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <div className="text-sm text-slate-500 mb-1">Total Sequences</div>
                                        <div className="text-2xl font-bold text-slate-900">{result.total_summary.total_sequences_count}</div>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <div className="text-sm text-slate-500 mb-1">Total Molecular Weight</div>
                                        <div className="text-2xl font-bold text-slate-900">{result.total_summary.total_molecular_weight.toLocaleString()} <span className="text-sm font-normal text-slate-500">Da</span></div>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <div className="text-sm text-slate-500 mb-1">Isoelectric Point (pI)</div>
                                        <div className="text-2xl font-bold text-slate-900">{result.total_summary.total_isoelectric_point}</div>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <div className="text-sm text-slate-500 mb-1">Extinction Coeff.</div>
                                        <div className="text-2xl font-bold text-slate-900">{result.total_summary.extinction_coefficient}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                                    <h4 className="font-semibold text-slate-700">Detailed Analysis</h4>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200 text-slate-500">
                                                <th className="px-6 py-3 font-medium">Sequence ID</th>
                                                <th className="px-6 py-3 font-medium">Cysteines</th>
                                                <th className="px-6 py-3 font-medium text-right">Molecular Weight (Da)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {result.sequences.map((seq, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-3 font-mono text-primary-600">{seq.id}</td>
                                                    <td className="px-6 py-3">{seq.num_cysteines}</td>
                                                    <td className="px-6 py-3 text-right font-mono">{seq.molecular_weight.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                            <DnaIcon className="w-16 h-16 mb-4 opacity-20" />
                            <p>Upload or paste sequences to view analysis results</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const DnaIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/><path d="M17 6l-2.5-2.5"/><path d="M14 8l-1-1"/><path d="M7 18l2.5 2.5"/><path d="M3.5 14.5l-1 1"/><path d="M20 9l2.5 2.5"/><path d="M6.5 12.5l1 1"/><path d="M16.5 10.5l1 1"/><path d="M10 16l1.5 1.5"/></svg>
);
