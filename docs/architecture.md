# System Architecture

## Overview
The BioDjango 2.0 system follows a microservices-inspired, decoupled architecture. It separates the user interface (Frontend) from the business logic and data processing (Backend), connected via a RESTful API. Heavy computational tasks are offloaded to an asynchronous worker queue.

## Components

### 1. Frontend (Client)
- **Technology**: React (TypeScript), Vite, Tailwind CSS.
- **Responsibility**: 
  - User interaction.
  - Data visualization (Sequence alignment, charts).
  - State management (TanStack Query/Redux).
  - Communicates with Backend via HTTP/REST.

### 2. API Gateway / Reverse Proxy
- **Technology**: Nginx.
- **Responsibility**:
  - Routes requests to Backend or Frontend (in production).
  - Handles SSL termination.
  - Serves static files.

### 3. Backend (API Server)
- **Technology**: Python, Django, Django REST Framework (DRF).
- **Responsibility**:
  - **Auth**: Project/User authentication.
  - **API**: Exposes endpoints for data retrieval and task submission.
  - **Models**: ORM for Database interaction.
  - **Orchestration**: Dispatches tasks to the Queue.

### 4. Asynchronous Task Queue
- **Technology**: Celery (Worker), Redis (Broker).
- **Responsibility**:
  - Executes long-running bio-informatics tasks (BLAST, MSA).
  - Handles file I/O for external tools.
  - Updates Task status in Database.

### 5. Database
- **Technology**: PostgreSQL.
- **Responsibility**:
  - Stores relational data: Projects, Sequences, Task metadata, User info.
  - JSONB support for storing flexible analysis results.

### 6. Object Storage
- **Technology**: MinIO (Local/Dev) or AWS S3 (Prod).
- **Responsibility**:
  - Stores uploaded FASTA files.
  - Stores large result files (BLAST output, MSA HTML/Alignment files).

## Data Flow (Example: BLAST Search)

1.  **Upload**: User uploads FASTA file via Frontend -> Backend API.
2.  **Storage**: Backend saves file to Object Storage, records metadata in DB.
3.  **Submission**: User requests BLAST analysis -> Backend creates `Task` record (PENDING), pushes job to Redis.
4.  **Processing**: Celery Worker pops job, retrieves file from Storage, executes `blastp` subprocess locally.
5.  **Completion**: Worker parses output, saves result to Storage/DB, updates `Task` record (SUCCESS).
6.  **Polling/Notification**: Frontend polls Task API -> Backend returns "SUCCESS" -> Frontend fetches Result.

## Infrastructure Diagram (Docker Compose)

```yaml
services:
  frontend:
    build: ./frontend
    ports: ["3000:80"]
  
  backend:
    build: ./backend
    ports: ["8000:8000"]
    depends_on: [db, redis]
    
  worker:
    build: ./backend
    command: celery -A config worker -l info
    depends_on: [db, redis]

  db:
    image: postgres:15
    volumes: [pg_data:/var/lib/postgresql/data]

  redis:
    image: redis:7

  minio:
    image: minio/minio
```
