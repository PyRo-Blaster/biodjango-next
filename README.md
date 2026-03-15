# BioDjango Next Generation

BioDjango is a modern bioinformatics web platform built with Django REST Framework and React. It provides tools for sequence analysis, peptide calculations, BLAST searches, and multiple sequence alignment (MSA).

## Features

### 🔐 Project Management (New in v2.1)
- **Role-Based Access Control (RBAC)**: Secure project access.
- **Visitor Access**: Users can request access to private projects.
- **Admin Workflow**: Administrators can approve or reject access requests.
- **Bulk Upload**: Support for uploading FASTA files containing multiple sequences.

### 🛡️ Robustness & Audit (New in v2.2)
- **FASTA Validation**: Strict checks for invalid characters and duplicates.
- **Audit Logs**: Track user actions (Create/Update/Delete) for security compliance.
- **PDF Export**: Save analysis reports (BLAST, Sequence Analysis) as PDF.
- **UI Enhancements**: Dark Mode support and new Dashboard statistics.

### 🧪 Advanced Bioinformatics (New in v2.3)
- **Primer Design**: Design primers for PCR using Primer3 (with 5 pairs generated).
- **Antibody Annotation**: Annotate and highlight CDRs in antibody sequences (IMGT/KABAT schemes).

### 🧬 Bioinformatics Tools
- **Peptide Calculator**: Calculate molecular weight, pI, and net charge of peptide sequences.
- **Sequence Analysis**: Analyze DNA/Protein sequences (GC content, melting temp, etc.).
- **BLAST Search**: Run local BLASTP searches against custom databases (e.g., SwissProt, PDB).
- **MSA Viewer**: Visualize ClustalW/MAFFT alignment results with conservation highlighting.

## Tech Stack
- **Backend**: Django, Django REST Framework, Celery, Redis, PostgreSQL.
- **Frontend**: React, TypeScript, Tailwind CSS, Vite.
- **Infrastructure**: Docker Compose, Nginx.

## Quick Start

### Development
```bash
docker-compose up -d --build
```
Access frontend at http://localhost:5173

### Production
See `DEPLOY.md` for detailed deployment instructions.

## Documentation
- `docs/iteration_plan_projects.md`: Technical specs for the Project Management module.
- `docs/iteration_plan_v2.2.md`: Technical specs for Robustness & Audit features.
- `docs/iteration_plan_v2.3.md`: Technical specs for Advanced Bioinformatics tools.
- `DEPLOY.md`: Production deployment guide.
- `docs/beta_test_guide_v2.7.md`: Beta deployment runbook, tester instructions, and feedback template.
