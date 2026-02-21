import React, { useState } from 'react';
import axios from 'axios';
import { ShieldCheck, Info } from 'lucide-react';
import clsx from 'clsx';

interface AnnotationResult {
    chain_type: string;
    scheme: string;
    regions: {
        FR1: string;
        CDR1: string;
        FR2: string;
        CDR2: string;
        FR3: string;
        CDR3: string;
        FR4: string;
    };
    numbering: Record<string, string>;
}

export const AntibodyAnnotation = () => {
    const [sequence, setSequence] = useState('');
    const [scheme, setScheme] = useState('imgt');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<AnnotationResult | null>(null);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setResult(null);

        try {
            const response = await axios.post('/api/analysis/antibody-annotation/', {
                sequence,
                scheme
            });
            setResult(response.data);
        } catch (err: any) {
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to annotate sequence');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-primary-600" />
                Antibody Annotation
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Input */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm h-fit">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Protein Sequence
                            </label>
                            <textarea
                                value={sequence}
                                onChange={(e) => setSequence(e.target.value.toUpperCase().replace(/[^A-Z*]/g, ''))}
                                className="w-full h-40 p-3 text-sm font-mono border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                placeholder="QVQL..."
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Numbering Scheme
                            </label>
                            <select
                                value={scheme}
                                onChange={(e) => setScheme(e.target.value)}
                                className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            >
                                <option value="imgt">IMGT</option>
                                <option value="kabat">Kabat</option>
                                <option value="chothia">Chothia</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Annotating...' : 'Annotate CDRs'}
                        </button>
                    </form>
                </div>

                {/* Results */}
                <div className="lg:col-span-2">
                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 mb-4">
                            {error}
                        </div>
                    )}

                    {result && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                                <h3 className="font-semibold text-lg text-slate-800 dark:text-white mb-2">Annotation Result</h3>
                                <div className="flex gap-4 text-sm text-slate-500">
                                    <span>Chain: <strong className="text-slate-700 dark:text-slate-300 uppercase">{result.chain_type}</strong></span>
                                    <span>Scheme: <strong className="text-slate-700 dark:text-slate-300 uppercase">{result.scheme}</strong></span>
                                </div>
                            </div>
                            
                            <div className="p-6">
                                <div className="flex flex-wrap gap-1 font-mono text-sm leading-relaxed">
                                    <RegionChunk label="FR1" sequence={result.regions.FR1} color="gray" />
                                    <RegionChunk label="CDR1" sequence={result.regions.CDR1} color="red" />
                                    <RegionChunk label="FR2" sequence={result.regions.FR2} color="gray" />
                                    <RegionChunk label="CDR2" sequence={result.regions.CDR2} color="red" />
                                    <RegionChunk label="FR3" sequence={result.regions.FR3} color="gray" />
                                    <RegionChunk label="CDR3" sequence={result.regions.CDR3} color="red" />
                                    <RegionChunk label="FR4" sequence={result.regions.FR4} color="gray" />
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-t border-slate-200 dark:border-slate-700">
                                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Info className="w-4 h-4" /> Region Details
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                    {Object.entries(result.regions).map(([key, seq]) => seq && (
                                        <div key={key} className="flex gap-2">
                                            <span className={clsx(
                                                "w-12 font-bold shrink-0",
                                                key.startsWith('CDR') ? "text-red-600 dark:text-red-400" : "text-slate-500"
                                            )}>{key}</span>
                                            <span className="font-mono break-all text-slate-700 dark:text-slate-300">{seq}</span>
                                            <span className="text-slate-400 shrink-0">({seq.length} aa)</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {!result && !loading && !error && (
                        <div className="h-full flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-12">
                            Enter antibody sequence to identify CDRs
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const RegionChunk = ({ label, sequence, color }: { label: string, sequence: string, color: 'gray' | 'red' }) => {
    if (!sequence) return null;
    
    const bgClass = color === 'red' 
        ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
        : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600";

    return (
        <div className="group relative inline-block">
            <span className={clsx("px-1 py-0.5 rounded border mx-0.5 inline-block", bgClass)}>
                {sequence}
            </span>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                {label} ({sequence.length})
            </span>
        </div>
    );
};
