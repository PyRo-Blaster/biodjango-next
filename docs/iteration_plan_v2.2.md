# Iteration Plan: BioDjango v2.2.0

## Overview
This iteration focuses on **Robustness, User Experience, and Security**.
The primary goals are to ensure data integrity (FASTA validation), improve result portability (PDF export), and enhance system monitoring (Audit Logs).

## 1. Feature Specifications

### 1.1. FASTA Validation & Sanitization
*   **Goal**: Prevent garbage data from entering the system.
*   **Backend Implementation**:
    *   Enhance `upload_fasta` in `ProjectViewSet`.
    *   Use `Biopython` to strictly validate sequences.
    *   Check for:
        *   Valid IUPAC amino acid characters (allow `*` for stop, but warn).
        *   Empty sequences or headers.
        *   Duplicate sequence names within the same project.
    *   Return detailed error messages (e.g., "Invalid character 'X' at line 5").
*   **Frontend**:
    *   File size limit check (e.g., max 10MB).
    *   Display validation errors in a toast or modal.

### 1.2. PDF Result Export
*   **Goal**: Allow users to save analysis results locally without relying on database persistence for everything.
*   **Scope**:
    *   **BLAST Results**: Export Query info, Hit table, and Alignments.
    *   **Sequence Analysis**: Export physicochemical properties table.
*   **Technical Approach**:
    *   **Client-side generation** using `react-pdf` or `jspdf`.
    *   Pros: Zero server load, instant generation, respects privacy.

### 1.3. Enhanced Dashboard & UI/UX
*   **Dark Mode**:
    *   Implement a global `ThemeContext`.
    *   Toggle class `dark` on `<html>` tag.
    *   Update Tailwind classes with `dark:` prefix (e.g., `bg-white dark:bg-slate-800`).
*   **Dashboard Widgets**:
    *   **Statistics**: Total Projects, Total Sequences.
    *   **Recent Activity**: List of 5 most recent sequences added/modified.

### 1.4. Audit Logging (Security)
*   **Goal**: Track who did what.
*   **Data Model (`AuditLog`)**:
    *   `actor` (User)
    *   `action` (CREATE, VIEW, DELETE, EXPORT)
    *   `target` (Project/Sequence ID)
    *   `timestamp`
    *   `ip_address`
*   **Implementation**:
    *   Middleware or Signals to capture actions.
    *   Admin-only view to inspect logs.

## 2. Implementation Roadmap

### Phase 1: Robustness (Backend)
1.  Implement `validate_fasta` utility function.
2.  Integrate validation into `upload_fasta` API.
3.  Add unit tests for validation logic.

### Phase 2: Export & Visualization (Frontend)
1.  Install `jspdf` / `html2canvas`.
2.  Create `ExportPDFButton` component.
3.  Integrate into BLAST and Sequence Analysis pages.

### Phase 3: Audit System (Backend + Frontend)
1.  Create `AuditLog` model.
2.  Implement Signals for `post_save` / `post_delete` on `ProteinSequence` and `Project`.
3.  Create `AuditLogViewSet` (ReadOnly, Admin-only).
4.  Add "Audit Logs" tab to Admin Dashboard.

### Phase 4: UI Polish
1.  Implement Dark Mode toggle.
2.  Refactor Dashboard to show statistics.

## 3. Future Outlook (v2.3+)
*   **Task Management**: "My Jobs" history for BLAST/MSA.
*   **Primer Design**: Integration with `primer3-py`.
*   **Antibody Annotation**: CDR labeling using `AbNumber`.
