import React, { useMemo } from 'react';
import clsx from 'clsx';

interface MsaViewerProps {
    clustalContent: string;
    charsPerLine?: number;
}

interface ParsedSequence {
    id: string;
    sequence: string;
}

export const MsaViewer: React.FC<MsaViewerProps> = ({ clustalContent, charsPerLine: initialCharsPerLine = 60 }) => {
    const [charsPerLine, setCharsPerLine] = React.useState(initialCharsPerLine);

    // Parse Clustal format
    const { sequences, alignmentLength } = useMemo(() => {
        const lines = clustalContent.split('\n');
        const seqMap = new Map<string, string>();
        let maxLen = 0;

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('CLUSTAL') || trimmed.startsWith('*') || trimmed.startsWith('.') || trimmed.startsWith(':')) {
                return;
            }

            const parts = trimmed.split(/\s+/);
            if (parts.length < 2) return;

            const id = parts[0];
            const chunk = parts[1];
            
            if (seqMap.has(id)) {
                seqMap.set(id, seqMap.get(id) + chunk);
            } else {
                seqMap.set(id, chunk);
            }
        });

        const parsedSeqs: ParsedSequence[] = [];
        seqMap.forEach((seq, id) => {
            parsedSeqs.push({ id, sequence: seq });
            if (seq.length > maxLen) maxLen = seq.length;
        });

        return { sequences: parsedSeqs, alignmentLength: maxLen };
    }, [clustalContent]);

    // Calculate conservation per column
    const columnConservation = useMemo(() => {
        if (sequences.length === 0) return [];
        
        const conservation = new Array(alignmentLength).fill(true); 
        
        for (let i = 0; i < alignmentLength; i++) {
            const firstChar = sequences[0].sequence[i];
            if (!firstChar) {
                conservation[i] = false;
                continue;
            }
            
            for (let j = 1; j < sequences.length; j++) {
                if (sequences[j].sequence[i] !== firstChar) {
                    conservation[i] = false;
                    break;
                }
            }
        }
        return conservation;
    }, [sequences, alignmentLength]);

    if (sequences.length === 0) return <div className="text-slate-500">No alignment data parsed.</div>;

    // Calculate blocks
    const blocks = Math.ceil(alignmentLength / charsPerLine);

    return (
        <div className="border border-slate-200 rounded-lg bg-white shadow-sm p-6 overflow-x-auto">
            {/* Controls */}
            <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <label className="text-sm font-medium text-slate-700">Characters per line:</label>
                <input 
                    type="range" 
                    min="20" 
                    max="120" 
                    step="10"
                    value={charsPerLine} 
                    onChange={(e) => setCharsPerLine(Number(e.target.value))}
                    className="w-48 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
                <span className="text-sm font-mono text-slate-600 bg-white px-2 py-1 rounded border border-slate-200 min-w-[3rem] text-center">
                    {charsPerLine}
                </span>
            </div>

            <div className="font-mono text-xs leading-relaxed">
                {Array.from({ length: blocks }).map((_, blockIndex) => {
                    const startIdx = blockIndex * charsPerLine;
                    const endIdx = Math.min(startIdx + charsPerLine, alignmentLength);
                    
                    return (
                        <div key={blockIndex} className="mb-8 last:mb-0">
                            {/* Block Header (Position numbers could go here) */}
                            <div className="flex mb-1">
                                <div className="w-32 shrink-0 mr-2"></div>
                                <div className="flex text-slate-400 select-none">
                                    <span className="w-full text-left">{startIdx + 1}</span>
                                    <span className="ml-auto">{endIdx}</span>
                                </div>
                            </div>

                            {/* Sequences in this block */}
                            {sequences.map((seq) => {
                                const chunk = seq.sequence.slice(startIdx, endIdx);
                                
                                return (
                                    <div key={seq.id} className="flex hover:bg-slate-50 transition-colors">
                                        {/* ID Column */}
                                        <div className="w-32 shrink-0 text-slate-500 font-semibold truncate pr-4 text-right select-none border-r border-slate-100 mr-2">
                                            {seq.id}
                                        </div>
                                        
                                        {/* Sequence Data Chunk */}
                                        <div className="flex">
                                            {chunk.split('').map((char, localIdx) => {
                                                const globalIdx = startIdx + localIdx;
                                                const isConserved = columnConservation[globalIdx];
                                                const isGap = char === '-';
                                                
                                                return (
                                                    <span 
                                                        key={globalIdx} 
                                                        className={clsx(
                                                            "w-[9px] text-center inline-block",
                                                            isGap ? "text-slate-300" : (
                                                                isConserved 
                                                                    ? "bg-primary-100 text-primary-700 font-bold" 
                                                                    : "text-slate-800 bg-red-50"
                                                            )
                                                        )}
                                                    >
                                                        {char}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {/* Conservation Row for this block */}
                            <div className="flex mt-1">
                                 <div className="w-32 shrink-0 text-right pr-4 text-slate-400 select-none border-r border-slate-100 mr-2">
                                </div>
                                <div className="flex">
                                    {columnConservation.slice(startIdx, endIdx).map((isConserved, localIdx) => (
                                        <span key={startIdx + localIdx} className="w-[9px] text-center inline-block text-slate-400 font-bold">
                                            {isConserved ? '*' : ' '}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
