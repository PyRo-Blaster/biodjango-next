# BioDjango 2.0 (Refactoring Project) Roadmap

## Project Goal
To transform the existing Django-based bioinformatics application into a modern, scalable, and secure web application with a decoupled frontend and backend architecture, utilizing asynchronous task processing for computational workloads.

## Phase 1: Foundation & Architecture Setup (Weeks 1-2)
- [ ] **Infrastructure Setup**:
    - [ ] Initialize Git repository.
    - [ ] Set up Docker & Docker Compose environment (Django, PostgreSQL, Redis, React, Nginx).
    - [ ] Configure environment variables management (.env).
- **Backend Initialization**:
    - [ ] Initialize Django project with `cookiecutter-django` or manual structure.
    - [ ] Install DRF (Django REST Framework).
    - [ ] Configure PostgreSQL database connection.
    - [ ] Set up Celery with Redis for asynchronous tasks.
- **Frontend Initialization**:
    - [ ] Initialize React project (Vite + TypeScript).
    - [ ] Set up UI component library (e.g., Shadcn UI or Material UI).
    - [ ] Configure Axios/TanStack Query for API communication.

## Phase 2: Core Logic Migration & API Development (Weeks 3-4)
- **Data Models**:
    - [ ] Migrate `Project`, `AA_Sequence`, `DNA_Sequence` models to the new backend.
    - [ ] Implement secure file storage (MinIO/S3) for FASTA files.
- **Authentication & Project Management**:
    - [ ] Implement Project creation/retrieval APIs.
    - [ ] Secure API endpoints (JWT or Session auth if needed, though project-based access seems current).
- **Sequence Analysis Logic**:
    - [ ] Port `cumulative_calculator` logic to a utility module.
    - [ ] Port `peptide_calculator` logic.
    - [ ] Create API endpoints for upload and analysis.

## Phase 3: Asynchronous Task Implementation (Weeks 5-6)
- **External Tools Integration**:
    - [ ] Dockerize BLAST+ and MUSCLE tools or install in backend container.
    - [ ] Configure paths in Django settings.
- **Celery Tasks**:
    - [ ] Implement `run_blast_task`.
    - [ ] Implement `run_igblast_task`.
    - [ ] Implement `run_msa_task`.
- **Task Management API**:
    - [ ] Create endpoints to submit tasks.
    - [ ] Create endpoints to check task status and retrieve results.

## Phase 4: Frontend Development & Visualization (Weeks 7-8)
- **Sequence Dashboard**:
    - [ ] Build Project/Sequence list view.
    - [ ] Implement file upload component with progress bar.
- **Analysis Results**:
    - [ ] Create views for Protein Properties (Charts/Tables).
    - [ ] Implement Peptide Calculator UI.
- **Advanced Visualization**:
    - [ ] Integrate MSA viewer (e.g., `react-msa-viewer` or similar).
    - [ ] specialized BLAST result visualization.

## Phase 5: Testing, Security & Deployment (Week 9)
- **Testing**:
    - [ ] Unit tests for backend logic (Pytest).
    - [ ] Integration tests for APIs.
    - [ ] E2E tests for critical flows (Cypress/Playwright).
- **Security Audit**:
    - [ ] Review dependencies.
    - [ ] Ensure secrets management.
    - [ ] Input validation (prevent command injection).
- **Deployment**:
    - [ ] CI/CD Pipeline (GitHub Actions).
    - [ ] Deploy to Staging/Production environment.

## Phase 6: Advanced Bioinformatics Tools (v2.3)
- **Primer Design**:
    - [x] Backend: Integrate `primer3-py`.
    - [x] Frontend: Create Primer Design form and results view.
- **Antibody Annotation**:
    - [x] Backend: Integrate `abnumber`.
    - [x] Frontend: Implement CDR Highlighting component (IMGT/KABAT).
