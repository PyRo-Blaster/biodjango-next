import React from 'react';
import clsx from 'clsx';
import { parseBlastOutput, type Hit } from '../utils/blastParser';

interface BlastViewerProps {
    output: string;
}

export const BlastViewer: React.FC<BlastViewerProps> = ({ output }) => {
    // 1. Basic Parsing Logic
    // This is a simplified parser for standard BLASTP text output.
    // Real-world BLAST parsing is complex; this handles the structure we saw in logs.
    
    const hits: Hit[] = parseBlastOutput(output);

    // If no structured hits found, fallback to raw text
    if (hits.length === 0) {
        return (
            <pre className="text-xs font-mono bg-slate-50 p-4 rounded-lg overflow-x-auto whitespace-pre leading-relaxed">
                {output}
            </pre>
        );
    }

    return (
        <div className="space-y-8">
            {hits.map((hit, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
                    {/* Hit Header */}
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                        <div className="flex justify-between items-start gap-4">
                            <div>
                                <h4 className="font-bold text-sm text-primary-700 break-all">{hit.description}</h4>
                                <div className="mt-1 flex gap-4 text-xs text-slate-500 font-mono">
                                    <span>Score: <span className="text-slate-700 font-bold">{hit.score}</span></span>
                                    <span>E-value: <span className="text-slate-700 font-bold">{hit.evalue}</span></span>
                                </div>
                            </div>
                            <span className="text-xs font-mono bg-slate-200 px-2 py-1 rounded text-slate-600">
                                Hit #{idx + 1}
                            </span>
                        </div>
                    </div>

                    {/* Alignment View */}
                    <div className="p-4 overflow-x-auto">
                        <div className="font-mono text-xs leading-none inline-block min-w-full">
                            {hit.alignments.map((align, aIdx) => (
                                <div key={aIdx} className="mb-6 last:mb-0">
                                    {/* Query */}
                                    <div className="flex items-center text-slate-600 mb-1">
                                        <span className="w-16 text-right mr-4 text-slate-400 select-none">Query</span>
                                        <span className="w-12 text-right mr-2 text-slate-400">{align.queryStart}</span>
                                        <div className="flex">
                                            {align.querySeq.split('').map((char, cIdx) => (
                                                <span key={cIdx} className="w-[9px] text-center inline-block">{char}</span>
                                            ))}
                                        </div>
                                        <span className="ml-2 text-slate-400">{align.queryEnd}</span>
                                    </div>

                                    {/* Match Line (Visual) */}
                                    <div className="flex items-center text-slate-400 mb-1 font-bold">
                                        <span className="w-16 mr-4"></span>
                                        <span className="w-12 mr-2"></span>
                                        <div className="flex">
                                            {align.matchSeq.split('').map((char, cIdx) => {
                                                const isMatch = char.trim().length > 0 && char !== '+';
                                                const isPositive = char === '+';
                                                return (
                                                    <span key={cIdx} className={clsx(
                                                        "w-[9px] text-center inline-block",
                                                        isMatch ? "text-primary-600" : (isPositive ? "text-green-500" : "opacity-20")
                                                    )}>
                                                        {char}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Subject */}
                                    <div className="flex items-center text-slate-800">
                                        <span className="w-16 text-right mr-4 text-slate-400 select-none">Sbjct</span>
                                        <span className="w-12 text-right mr-2 text-slate-400">{align.sbjctStart}</span>
                                        <div className="flex">
                                            {align.sbjctSeq.split('').map((char, cIdx) => {
                                                const matchChar = align.matchSeq[cIdx];
                                                const isIdentity = matchChar && matchChar.trim().length > 0 && matchChar !== '+';
                                                
                                                return (
                                                    <span key={cIdx} className={clsx(
                                                        "w-[9px] text-center inline-block",
                                                        isIdentity ? "bg-primary-100 text-primary-700 font-bold rounded-sm" : ""
                                                    )}>
                                                        {char}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                        <span className="ml-2 text-slate-400">{align.sbjctEnd}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
