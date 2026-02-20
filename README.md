# BioDjango Next

Refactored version of the BioDjango application with a modern architecture.

## Documentation
- [Roadmap](docs/roadmap.md)
- [System Architecture](docs/architecture.md)
- [API Specification](docs/api_spec.md)

## Project Structure
- `backend/`: Django + DRF project.
- `frontend/`: React + TypeScript + Vite project.
- `docker-compose.yml`: Orchestration for Dev environment.

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js (for local frontend dev)
- Python 3.11+ (for local backend dev)

### Running with Docker (Recommended)

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs (Swagger): http://localhost:8000/api/schema/swagger-ui/ (To be configured)

### Local Development

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
