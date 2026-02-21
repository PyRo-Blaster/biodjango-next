import primer3

def design_primers(sequence, product_size_range="100-300", tm_opt=60.0):
    """
    Design primers for a given sequence using primer3-py.
    
    Args:
        sequence (str): The template DNA sequence.
        product_size_range (str): Range of product sizes (e.g., "100-300").
        tm_opt (float): Optimal melting temperature.
        
    Returns:
        dict: A dictionary containing the best primer pairs (up to 5).
    """
    try:
        # Parse product size range
        if '-' not in product_size_range:
             return {"error": "Invalid product size range format. Expected format 'min-max' (e.g., '100-300')."}
        
        try:
            size_parts = product_size_range.split('-')
            if len(size_parts) != 2:
                 return {"error": "Invalid product size range format. Expected format 'min-max' (e.g., '100-300')."}
            size_min, size_max = map(int, size_parts)
        except ValueError:
             return {"error": "Invalid product size range values. Expected integers."}
        
        # Configure Primer3 parameters
        # We ask for 5 pairs explicitly
        seq_args = {
            'SEQUENCE_ID': 'example',
            'SEQUENCE_TEMPLATE': sequence,
            'SEQUENCE_INCLUDED_REGION': [0, len(sequence)]
        }
        
        global_args = {
            'PRIMER_OPT_SIZE': 20,
            'PRIMER_PICK_INTERNAL_OLIGO': 0,
            'PRIMER_INTERNAL_MAX_SELF_END': 8,
            'PRIMER_MIN_SIZE': 18,
            'PRIMER_MAX_SIZE': 25,
            'PRIMER_OPT_TM': float(tm_opt),
            'PRIMER_MIN_TM': float(tm_opt) - 5.0,
            'PRIMER_MAX_TM': float(tm_opt) + 5.0,
            'PRIMER_MIN_GC': 20.0,
            'PRIMER_MAX_GC': 80.0,
            'PRIMER_MAX_POLY_X': 100,
            'PRIMER_INTERNAL_MAX_POLY_X': 100,
            'PRIMER_SALT_MONOVALENT': 50.0,
            'PRIMER_DNA_CONC': 50.0,
            'PRIMER_MAX_NS_ACCEPTED': 0,
            'PRIMER_MAX_SELF_ANY': 12,
            'PRIMER_MAX_SELF_END': 8,
            'PRIMER_PAIR_MAX_COMPL_ANY': 12,
            'PRIMER_PAIR_MAX_COMPL_END': 8,
            'PRIMER_PRODUCT_SIZE_RANGE': [[size_min, size_max]],
            'PRIMER_NUM_RETURN': 5,  # Ask for 5 pairs
        }
        
        # Run Primer3
        results = primer3.bindings.designPrimers(seq_args, global_args)
        
        # Format results for the frontend
        formatted_primers = []
        
        # Check how many pairs were returned
        num_returned = results.get('PRIMER_PAIR_NUM_RETURNED', 0)
        
        for i in range(num_returned):
            # Extract forward primer info
            fwd_seq = results.get(f'PRIMER_LEFT_{i}_SEQUENCE')
            fwd_tm = results.get(f'PRIMER_LEFT_{i}_TM')
            fwd_gc = results.get(f'PRIMER_LEFT_{i}_GC_PERCENT')
            fwd_start = results.get(f'PRIMER_LEFT_{i}')[0] # (start, length)
            fwd_len = results.get(f'PRIMER_LEFT_{i}')[1]
            
            # Extract reverse primer info
            rev_seq = results.get(f'PRIMER_RIGHT_{i}_SEQUENCE')
            rev_tm = results.get(f'PRIMER_RIGHT_{i}_TM')
            rev_gc = results.get(f'PRIMER_RIGHT_{i}_GC_PERCENT')
            rev_start = results.get(f'PRIMER_RIGHT_{i}')[0]
            rev_len = results.get(f'PRIMER_RIGHT_{i}')[1]
            
            product_size = results.get(f'PRIMER_PAIR_{i}_PRODUCT_SIZE')
            
            formatted_primers.append({
                "rank": i + 1,
                "forward": {
                    "sequence": fwd_seq,
                    "tm": fwd_tm,
                    "gc_percent": fwd_gc,
                    "start": fwd_start,
                    "length": fwd_len
                },
                "reverse": {
                    "sequence": rev_seq,
                    "tm": rev_tm,
                    "gc_percent": rev_gc,
                    "start": rev_start,
                    "length": rev_len
                },
                "product_size": product_size
            })
            
        if not formatted_primers:
             return {
                "error": "No suitable primers found. Try adjusting the product size or Tm.",
                "details": results.get('PRIMER_LEFT_EXPLAIN', 'No explanation')
            }
            
        return {"primers": formatted_primers}

    except Exception as e:
        return {"error": str(e)}
