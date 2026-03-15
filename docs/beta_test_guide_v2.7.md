# BioDjango v2.7 Beta 测试部署与使用指南

## 1. 适用范围

- 目标：将 v2.7 部署到测试环境并发给外部 Beta 用户试用。
- 覆盖：部署步骤、发布前检查、Beta 用户使用提示、注意事项与问题回收。
- 推荐环境：Linux 服务器 + Docker Compose（与生产架构一致）。

## 2. Beta 部署步骤（可直接执行）

### 2.1 准备服务器

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
```

重新登录后确认：

```bash
docker --version
docker compose version
```

### 2.2 拉取代码并配置环境变量

```bash
git clone <your-repo-url>
cd biodjango-next
cp .env.example .env
```

编辑 `.env`，至少配置以下项：

```bash
SECRET_KEY=<请替换为强随机字符串>
DEBUG=0
DJANGO_ALLOWED_HOSTS=localhost 127.0.0.1 [::1] web <服务器IP或域名>
POSTGRES_PASSWORD=<请替换为强密码>
BLAST_DB_PATH=/mnt/data/blastdb
```

说明：

- `BLAST_DB_PATH` 是宿主机路径，需提前创建并放置 BLAST 数据库文件。
- `DEBUG` 建议保持 `0`，避免测试环境泄露调试信息。

### 2.3 一键启动 Beta 环境

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 2.4 验证服务状态

```bash
docker compose -f docker-compose.prod.yml ps
curl http://127.0.0.1/api/health/
```

通过标准：

- `db / redis / web / worker / nginx` 均为 `Up`
- 健康检查返回 `{"status":"ok"}`

### 2.5 发布访问地址

- Web 入口：`http://<服务器IP或域名>/`
- API 基础路径：`http://<服务器IP或域名>/api/`
- Admin：`http://<服务器IP或域名>/admin/`

### 2.6 Project 模块测试前准备（账号与迁移）

是否需要执行 `migrate`：

- 需要保证迁移已执行。
- 使用 Docker Compose 启动时，`web` 容器入口脚本会自动执行 `python manage.py migrate`。
- 建议仍手工核验一次，避免因容器未重建或数据库异常导致迁移缺失。

核验命令：

```bash
docker compose -f docker-compose.prod.yml exec web python manage.py showmigrations projects
```

是否需要执行 `createsuperuser`：

- 若当前环境没有 `is_staff=true` 的管理账号，Project 模块 Beta 测试需要创建至少一个管理员账号。
- 若已有可登录的 staff/admin 账号，可不执行 `createsuperuser`。

创建管理员账号（推荐）：

```bash
docker compose -f docker-compose.prod.yml exec web python manage.py createsuperuser
```

如需把已有用户提升为 staff：

```bash
docker compose -f docker-compose.prod.yml exec web python manage.py shell -c "from django.contrib.auth import get_user_model; U=get_user_model(); u=U.objects.get(username='<用户名>'); u.is_staff=True; u.is_superuser=True; u.save(); print('ok')"
```

## 3. 发布前最小验收清单

在发给 Beta 用户前，至少手工走通以下场景：

1. 未登录可访问公共工具页：BLAST、MSA、Peptide、Sequence Analysis、Primer、Antibody。
2. `/projects` 仍受保护（匿名访问不应泄露项目数据）。
3. 路由映射正确：URL 与页面标题一致，无链式错位。
4. BLAST 与 MSA 可提交并返回任务状态。
5. 触发限流后可看到友好提示（429 + 倒计时）。

## 4. Beta 用户功能使用提示

以下内容可直接发给测试用户。

### 4.1 通用提示

- 建议使用最新版 Chrome/Edge。
- 首次提交后请等待结果区状态变化，不要连续点击提交按钮。
- 若出现“请求过于频繁”，等待倒计时结束后再试。
- 公共工具支持匿名使用；项目管理功能需要登录。

### 4.2 BLAST Search

