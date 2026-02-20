# API Specification (Draft)

## Authentication
*(Assuming simple Project-based auth for now, can be extended to JWT User auth)*

- `POST /api/projects/` - Create a new project.
    - Response: `{ "project_id": "...", "security_key": "..." }`
- `POST /api/auth/verify/` - Verify Project credentials.

## Sequences
- `GET /api/projects/{project_id}/sequences/` - List all sequences.
- `POST /api/projects/{project_id}/sequences/upload/` - Upload FASTA.
- `GET /api/sequences/{id}/` - Retrieve details of a specific sequence.

## Analysis & Tools

### Peptide Calculator
- `POST /api/tools/peptide-calc/`
    - Body: `{ "target_mass": 500.0, "error_range": 1.0, "num_aa": 4 }`
    - Response: List of peptides or CSV download link.

### Asynchronous Tasks (BLAST, IgBLAST, MSA)
- `POST /api/tasks/blast/`
    - Body: `{ "sequence": "...", "evalue": 1e-6, "db": "swissprot" }`
    - Response: `{ "task_id": "uuid" }`
- `POST /api/tasks/msa/`
    - Body: `{ "sequences": "..." }`
    - Response: `{ "task_id": "uuid" }`

### Task Status & Results
- `GET /api/tasks/{task_id}/`
    - Response: `{ "status": "PENDING|STARTED|SUCCESS|FAILURE", "progress": ... }`
- `GET /api/tasks/{task_id}/result/`
    - Response: JSON result or File download URL.
