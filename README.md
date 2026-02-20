# BioDjango Next Generation

BioDjango is a modern bioinformatics web platform built with Django REST Framework and React. It provides tools for sequence analysis, peptide calculations, BLAST searches, and multiple sequence alignment (MSA).

## Features

### 🔐 Project Management (New in v2.1)
- **Role-Based Access Control (RBAC)**: Secure project access.
- **Visitor Access**: Users can request access to private projects.
- **Admin Workflow**: Administrators can approve or reject access requests.
- **Bulk Upload**: Support for uploading FASTA files containing multiple sequences.

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
- `DEPLOY.md`: Production deployment guide.