- 输入格式：蛋白 FASTA（建议带 `>序列名`）。
- 参数：
  - E-Value：默认 `1e-6`
  - Database：`Test DB / SwissProt / PDB`
- 结果为异步任务，界面会自动轮询状态直到完成。
- 注意：序列过短、数据库不匹配或数据库未准备好会导致失败提示。

### 4.3 MSA

- 输入格式：多条 FASTA，至少 2 条序列。
- 提交后为异步任务，界面会显示 `PENDING/STARTED/SUCCESS/FAILURE`。
- 注意：若只有 1 条序列会被判定为无效输入。

### 4.4 Sequence Analysis

- 支持两种输入：
  - 上传 `.fasta / .fa / .txt`
  - 粘贴 FASTA 文本
- 输出包括汇总统计与逐条序列分析明细。
- 支持导出 PDF 报告。

### 4.5 Peptide Calculator

- 参数：
  - Target Mass（Da）
  - Error Range（Da）
  - Number of Amino Acids（2–6）
- 返回结果可下载 CSV。
- 注意：氨基酸数量越大，计算复杂度越高，耗时明显增加。

### 4.6 Primer Design

- 输入：DNA 模板序列（系统会过滤为 `ATCGN`）。
- 参数：
  - Product Size（如 `100-300`）
  - Optimal Tm（默认 60）
- 输出：多组引物对（含序列、Tm、GC%、产物长度）。
- 注意：模板过短或参数不合理时可能无可用引物。

### 4.7 Antibody Annotation

- 输入：蛋白序列（支持 `A-Z` 与 `*`）。
- 方案：`IMGT / Kabat / Chothia`
- 输出：FR/CDR 分区及区域详情。
- 注意：非抗体或片段不完整序列可能导致注释不稳定。

### 4.8 Projects（需要登录）

- `/projects` 用于项目与序列管理，不属于匿名开放范围。
- 管理功能（创建项目、审批访问、上传序列）需要 staff/admin 权限。
- 私有项目需要申请访问并等待审批。
- 若 Beta 主要测工具功能，可先不要求用户进入该模块。

## 5. 常见问题与处理建议

### 5.1 出现 429（Too Many Requests）

- 现象：提示请求过于频繁。
- 处理：等待页面倒计时结束再重试，避免连续点击提交。

### 5.2 工具页提交后无结果

- 检查项：
  1. 浏览器控制台是否有网络错误。
  2. 后端 `web/worker` 日志是否报错。
  3. BLAST 数据库路径和文件是否存在。

### 5.3 访问 400 Bad Request

- 原因：`DJANGO_ALLOWED_HOSTS` 未包含当前访问域名/IP。
- 处理：更新 `.env` 后重启容器。

### 5.4 页面打不开或白屏

- 检查 `nginx` 容器状态与 80 端口放通。
- 检查反向代理或云安全组策略。

## 6. 日志与运维命令

```bash
# 查看全部日志
docker compose -f docker-compose.prod.yml logs -f

# 查看关键服务日志
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f worker
docker compose -f docker-compose.prod.yml logs -f nginx

# 重启服务
docker compose -f docker-compose.prod.yml restart

# 停止服务
docker compose -f docker-compose.prod.yml down
```

## 7. Beta 反馈收集模板

建议让用户按以下格式反馈，便于快速定位：

1. 功能模块（BLAST / MSA / Peptide / Sequence / Primer / Antibody / Projects）
2. 输入示例（可脱敏）
3. 操作步骤（1-2-3）
4. 实际结果（截图 + 错误提示）
5. 期望结果
6. 发生时间（含时区）
7. 浏览器与系统版本

## 8. 对外发布文案（可复制）

> BioDjango v2.7 Beta 已开放测试。  
> 你可以直接体验 BLAST、MSA、Peptide Calculator、Sequence Analysis、Primer Design、Antibody Annotation 等工具。  
> 若遇到“请求频繁”提示，请等待倒计时结束后重试。  
> 如需反馈问题，请附上功能名、输入样例、步骤和截图，感谢支持。
