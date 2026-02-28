# BioDjango v2.6.0 开发检查清单

## 开发状态

| 状态 | 日期 |
|------|------|
| ✅ 方案已批准 | 2026-02-28 |
| ✅ 开发完成 | 2026-02-28 |

---

## Phase 0: 前置修复 (Critical) ✅

### 0.1 修复 entrypoint.sh 数据库等待条件
- [x] **0.1.1** 修改 `backend/entrypoint.sh` 第3行
- [x] 将 `if [ "$DATABASE" = "postgres" ]` 改为 `if [ "$SQL_ENGINE" = "django.db.backends.postgresql" ]`
- [x] **0.1.2** 验证修改正确

### 0.2 添加 Nginx client_max_body_size
- [x] **0.2.1** 修改 `nginx/nginx.conf`
- [x] 在 `server` 块中添加 `client_max_body_size 100M;`
- [x] **0.2.2** 验证修改正确

### 0.3 添加健康检查端点
- [x] **0.3.1** 修改 `backend/config/urls.py`
- [x] 添加 `/api/health/` 端点（无需认证）
- [x] **0.3.2** 验证路由配置正确

---

## Phase 1: 核心修复 (Critical) ✅

### 1.1 修复前端 API 配置
- [x] **1.1.1** 修改 `frontend/src/api/client.ts` 第3行
- [x] 将 `const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';` 改为 `'/api'`
- [x] **1.1.2** 修复刷新 token URL 重复 /api 问题（第36行）
- [x] 改为 `${API_BASE_URL}/auth/refresh/`
- [x] **1.1.3** 验证修改正确

### 1.2 修复 Django ALLOWED_HOSTS
- [x] **1.2.1** 修改 `backend/config/settings.py`
- [x] 在 ALLOWED_HOSTS 默认值中添加 `web`
- [x] 改为 `"localhost 127.0.0.1 [::1] web"`
- [x] **1.2.2** 验证修改正确

### 1.3 增强 Nginx 配置
- [x] **1.3.1** 修改 `nginx/nginx.conf`
- [x] 添加超时设置: `proxy_connect_timeout`, `proxy_send_timeout`, `proxy_read_timeout`
- [x] 添加 WebSocket 支持: `proxy_http_version`, `proxy_set_header Upgrade`, `Connection`
- [x] **1.3.2** 验证配置语法正确

---

## Phase 2: 部署改进 (High) ✅

### 2.1 创建 nginx.Dockerfile
- [x] **2.1.1** 在项目根目录创建 `nginx.Dockerfile`
- [x] 实现多阶段构建（Node 构建 + Nginx 运行）
- [x] **2.1.2** 验证 Dockerfile 语法正确

### 2.2 更新 docker-compose.prod.yml
- [x] **2.2.1** 修改 nginx 服务配置
- [x] 使用 `build: .` 代替 volumes 挂载
- [x] **2.2.2** 添加 env_file 配置
- [x] **2.2.3** 添加健康检查配置

### 2.3 添加 collectstatic 到 entrypoint.sh
- [x] **2.3.1** 修改 `backend/entrypoint.sh`
- [x] 在 migrate 命令后添加 `python manage.py collectstatic --noinput`
- [x] **2.3.2** 验证修改正确

### 2.4 创建环境变量模板
- [x] **2.4.1** 创建项目根目录 `.env.example`
- [x] 包含所有必需的环境变量
- [x] **2.4.2** 验证文件内容完整

---

## Phase 3: 文档与测试 (High) ✅

### 3.1 更新部署文档
- [x] **3.1.1** 重写 `DEPLOY.md`
- [x] 添加快速开始指南
- [x] 添加环境变量参考
- [x] 添加故障排查章节

### 3.2 本地测试验证
- [ ] **3.2.1** 构建 Docker 镜像测试
- [ ] **3.2.2** 验证所有服务启动成功
- [ ] **3.2.3** 测试前后端连接

---

## 任务统计

| 阶段 | 任务数 | 完成数 |
|------|--------|--------|
| Phase 0 | 3 | 3 |
| Phase 1 | 3 | 3 |
| Phase 2 | 4 | 4 |
| Phase 3 | 2 | 1 |
| **总计** | **12** | **11** |

---

## 修改的文件清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `backend/entrypoint.sh` | 修改 | 修复数据库等待条件 + 添加 collectstatic |
| `backend/config/urls.py` | 修改 | 添加健康检查端点 |
| `backend/config/settings.py` | 修改 | ALLOWED_HOSTS 添加 web |
| `frontend/src/api/client.ts` | 修改 | API URL 改为相对路径 |
| `nginx/nginx.conf` | 修改 | 添加 client_max_body_size、超时、WebSocket |
| `docker-compose.prod.yml` | 修改 | 使用 nginx.Dockerfile、添加健康检查 |
| `.env.example` | 新建 | 环境变量模板 |
| `nginx.Dockerfile` | 新建 | 多阶段构建 |
| `DEPLOY.md` | 重写 | 完整部署文档 |

---

## 文档清单

| 文档 | 状态 |
|------|------|
| [iteration_plan_v2.6.md](file:///Users/chenji/Desktop/biodjango-next/docs/iteration_plan_v2.6.md) | ✅ 完成 |
| [feasibility_v2.6.md](file:///Users/chenji/Desktop/biodjango-next/docs/feasibility_v2.6.md) | ✅ 完成 |
| [tasks_v2.6.md](file:///Users/chenji/Desktop/biodjango-next/docs/tasks_v2.6.md) | ✅ 完成 |
| [checklist_v2.6.md](file:///Users/chenji/Desktop/biodjango-next/docs/checklist_v2.6.md) | ✅ 完成 |
| [DEPLOY.md](file:///Users/chenji/Desktop/biodjango-next/DEPLOY.md) | ✅ 完成 |
