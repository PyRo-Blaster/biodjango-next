from Bio import SeqIO
import io
from .models import ProteinSequence

def validate_fasta(file_content, project):
    """
    Validates FASTA content.
    
    Args:
        file_content (str): The content of the FASTA file.
        project (Project): The project instance to check for duplicates.
        
    Returns:
        tuple: (valid_sequences_data, errors)
            valid_sequences_data: List of dicts {'name': str, 'sequence': str, 'metadata': dict}
            errors: List of error strings
    """
    valid_sequences_data = []
    errors = []
    
    # 1. Parse content
    try:
        fasta_io = io.StringIO(file_content)
        # Convert generator to list to check if empty and iterate multiple times if needed
        records = list(SeqIO.parse(fasta_io, "fasta"))
    except Exception as e:
        return [], [f"Failed to parse FASTA file: {str(e)}"]

    if not records:
        return [], ["File contains no valid FASTA sequences or is empty"]

    # 2. Prepare sets for duplicate checking
    seen_ids_in_file = set()
    
    # Check for duplicates in the DB for this project
    # We query all names once to avoid N queries
    existing_names = set(
        ProteinSequence.objects.filter(project=project).values_list('name', flat=True)
    )

    # Standard IUPAC amino acids + Stop codon (*) + Gap (-)
    # We can be strict or loose. Let's be standard + *
    # Gaps are usually for alignments, but input sequences might have them? 
    # Usually raw sequences shouldn't have gaps. Let's disallow gaps for storage.
    valid_amino_acids = set("ACDEFGHIKLMNPQRSTVWY*")

    for i, record in enumerate(records):
        # record.id is usually the first word before space
        rec_id = record.id.strip()
        rec_seq = str(record.seq).upper()
        
        # Check empty ID
        if not rec_id:
            errors.append(f"Record #{i+1}: Missing sequence ID")
            continue
            
        # Check empty sequence
        if not rec_seq:
            errors.append(f"Record '{rec_id}': Empty sequence")
            continue

        # Check duplicates in file
        if rec_id in seen_ids_in_file:
            errors.append(f"Record '{rec_id}': Duplicate ID in uploaded file")
            continue
        seen_ids_in_file.add(rec_id)

        # Check duplicates in DB
        if rec_id in existing_names:
            errors.append(f"Record '{rec_id}': Sequence ID already exists in this project")
            continue

        # Check invalid characters
        # Find all unique invalid chars
        invalid_chars = set(rec_seq) - valid_amino_acids
        if invalid_chars:
            # Sort for deterministic error message
            sorted_invalid = sorted(list(invalid_chars))
            errors.append(f"Record '{rec_id}': Contains invalid characters: {', '.join(sorted_invalid)}")
            continue

        valid_sequences_data.append({
            "name": rec_id,
            "sequence": rec_seq,
            "metadata": {"description": record.description}
        })

    return valid_sequences_data, errors
