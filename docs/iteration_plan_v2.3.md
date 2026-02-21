# Iteration Plan: BioDjango v2.3.0

## Overview
This iteration focuses on **Advanced Bioinformatics Tools**, specifically targeting synthetic biology and immunology workflows.
The primary goals are to introduce **Primer Design** capabilities and **Antibody CDR Annotation**.

## 1. Feature Specifications

### 1.1. Primer Design
*   **Goal**: Automated generation of PCR primers for a given template sequence.
*   **Backend Implementation**:
    *   **Library**: `primer3-py` (Python binding for Primer3).
    *   **Input**: 
        *   Template Sequence (DNA).
        *   Parameters: Product Size Range, Tm (Min/Opt/Max), GC% (Min/Max).
    *   **Output**: 
        *   List of top 5 primer pairs.
        *   Details per primer: Sequence, Tm, GC%, Self-Complementarity, Hairpin.
*   **Frontend**:
    *   Form to input sequence and adjust basic parameters.
    *   Interactive results table.
    *   Visual representation of primer binding sites on the template (optional).

### 1.2. Antibody CDR Annotation
*   **Goal**: Identification and visualization of Complementarity Determining Regions (CDRs) in antibody sequences.
*   **Backend Implementation**:
    *   **Library**: `abnumber` (Python library for antibody numbering).
    *   **Input**: 
        *   Protein Sequence (Heavy/Light chain).
        *   Numbering Scheme: `IMGT` (default), `KABAT`, `CHOTHIA`.
    *   **Output**: 
        *   Annotated regions: FR1, CDR1, FR2, CDR2, FR3, CDR3, FR4.
        *   Standardized numbering map.
*   **Frontend**:
    *   Sequence input area.
    *   **Highlighter Component**: Renders the sequence with color-coded backgrounds for CDRs vs Framework regions.
    *   Tooltip showing the numbering position for each residue.

## 2. Implementation Roadmap

### Phase 1: Backend Dependencies & Core Logic
1.  Add `primer3-py` and `abnumber` to `backend/requirements.txt`.
2.  Create utility module `analysis/utils/primer_design.py`.
3.  Create utility module `analysis/utils/antibody_annotation.py`.
4.  Write unit tests for these utilities using sample data.

### Phase 2: API Development
1.  Create `PrimerDesignView` in `analysis/views.py`.
2.  Create `AntibodyAnnotationView` in `analysis/views.py`.
3.  Define serializers for input validation.
4.  Register URLs in `analysis/urls.py`.

### Phase 3: Frontend Components
1.  Create `PrimerDesignForm` and `PrimerResultsTable`.
2.  Create `AntibodyHighlighter` component (visualizes sequence chunks).
3.  Create new pages:
    *   `/tools/primer-design`
    *   `/tools/antibody-annotation`
4.  Add navigation links to Sidebar and Dashboard.

### Phase 4: Integration & Validation
1.  E2E testing of the full workflow.
2.  Validate Primer3 outputs against web-based Primer3Web.
3.  Validate Antibody annotations against ANARCI/IMGT web tools.

## 3. Future Outlook (v2.4+)
*   **Batch Processing**: Allow bulk upload for primer design.
*   **Antibody Humanization**: Automated suggestions for framework mutations.
*   **CRISPR gRNA Design**: Off-target analysis.
