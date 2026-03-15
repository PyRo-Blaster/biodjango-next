# Debug Plan: BioDjango v2.7.0 Internal QA

## 1. 目标

- 验证匿名用户可正常使用 analysis 工具接口与页面。
- 验证限流行为与 `Retry-After` 响应符合预期。
- 验证受保护模块仍保持鉴权边界。
- 验证前端 401/429 处理不产生误跳转和死循环。

## 2. 调试前准备

### 2.1 依赖与构建

- 后端依赖安装：`pip install -r backend/requirements.txt`
- 前端依赖安装：`npm install`（目录：`frontend`）
- 前端构建校验：`npm run build`（目录：`frontend`）

### 2.2 本地环境

- 后端以 `DEBUG=0` 启动，确保与测试环境行为一致。
- 确认缓存可用（本地可用 LocMem，联调建议 Redis）。
- 清理浏览器 `localStorage` 中 token，用于匿名场景验证。

### 2.3 回归基线

- 先执行后端单测：`DEBUG=0 python manage.py test analysis.tests`（目录：`backend`）
- 单测通过后再执行联调，避免把代码问题误判为环境问题。

## 3. 后端调试步骤

### 3.1 匿名访问调试

1. POST `/api/analysis/blast/`
2. POST `/api/analysis/msa/`
3. POST `/api/analysis/peptide-calc/`
4. POST `/api/analysis/sequence-analysis/`
5. POST `/api/analysis/primer-design/`
6. POST `/api/analysis/antibody-annotation/`

期望：

- 接口不返回 401。
- 返回业务可接受状态（202/200/400 取决于输入有效性）。

### 3.2 限流调试

步骤：

1. 对同一匿名端点快速连续请求 7 次（建议 BLAST）。
2. 记录第 7 次响应状态与 header。

期望：

- 触发 429。
- 响应头包含 `Retry-After`。
- 响应体包含 `detail`。

### 3.3 鉴权边界调试

步骤：

1. 匿名访问 `/api/projects/projects/`
2. 匿名访问 `/api/core/*` 代表性接口
3. 匿名访问 `/api/analysis/tasks/`
4. 匿名访问 `/api/analysis/tasks/<uuid>/`（使用有效 task id）

期望：

- `/api/projects/*` 与 `/api/core/*` 返回鉴权失败。
- `/api/analysis/tasks/` 不可枚举（404）。
- `/api/analysis/tasks/<uuid>/` 可用于状态轮询。

## 4. 前端调试步骤

### 4.1 匿名工具链路

逐页验证：

- `/blast`
- `/msa`
- `/peptide-calc`
- `/sequence-analysis`
- `/primer-design`
- `/antibody-annotation`

期望：

- 不出现自动跳转登录。
- 可提交请求并看到结果或业务错误。

### 4.2 429 交互调试

步骤：

1. 在任一工具页触发 429。
2. 观察页面警告条与倒计时。
3. 倒计时结束后再次提交。

期望：

- 显示限流提示与剩余秒数。
- 倒计时归零后可重试。

### 4.3 401 路由行为调试

步骤：

1. 清空 token。
2. 访问公共工具页并触发请求。
3. 访问受保护页面 `/projects` 并触发受保护 API。

期望：

- 公共接口 401 不触发强制跳转。
- 受保护接口 401 触发刷新令牌或跳转登录。

## 5. 常见故障与排查路径

### 故障 A：工具页仍跳转登录

检查项：

- 前端请求是否经过 `apiClient`。
- `isPublicPath` 是否正确识别 `/analysis/`。
- 控制台是否存在 refresh 请求路径错误。

### 故障 B：429 不显示倒计时

检查项：

- 响应头是否返回 `Retry-After`。
- `handleApiError` 是否被页面使用。
- 页面是否正确渲染 `RateLimitAlert`。

### 故障 C：匿名未触发限流

检查项：

- `DEFAULT_THROTTLE_RATES` 是否生效。
- 视图是否配置 `throttle_classes`。
- 缓存是否可写且实例间共享策略符合环境预期。

### 故障 D：/tasks/ 可被枚举

检查项：

- `AnalysisTaskViewSet.list` 是否已禁用。
- 路由是否命中正确 viewset。

## 6. 建议调试日志记录模板

每个问题记录以下字段：

- 环境：本地 / 测试 / 预发
- 页面或接口路径
- 请求方法、状态码、响应体、关键响应头
- 用户态：匿名 / 已登录
- 是否稳定复现
- 修复 commit 与复测结论

## 7. 发布前最终门禁

必须全部通过：

1. `analysis.tests` 全量通过。
2. 前端 `npm run build` 通过。
3. 匿名 analysis 可用。
4. 429 可观测且可恢复。
5. 受保护接口保持鉴权。
6. `/api/analysis/tasks/` 不可枚举。
