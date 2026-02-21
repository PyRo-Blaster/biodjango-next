export interface Hit {
    id: string;
    description: string;
    score: string;
    evalue: string;
    alignments: Alignment[];
}

export interface Alignment {
    header: string;
    queryStart: number;
    querySeq: string;
    queryEnd: number;
    matchSeq: string; // The middle line (identities, positives, gaps)
    sbjctStart: number;
    sbjctSeq: string;
    sbjctEnd: number;
}

export const parseBlastOutput = (output: string): Hit[] => {
    const hits: Hit[] = [];
    const lines = output.split('\n');
    
    let currentHit: Hit | null = null;
    let isProcessingAlignments = false;
    
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
    
    return hits;
};
