import csv
from itertools import product
from Bio.SeqUtils.ProtParam import ProteinAnalysis
from Bio import SeqIO
import io

def generate_peptides(target_mass, error_range, num_amino_acids):
    """
    Generates peptide combinations matching a target mass within an error range.
    """
    output = io.StringIO()
    fieldnames = ['Peptide', 'Molecular Weight']
    csv_writer = csv.DictWriter(output, fieldnames=fieldnames)
    csv_writer.writeheader()

    amino_acids = list("ACDEFGHIKLMNPQRSTVWY")
    peptides = product(amino_acids, repeat=num_amino_acids)

    count = 0
    results = []

    for peptide_tuple in peptides:
        peptide = ''.join(peptide_tuple)
        analysis = ProteinAnalysis(peptide)
        peptide_mass = analysis.molecular_weight()

        if abs(peptide_mass - target_mass) <= error_range:
            results.append({'Peptide': peptide, 'Molecular Weight': peptide_mass})
            csv_writer.writerow({'Peptide': peptide, 'Molecular Weight': peptide_mass})
            count += 1
            
    return output.getvalue()


# Define amino acid properties
AA_extinction_coeff = {'W': 5500, 'Y': 1490, 'C': 125}

def cumulative_calculator(fasta_file):
    """
    Calculates cumulative properties for sequences in a FASTA file.
    """
    total_sequence = ""
    seq_number = 0
    total_extinction_coeff = 0
    total_molecular_weight = 0
    total_num_C = 0

    # Initialize summary structure
    summary_data = {
        "sequences": [],
        "total_summary": {}
    }

    # Handle both file-like objects and string content
    if isinstance(fasta_file, str):
        fasta_handle = io.StringIO(fasta_file)
    else:
        fasta_handle = fasta_file

    for seq_record in SeqIO.parse(fasta_handle, "fasta"):
        sequence = str(seq_record.seq)
        total_sequence += sequence
        seq_number += 1
        
        # Temporary calculations for each sequence to aggregate
        num_W = sequence.count('W')
        num_Y = sequence.count('Y')
        num_C = sequence.count('C')
        total_extinction_coeff += num_W * AA_extinction_coeff.get('W', 0) + num_Y * AA_extinction_coeff.get('Y', 0)
        total_num_C += num_C

        analysis = ProteinAnalysis(sequence)
        mw = analysis.molecular_weight()
        total_molecular_weight += mw
        
        summary_data["sequences"].append({
            "id": seq_record.id,
            "num_cysteines": num_C,
            "molecular_weight": round(mw, 4)
        })

    if seq_number > 0:
        # Isoelectric point for the total sequence
        try:
            cumulative_analysis = ProteinAnalysis(total_sequence)
            isoelectric_point = cumulative_analysis.isoelectric_point()
        except Exception:
            isoelectric_point = 0.0
    
        # Abs 0.1% (=1 g/l)
        if total_molecular_weight > 0:
            abs_0_1_percent = total_extinction_coeff / total_molecular_weight
        else:
            abs_0_1_percent = 0.0

        # Adjust total molecular weight for disulfide bonds (approximation)
        final_mw = total_molecular_weight - (total_num_C * 1.0078)

        summary_data["total_summary"] = {
            "total_isoelectric_point": round(isoelectric_point, 2),
            "total_molecular_weight": round(final_mw, 4),
            "extinction_coefficient": round(abs_0_1_percent, 2),
            "total_sequences_count": seq_number
        }
    
    return summary_data
