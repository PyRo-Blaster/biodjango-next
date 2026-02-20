import React from 'react';
import clsx from 'clsx';

interface BlastViewerProps {
    output: string;
}

interface Hit {
    id: string;
    description: string;
    score: string;
    evalue: string;
    alignments: Alignment[];
}

interface Alignment {
    header: string;
    queryStart: number;
    querySeq: string;
    queryEnd: number;
    matchSeq: string; // The middle line (identities, positives, gaps)
    sbjctStart: number;
    sbjctSeq: string;
    sbjctEnd: number;
}

export const BlastViewer: React.FC<BlastViewerProps> = ({ output }) => {
    // 1. Basic Parsing Logic
    // This is a simplified parser for standard BLASTP text output.
    // Real-world BLAST parsing is complex; this handles the structure we saw in logs.
    
    const hits: Hit[] = [];
    const lines = output.split('\n');
    
    let currentHit: Hit | null = null;
    let currentAlign: Alignment | null = null;
    let isProcessingAlignments = false;

    // Helper to extract hit info
    // Format: >ID Description...
    //         Length=...
    //         Score = ... Expect = ...
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.startsWith('>')) {
            // New Hit
            if (currentHit) hits.push(currentHit);
            
            // Extract ID and Description
            // Sometimes description spans multiple lines
            let desc = line.substring(1);
            let j = i + 1;
            while (j < lines.length && !lines[j].startsWith('Length=') && !lines[j].includes('Score =')) {
                 if (lines[j].trim()) desc += " " + lines[j].trim();
                 j++;
            }
            
            currentHit = {
                id: desc.split(' ')[0],
                description: desc,
                score: '',
                evalue: '',
                alignments: []
            };
            continue;
        }

        if (line.includes('Score =') && currentHit) {
            // Score = 74.7 bits (182),  Expect = 6e-17
            const scoreMatch = line.match(/Score =\s+([\d\.]+)\s+bits/);
            const expectMatch = line.match(/Expect =\s+([e\-\d\.]+)/);
            
            if (scoreMatch) currentHit.score = scoreMatch[1];
            if (expectMatch) currentHit.evalue = expectMatch[1];
            
            isProcessingAlignments = true;
            continue;
        }

        if (isProcessingAlignments && line.startsWith('Query') && currentHit) {
            // Query  Start  Sequence  End
            // Query  1      MTEITA... 60
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 4) {
                const queryStart = parseInt(parts[1]);
                const querySeq = parts[2];
                const queryEnd = parseInt(parts[3]);
                
                // Next line is match line (indentation matters!)
                // Next line is Sbjct
                const matchLine = lines[i+1] || "";
                const sbjctLine = lines[i+2] || "";
                
                // Calculate offset for match line
                // "Query  " is 7 chars (usually). The sequence starts at index of querySeq in original line.
                const seqStartIndex = line.indexOf(querySeq);
                const matchSeq = matchLine.substring(seqStartIndex, seqStartIndex + querySeq.length);
                
                // Parse Sbjct line
                const sbjctParts = sbjctLine.trim().split(/\s+/);
                // Sbjct 1      M...      60
                
                if (sbjctParts.length >= 4 && sbjctParts[0] === 'Sbjct') {
                    const sbjctStart = parseInt(sbjctParts[1]);
                    const sbjctSeq = sbjctParts[2];
                    const sbjctEnd = parseInt(sbjctParts[3]);
                    
                    currentHit.alignments.push({
                        header: `Range: ${queryStart}-${queryEnd}`,
                        queryStart, querySeq, queryEnd,
                        matchSeq,
                        sbjctStart, sbjctSeq, sbjctEnd
                    });
                    
                    i += 2; // Skip processed lines
                }
            }
        }
    }
    // Push last hit
    if (currentHit) hits.push(currentHit);

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
