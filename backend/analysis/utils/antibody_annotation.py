import abnumber

def annotate_antibody(sequence, scheme='imgt'):
    """
    Annotate antibody sequence with CDRs and Framework regions using abnumber.
    
    Args:
        sequence (str): The antibody amino acid sequence.
        scheme (str): Numbering scheme ('imgt', 'kabat', 'chothia').
        
    Returns:
        dict: Annotated regions and numbering map.
    """
    try:
        chain = abnumber.Chain(sequence, scheme=scheme)
        
        # Extract regions
        regions = {
            "FR1": chain.fr1_seq,
            "CDR1": chain.cdr1_seq,
            "FR2": chain.fr2_seq,
            "CDR2": chain.cdr2_seq,
            "FR3": chain.fr3_seq,
            "CDR3": chain.cdr3_seq,
            "FR4": chain.fr4_seq
        }
        
        # Numbering map: position -> residue
        # abnumber positions are objects, we convert to string representation
        numbering = {str(pos): res for pos, res in chain.positions.items()}
        
        return {
            "status": "success",
            "chain_type": chain.chain_type, # 'H' or 'L' or 'K'/'L'
            "regions": regions,
            "numbering": numbering,
            "scheme": scheme
        }
    except Exception as e:
        # Fallback if ANARCI fails or is not installed properly
        if "anarci" in str(e).lower() or "module" in str(e).lower():
             return {
                "status": "error",
                "message": "ANARCI module missing or failed. Please ensure 'anarci' is installed in the backend environment."
            }
        return {
            "status": "error",
            "message": str(e)
        }
