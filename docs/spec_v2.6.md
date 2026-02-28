# BioDjango v2.6.0 技术规格文档

## 1. 变更概述

| 项目 | 详情 |
|------|------|
| **版本号** | 2.6.0 |
| **类型** | 安全更新 & 部署修复 |
| **目标** | 修复 Docker 部署问题，实现一键部署 |
| **影响范围** | 前端、后端配置、Nginx、Docker Compose、entrypoint.sh |

---

## 2. 阶段零：预备修复 (Critical)

### 2.0.1 修复 entrypoint.sh 数据库等待条件

**文件**: `backend/entrypoint.sh`

**问题**: 当前条件检查 `DATABASE=postgres`，但该变量从未在 docker-compose 中设置

**修改前**:
```bash
if [ "$DATABASE" = "postgres" ]
then
    echo "Waiting for postgres..."
    # ...
fi
```

**修改后**:
```bash
if [ "$SQL_ENGINE" = "django.db.backends.postgresql" ]
then
    echo "Waiting for postgres..."
    while ! nc -z $SQL_HOST $SQL_PORT; do
      sleep 0.1
    done
    echo "PostgreSQL started"
fi

# Apply database migrations
python manage.py migrate

# Collect static files (NEW)
python manage.py collectstatic --noinput

exec "$@"
```

**说明**:
- 使用 `SQL_ENGINE` 变量（docker-compose 中已设置）
- 添加自动静态文件收集

---

### 2.0.2 添加 Nginx 文件上传配置

**文件**: `nginx/nginx.conf`

**问题**: 缺少 `client_max_body_size` 导致大文件上传失败

**新增配置**:
```nginx
server {
    listen 80;
    server_name localhost;

    # 文件上传大小限制 (NEW)
    client_max_body_size 100M;

    # ... 其他配置
}
```

---

### 2.0.3 添加健康检查端点

**文件**: `backend/config/urls.py`

**新增代码**:
```python
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({'status': 'ok', 'version': '2.6.0'})

urlpatterns = [
    path('api/health/', health_check, name='health-check'),
    # ... 其他 URL
]
```

**说明**:
- 不需要认证
- 用于 Docker 健康检查和负载均衡器探测

---

## 3. 阶段一：核心修复 (Critical)

### 3.1 前端 API 客户端修改

**文件**: `frontend/src/api/client.ts`

#### 3.1.1 修改 API 基础 URL

**修改前**:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
```

**修改后**:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
```

#### 3.1.2 修复 Refresh Token URL

**修改前** (第36行):
```typescript
const response = await axios.post(`${API_BASE_URL}/api/auth/refresh/`, {
    refresh: refreshToken,
});
```

**修改后**:
```typescript
const response = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
    refresh: refreshToken,
});
```

**说明**:
- 当 `API_BASE_URL` 为 `/api` 时，原代码会生成 `/api/api/auth/refresh/` (错误)
- 修改后生成正确路径 `/api/auth/refresh/`

---

### 3.2 Django 安全配置修改

**文件**: `backend/config/settings.py`

#### 3.2.1 ALLOWED_HOSTS 修改

| 配置项 | 修改前 | 修改后 |
|--------|--------|--------|
| 默认值 | `localhost 127.0.0.1 [::1]` | `localhost 127.0.0.1 [::1] web` |

```python
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost 127.0.0.1 [::1] web").split(" ")
```

#### 3.2.2 CORS 配置 (保持不变)

**重要**: 不修改 CORS 默认值，保持 `CORS_ALLOW_ALL_ORIGINS = False`

```python
# 保持原样 - 不改为 True
CORS_ALLOW_ALL_ORIGINS = os.environ.get("CORS_ALLOW_ALL_ORIGINS", "False").lower() == "true"
```

**原因**:
- Nginx 反向代理后，前后端同源，不需要 CORS
- 开启 CORS_ALLOW_ALL_ORIGINS 是安全风险

---

### 3.3 Nginx 配置增强

**文件**: `nginx/nginx.conf`

**完整配置**:

```nginx
server {
    listen 80;
    server_name localhost;

    # 文件上传大小限制
    client_max_body_size 100M;

    # Frontend Static Files
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://web:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时设置 (NEW)
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # WebSocket 支持 (NEW)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;

        # 缓冲设置 (NEW)
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }

    # Django Admin
    location /admin/ {
        proxy_pass http://web:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Django Static Files
    location /django_static/ {
        alias /app/static/;
    }

    # 错误页面 (NEW)
    error_page 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
        internal;
    }
}
```

---

## 4. 阶段二：部署改进 (High)

### 4.1 创建 nginx.Dockerfile (多阶段构建)

**新文件**: `nginx.Dockerfile` (项目根目录)

```dockerfile
# ===========================================
# Stage 1: Build Frontend
# ===========================================
FROM node:22-alpine AS frontend-builder

WORKDIR /app

# Copy package files first for better caching
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY frontend/ ./

# Build production bundle
RUN npm run build

# ===========================================
# Stage 2: Nginx Runtime
# ===========================================
FROM nginx:alpine

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Create error page
RUN echo '<h1>Service Temporarily Unavailable</h1>' > /usr/share/nginx/html/50x.html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**说明**:
- 多阶段构建，最终镜像只包含 Nginx 和编译后的前端
- 无需在主机上安装 Node.js
- 无需手动运行 `npm run build`

---

### 4.2 更新 docker-compose.prod.yml

**文件**: `docker-compose.prod.yml`

```yaml
version: '3.8'

