# BioDjango v2.7 调试日志

## 调试信息

- 日期：2026-03-09
- 调试范围：后端 API + 前端浏览器联调（MCP）
- BLASTDB 路径：`~/Database/blastdb`
- 调试环境：
  - 后端：`DEBUG=0`，Django runserver `127.0.0.1:8000`
  - 前端：Vite dev server `127.0.0.1:5173`

## 调试过程记录

### 1) 后端基线与环境修复

- 执行：`DEBUG=0 python manage.py test analysis.tests`
- 结果：11/11 通过
- 发现问题：
  - 本地数据库未迁移，首次联调出现 `no such table: analysis_analysistask`
  - 执行 `python manage.py shell` 时若 `DEBUG=False`（字符串）会触发 `ValueError`
- 修复动作：
  - 执行：`DEBUG=0 python manage.py migrate`
  - 后续统一使用 `DEBUG=0` 进行 Django 命令

### 2) 后端 API 功能调试（随机序列）

- 初次联调结果：
  - `/api/analysis/blast/`、`/api/analysis/msa/` 返回 500
  - 根因：Celery 连接 `redis:6379` 失败（`RuntimeError: Retry limit exceeded...`）
- 调试切换：
  - 采用本地调试模式启动后端：
  - `DEBUG=0 BLAST_DB_PATH=$HOME/Database/blastdb CELERY_TASK_ALWAYS_EAGER=true CELERY_TASK_EAGER_PROPAGATES=false python manage.py runserver 127.0.0.1:8000`
- 功能验证结果：
  - `/api/analysis/blast/`：202（生成 task）
  - `/api/analysis/msa/`：202（生成 task）
  - `/api/analysis/peptide-calc/`：200
  - `/api/analysis/sequence-analysis/`：200
  - `/api/analysis/primer-design/`：200
  - `/api/analysis/antibody-annotation/`：200
  - `/api/analysis/tasks/<id>/`：200（匿名可轮询）

### 3) 鉴权边界与限流调试

- 鉴权边界：
  - `/api/projects/projects/`：401（符合预期）
  - `/api/core/projects/`：401（符合预期）
  - `/api/analysis/tasks/`：404（不可枚举，符合预期）
- 限流验证（匿名 BLAST 连续 7 次）：
  - 第 1~6 次：202
  - 第 7 次：429
  - 响应头：包含 `Retry-After`
  - 响应体：包含 `detail`

### 4) 前端浏览器 MCP 联调

- 工具：integrated_browser（真实页面导航 + 交互快照）
- 观察结果：
  - 公共工具页未出现自动跳转登录
  - 路由存在错位/重定向异常，目标 URL 与实际 URL 不一致：
    - 访问 `/msa` 实际落到 `/blast`
    - 访问 `/peptide-calc` 实际落到 `/msa`
    - 访问 `/sequence-analysis` 实际落到 `/peptide-calc`
    - 访问 `/primer-design` 实际落到 `/sequence-analysis`
    - 访问 `/antibody-annotation` 实际落到 `/primer-design`
    - 访问 `/projects` 时页面未进入项目页，仍停留工具页链路
  - 在异常路由状态下，页面提交操作未观察到可确认的 API 请求（network requests 为空）
- 证据截图：
  - `/var/folders/th/jvnh7__91t15bs9n9hrsx1qr0000gn/T/trae/screenshots/debug-frontend-routing-20260309.png`

## 调试结论

- 后端：
  - v2.7 的匿名开放、鉴权边界、任务列表禁用、限流行为在调试模式下通过
  - BLASTDB 本机路径可被后端读取（已按 `BLAST_DB_PATH=$HOME/Database/blastdb` 启动）
- 前端：
  - 存在高优先级路由异常，导致功能页映射错位
  - 该问题会直接影响功能验收与前端联调可用性，需优先修复路由映射后再做完整页面提交流程复测

## 建议下一步

- 修复前端路由定义与导航映射关系（按 6 个分析工具一一对应 URL）
- 修复后再次执行浏览器 MCP 回归：
  - 页面 URL 与标题一致性
  - 每页提交后 network 可观测到对应 `/api/analysis/*` 请求
  - 429 页面提示与倒计时显示
  - 受保护页 `/projects` 未登录跳转行为

## 修复复测追加（2026-03-09）

### 1) 修复动作

- 修复文件：`frontend/src/App.tsx`
- 修复内容：
  - 移除 route element 内嵌 `Routes` 的双层结构
  - 采用单一路由树：`Layout + Outlet` 标准嵌套路由
  - 保留顶层统一兜底：`* -> /`

### 2) 构建与回归

- 前端构建：`npm run build` 通过
- MCP 导航回归结果（等待页面稳定后验证）：
  - `/projects` -> Projects（通过）
  - `/blast` -> BLAST Search（通过）
  - `/msa` -> Multiple Sequence Alignment (MSA)（通过）
  - `/peptide-calc` -> Peptide Calculator（通过）
  - `/sequence-analysis` -> Sequence Analysis（通过）
  - `/primer-design` -> Primer Design（通过）
  - `/antibody-annotation` -> Antibody Annotation（通过）
- 结论：未再复现链式错位映射问题

### 3) 证据

- 新增截图：
  - `/var/folders/th/jvnh7__91t15bs9n9hrsx1qr0000gn/T/trae/screenshots/debug-routing-fix-20260309.png`

## Beta 发布文档补充（2026-03-09）

- 新增：`docs/beta_test_guide_v2.7.md`
  - 覆盖 Beta 部署步骤（Docker Compose）
  - 覆盖发布前最小验收清单
  - 覆盖各功能使用提示与注意事项
  - 覆盖反馈收集模板与对外发布文案
- 同步更新：
  - `README.md` 文档列表已加入 Beta 指南入口
  - `DEPLOY.md` 已增加 Beta 指南引用
