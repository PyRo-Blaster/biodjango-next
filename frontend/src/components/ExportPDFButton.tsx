import React from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download } from 'lucide-react';
import { parseBlastOutput, type Hit } from '../utils/blastParser';

interface ExportPDFButtonProps {
    type: 'BLAST' | 'MSA' | 'PEPTIDE';
    data: any; // Raw output string for BLAST, object for others
    filename?: string;
}

export const ExportPDFButton: React.FC<ExportPDFButtonProps> = ({ type, data, filename = 'report.pdf' }) => {

    const handleExport = () => {
        const doc = new jsPDF();

        if (type === 'BLAST') {
            generateBlastReport(doc, data);
        } else if (type === 'PEPTIDE') {
            generatePeptideReport(doc, data);
        }

        doc.save(filename);
    };

    const generatePeptideReport = (doc: jsPDF, data: any) => {
        doc.setFontSize(18);
        doc.text("Sequence Analysis Report", 14, 20);
        
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

        // Summary
        doc.setFontSize(14);
        doc.text("Cumulative Summary", 14, 40);
        
        const summaryData = [
            ['Total Sequences', data.total_summary.total_sequences_count],
            ['Total Molecular Weight', `${data.total_summary.total_molecular_weight.toLocaleString()} Da`],
            ['Isoelectric Point (pI)', data.total_summary.total_isoelectric_point],
            ['Extinction Coeff.', data.total_summary.extinction_coefficient]
        ];

        autoTable(doc, {
            startY: 45,
            head: [['Metric', 'Value']],
            body: summaryData,
            theme: 'grid',
            headStyles: { fillColor: [66, 133, 244] },
            columnStyles: { 0: { fontStyle: 'bold', width: 80 } }
        });

        // Detailed Table
        doc.text("Detailed Analysis", 14, (doc as any).lastAutoTable.finalY + 15);
        
        const detailsData = data.sequences.map((seq: any) => [
            seq.id,
            seq.num_cysteines,
            seq.molecular_weight.toFixed(2)
        ]);

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 20,
            head: [['Sequence ID', 'Cysteines', 'Molecular Weight (Da)']],
            body: detailsData,
            theme: 'striped',
            headStyles: { fillColor: [66, 133, 244] }
        });
    };

    const generateBlastReport = (doc: jsPDF, output: string) => {
        doc.setFontSize(18);
        doc.text("BLAST Analysis Report", 14, 20);
        
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

        const hits = parseBlastOutput(output);

        if (hits.length === 0) {
            doc.text("No significant hits found or parsing failed.", 14, 40);
            // Print raw output if parsing fails, but limit it
            const splitOutput = output.split('\n').slice(0, 50);
            doc.setFont("courier", "normal");
            doc.setFontSize(8);
            let y = 50;
            splitOutput.forEach(line => {
                if (y > 280) {
                    doc.addPage();
                    y = 20;
                }
                doc.text(line, 14, y);
                y += 4;
            });
            return;
        }

        // Summary Table
        const tableData = hits.map(hit => [
            hit.id,
            hit.description.substring(0, 50) + (hit.description.length > 50 ? '...' : ''),
            hit.score,
            hit.evalue
        ]);

        autoTable(doc, {
            startY: 35,
            head: [['ID', 'Description', 'Score', 'E-value']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [66, 133, 244] }
        });

        // Alignments
        let yPos = (doc as any).lastAutoTable.finalY + 10;

        hits.forEach((hit, index) => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text(`Hit #${index + 1}: ${hit.id}`, 14, yPos);
            yPos += 7;
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            // Wrap description text
            const descLines = doc.splitTextToSize(hit.description, 180);
            doc.text(descLines, 14, yPos);
            yPos += (descLines.length * 5) + 2;

            hit.alignments.forEach(align => {
                if (yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                }
                
                doc.setFont("courier", "normal");
                doc.setFontSize(8);
                
                const lines = [
                    `Query  ${align.queryStart.toString().padEnd(4)}  ${align.querySeq}  ${align.queryEnd}`,
                    `              ${align.matchSeq}`,
                    `Sbjct  ${align.sbjctStart.toString().padEnd(4)}  ${align.sbjctSeq}  ${align.sbjctEnd}`
                ];

                lines.forEach(line => {
                    doc.text(line, 14, yPos);
                    yPos += 4;
                });
                yPos += 5;
            });
            yPos += 5;
        });
    };

    return (
        <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-md transition-colors"
        >
            <Download className="w-4 h-4" />
            Export PDF
        </button>
    );
};