services:
  # Database
  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=${POSTGRES_DB:-biodjango}
      - POSTGRES_USER=${POSTGRES_USER:-postgres}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres}"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Redis
  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Backend API (Gunicorn)
  web:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: gunicorn config.wsgi:application --bind 0.0.0.0:8000
    volumes:
      - static_volume:/app/staticfiles
      - media_volume:/app/media
      - ${BLAST_DB_PATH:-./blastdb}:/data/blastdb
    env_file:
      - .env
    environment:
      - DEBUG=0
      - SQL_ENGINE=django.db.backends.postgresql
      - SQL_HOST=db
      - SQL_PORT=5432
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health/"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  # Celery Worker
  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A config worker -l info
    volumes:
      - ${BLAST_DB_PATH:-./blastdb}:/data/blastdb
    env_file:
      - .env
    environment:
      - DEBUG=0
      - SQL_ENGINE=django.db.backends.postgresql
      - SQL_HOST=db
      - SQL_PORT=5432
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

  # Nginx + Frontend (Multi-stage build)
  nginx:
    build:
      context: .
      dockerfile: nginx.Dockerfile
    ports:
      - "80:80"
    volumes:
      - static_volume:/app/static:ro
    depends_on:
      web:
        condition: service_healthy

volumes:
  postgres_data:
  static_volume:
  media_volume:
```

**主要变更**:
1. nginx 服务改用 `build` 而不是挂载本地目录
2. 添加所有服务的健康检查
3. 使用 `condition: service_healthy` 确保启动顺序
4. 环境变量提供默认值防止启动失败
5. 添加 `env_file: .env` 简化配置

---

### 4.3 环境变量模板

**新文件**: `.env.example`

```bash
# ============================================
# BioDjango v2.6.0 Environment Configuration
# ============================================
# Copy this file to .env and fill in your values:
#   cp .env.example .env
#
# Required variables are marked with [REQUIRED]
# ============================================

# =======================
# Django Settings
# =======================
# [REQUIRED] Generate with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
SECRET_KEY=your-super-secret-key-here

# Set to 1 for development, 0 for production
DEBUG=0

# Space-separated list of allowed hosts
DJANGO_ALLOWED_HOSTS=localhost 127.0.0.1 [::1] web your-domain.com

# =======================
# Database [REQUIRED]
# =======================
POSTGRES_DB=biodjango
POSTGRES_USER=postgres
# [REQUIRED] Use a strong password
POSTGRES_PASSWORD=your-secure-database-password

# =======================
# CORS Settings
# =======================
# Usually not needed with Nginx reverse proxy
# Only set to True if frontend and backend are on different domains
CORS_ALLOW_ALL_ORIGINS=False

# =======================
# Celery
# =======================
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# =======================
# BLAST Database
# =======================
# Path to BLAST database on the host machine
# Leave empty or use default if not using BLAST
BLAST_DB_PATH=/mnt/data/blastdb
```

---

## 5. 部署流程变更

### 修改前 (复杂，5步)

```bash
# 1. 本地安装依赖
cd frontend && npm install

# 2. 本地构建前端
npm run build

# 3. 复制到项目根目录
cd ..

# 4. 启动 Docker
docker-compose -f docker-compose.prod.yml up -d --build

# 5. 收集静态文件
docker-compose -f docker-compose.prod.yml exec web python manage.py collectstatic
```

### 修改后 (简化，2步)

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 填入实际值 (至少设置 SECRET_KEY 和 POSTGRES_PASSWORD)

# 2. 一键部署
docker-compose -f docker-compose.prod.yml up -d --build
```

---

## 6. 兼容性说明

| 场景 | 兼容性 | 说明 |
|------|--------|------|
| 开发模式 (npm run dev) | ✅ 完全兼容 | 可设置 VITE_API_URL=http://localhost:8000 |
| 现有生产部署 (自定义 VITE_API_URL) | ✅ 兼容 | 环境变量优先级高于默认值 |
| 新部署 (使用 Nginx 代理) | ✅ 改善 | 一键部署，无需手动构建前端 |
| 直接连接后端 (不推荐) | ⚠️ 需配置 | 需设置 CORS_ALLOW_ALL_ORIGINS=True |

---

## 7. 风险评估

| 风险 | 级别 | 缓解措施 |
|------|------|----------|
| entrypoint.sh 条件修改 | 低 | 使用已存在的环境变量 |
| Nginx 配置变更 | 低 | 增量添加，不影响现有功能 |
| 前端 API 路径变更 | 中 | 支持 VITE_API_URL 环境变量覆盖 |
| Docker Compose 结构变更 | 中 | 提供完整的迁移文档 |

---

## 8. 验证清单

### 阶段零验证
- [ ] entrypoint.sh 正确等待 PostgreSQL
- [ ] 大文件 (>1MB) 可以上传
- [ ] /api/health/ 返回 200 OK

### 阶段一验证
- [ ] 前端构建无错误
- [ ] API 请求使用相对路径 /api
- [ ] Token 刷新请求正确

### 阶段二验证
- [ ] nginx.Dockerfile 构建成功
- [ ] docker-compose 一键启动
- [ ] 静态文件自动收集

### 阶段三验证
- [ ] DEPLOY.md 步骤可执行
- [ ] 全功能测试通过
