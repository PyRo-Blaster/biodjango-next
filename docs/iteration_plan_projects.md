# Technical Specification: Project & Sequence Management Iteration

## 1. Overview
This iteration aims to implement a **Project-based Protein Sequence Management System** with Role-Based Access Control (RBAC).
- **Admins**: Full control (CRUD) over projects and sequences.
- **Visitors**: Can browse project metadata but need approval to view sequences.
- **Access Workflow**: Visitors can request access -> Admins approve/deny.

## 2. Architecture

### 2.1. Data Models (New App: `projects`)

#### A. `Project`
- `name`: CharField (Unique)
- `description`: TextField
- `created_at`: DateTimeField
- `owner`: ForeignKey(User) - *The creator/admin of the project*
- `allowed_users`: ManyToManyField(User) - *Users granted access*
- `is_public`: BooleanField (Default: False) - *Future proofing*

#### B. `ProteinSequence`
- `project`: ForeignKey(Project)
- `name`: CharField
- `sequence`: TextField (FASTA format)
- `metadata`: JSONField (Optional, for properties like MW, pI)
- `created_at`: DateTimeField

#### C. `AccessRequest`
- `user`: ForeignKey(User)
- `project`: ForeignKey(Project)
- `reason`: TextField
- `status`: CharField (PENDING, APPROVED, REJECTED)
- `reviewed_by`: ForeignKey(User, null=True)
- `reviewed_at`: DateTimeField(null=True)

### 2.2. Authentication & Permissions
- **Auth Method**: Upgrade from Basic Auth to **JWT (JSON Web Token)** using `djangorestframework-simplejwt`.
- **Role Management**:
    - **Visitor (Default)**: `user.is_staff = False`. Can register freely.
    - **Admin**: `user.is_staff = True`. Must be set manually via CLI or Django Admin.
- **Custom Permissions**:
    - `IsAdminOrReadOnly`: For public endpoints.
    - `HasProjectAccess`:
        - `GET`: Allowed if `user.is_staff` OR `user in project.allowed_users`.
        - `POST/PUT/DELETE`: Allowed if `user.is_staff` (or `project.owner`).

### 2.3. API Endpoints

| Method | Endpoint | Permission | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | | | |
| POST | `/api/token/` | Public | Login (Get Access/Refresh Token). **Payload includes `is_staff`.** |
| POST | `/api/token/refresh/` | Public | Refresh Token |
| POST | `/api/register/` | Public | User Registration (Defaults to Visitor) |
| **Projects** | | | |
| GET | `/api/projects/` | Public | List all projects (Metadata only) |
| POST | `/api/projects/` | Admin | Create new project |
| GET | `/api/projects/{id}/` | **HasAccess** | Get project details (includes sequences list) |
| **Sequences** | | | |
| GET | `/api/projects/{id}/sequences/` | **HasAccess** | List sequences in project |
| POST | `/api/projects/{id}/sequences/` | Admin | Add sequence to project |
| **Workflow** | | | |
| POST | `/api/access-requests/` | Authenticated | Request access to a project |
| GET | `/api/access-requests/` | Admin | List pending requests |
| PATCH | `/api/access-requests/{id}/` | Admin | Approve/Reject request |

## 3. Frontend Implementation Plan

### 3.1. Auth Pages
- **Login Page**: Username/Password form -> Store JWT in `localStorage` or `httpOnly cookie`.
- **Register Page**: Basic user creation.
- **Auth Context**: React Context to manage `user` state and `token`. Reads `is_staff` from JWT.

### 3.2. Project List (Dashboard)
- **View**: Grid/List of projects.
- **Action**:
    - If `allowed`: "View Details" button.
    - If `not allowed`: "Request Access" button -> Opens Modal.

### 3.3. Admin Dashboard
- **Tabs**:
    - "My Projects"
    - "Access Requests" (Badge showing pending count).
- **Actions**: Create Project, Approve Requests.

## 4. Migration Strategy
1.  **Phase 1**: Install `simplejwt`, setup Auth API & Frontend Login.
2.  **Phase 2**: Implement `projects` models and migration.
3.  **Phase 3**: Implement API Logic & Permissions.
4.  **Phase 4**: Develop Frontend UI for Projects & Workflow.

## 5. Security Considerations
- **Token Storage**: Prefer `httpOnly` cookies for security, or `localStorage` for simplicity (with CSRF warnings).
- **Validation**: Ensure `sequence` input validates strictly as FASTA/Amino Acids.
- **Audit**: `AccessRequest` serves as an audit log for who granted access to whom.
