# BioDjango v2.6.0 开发任务清单

## 开发状态

| 状态 | 日期 |
|------|------|
| ✅ 方案已批准 | 2026-02-28 |
| 🚀 开发中 | - |
| ⬜ 待完成 | - |

---

## Phase 0: 前置修复 (Critical) - 必须先完成

### 0.1 修复 entrypoint.sh 数据库等待条件
- [ ] **0.1.1** 修改 `backend/entrypoint.sh` 第3行
- [ ] 将 `if [ "$DATABASE" = "postgres" ]` 改为 `if [ "$SQL_ENGINE" = "django.db.backends.postgresql" ]`
- [ ] **0.1.2** 验证修改正确

### 0.2 添加 Nginx client_max_body_size
- [ ] **0.2.1** 修改 `nginx/nginx.conf`
- [ ] 在 `server` 块中添加 `client_max_body_size 100M;`
- [ ] **0.2.2** 验证修改正确

### 0.3 添加健康检查端点
- [ ] **0.3.1** 修改 `backend/config/urls.py`
- [ ] 添加 `/api/health/` 端点（无需认证）
- [ ] **0.3.2** 验证路由配置正确

---

## Phase 1: 核心修复 (Critical)

### 1.1 修复前端 API 配置
- [ ] **1.1.1** 修改 `frontend/src/api/client.ts` 第3行
- [ ] 将 `const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';` 改为 `'/api'`
- [ ] **1.1.2** 修复刷新 token URL 重复 /api 问题（第36行）
- [ ] 改为 `${API_BASE_URL}/auth/refresh/`
- [ ] **1.1.3** 验证修改正确

### 1.2 修复 Django ALLOWED_HOSTS
- [ ] **1.2.1** 修改 `backend/config/settings.py`
- [ ] 在 ALLOWED_HOSTS 默认值中添加 `web`
- [ ] 改为 `"localhost 127.0.0.1 [::1] web"`
- [ ] **1.2.2** 验证修改正确

### 1.3 增强 Nginx 配置
- [ ] **1.3.1** 修改 `nginx/nginx.conf`
- [ ] 添加超时设置: `proxy_connect_timeout`, `proxy_send_timeout`, `proxy_read_timeout`
- [ ] 添加 WebSocket 支持: `proxy_http_version`, `proxy_set_header Upgrade`, `Connection`
- [ ] **1.3.2** 验证配置语法正确

---

## Phase 2: 部署改进 (High)

### 2.1 创建 nginx.Dockerfile
- [ ] **2.1.1** 在项目根目录创建 `nginx.Dockerfile`
- [ ] 实现多阶段构建（Node 构建 + Nginx 运行）
- [ ] **2.1.2** 验证 Dockerfile 语法正确

### 2.2 更新 docker-compose.prod.yml
- [ ] **2.2.1** 修改 nginx 服务配置
- [ ] 使用 `build: .` 代替 volumes 挂载
- [ ] **2.2.2** 添加 env_file 配置
- [ ] **2.2.3** 添加健康检查配置（可选）

### 2.3 添加 collectstatic 到 entrypoint.sh
- [ ] **2.3.1** 修改 `backend/entrypoint.sh`
- [ ] 在 migrate 命令后添加 `python manage.py collectstatic --noinput`
- [ ] **2.3.2** 验证修改正确

### 2.4 创建环境变量模板
- [ ] **2.4.1** 创建项目根目录 `.env.example`
- [ ] 包含所有必需的环境变量
- [ ] **2.4.2** 验证文件内容完整

---

## Phase 3: 文档与测试 (High)

### 3.1 更新部署文档
- [ ] **3.1.1** 重写 `DEPLOY.md`
- [ ] 添加快速开始指南
- [ ] 添加环境变量参考
- [ ] 添加故障排查章节

### 3.2 本地测试验证
- [ ] **3.2.1** 构建 Docker 镜像测试
- [ ] **3.2.2** 验证所有服务启动成功
- [ ] **3.2.3** 测试前后端连接

---

## 任务统计

| 阶段 | 任务数 | 完成数 |
|------|--------|--------|
| Phase 0 | 3 | 0 |
| Phase 1 | 3 | 0 |
| Phase 2 | 4 | 0 |
| Phase 3 | 2 | 0 |
| **总计** | **12** | **0** |

---

## 开发顺序

```
Phase 0 (Critical)
    ├── 0.1 entrypoint.sh
    ├── 0.2 nginx client_max_body_size
    └── 0.3 health check
    │
    ▼
Phase 1 (Critical)
    ├── 1.1 frontend API
    ├── 1.2 ALLOWED_HOSTS
    └── 1.3 nginx config
    │
    ▼
Phase 2 (High)
    ├── 2.1 nginx.Dockerfile
    ├── 2.2 docker-compose.prod.yml
    ├── 2.3 collectstatic
    └── 2.4 .env.example
    │
    ▼
Phase 3 (High)
    ├── 3.1 DEPLOY.md
    └── 3.2 testing
```
