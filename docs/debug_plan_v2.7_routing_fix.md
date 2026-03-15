# Debug Plan: BioDjango v2.7 路由映射修复回归

## 1. 目标

- 验证前端路由映射一一对应，不再出现 URL 与页面错位。
- 验证公共工具页与受保护页面在修复后行为稳定。
- 验证后端 API 与前端页面联动可用，满足内部验收标准。

## 2. 调试前准备

### 2.1 服务启动

- 后端（调试模式，避免 Redis 依赖导致假失败）：
  - `DEBUG=0 BLAST_DB_PATH=$HOME/Database/blastdb CELERY_TASK_ALWAYS_EAGER=true CELERY_TASK_EAGER_PROPAGATES=false python manage.py runserver 127.0.0.1:8000`
- 前端：
  - `npm run dev -- --host 127.0.0.1 --port 5173`

### 2.2 基线检查

- 前端构建通过：`npm run build`
- 后端单测通过：`DEBUG=0 python manage.py test analysis.tests`

## 3. 路由映射专项调试

### 3.1 URL 与页面标题一致性

逐项访问并核对 URL 与主标题：

1. `/projects` -> Projects
2. `/blast` -> BLAST Search
3. `/msa` -> Multiple Sequence Alignment (MSA)
4. `/peptide-calc` -> Peptide Calculator
5. `/sequence-analysis` -> Sequence Analysis
6. `/primer-design` -> Primer Design
7. `/antibody-annotation` -> Antibody Annotation

通过标准：

- URL 与页面标题严格一致。
- 页面切换后不存在“上一页内容残留导致错判”的稳定复现问题。

### 3.2 导航链路稳定性

按以下链路连续点击：

- Dashboard -> BLAST -> MSA -> Peptide Calculator -> Sequence Analysis -> Primer Design -> Antibody Annotation -> Projects

通过标准：

- 每一步仅跳到对应页面。
- 不出现链式错位或滞后一页的异常。

## 4. 功能联动回归（页面 + API）

### 4.1 公共工具页

使用模拟随机序列执行提交验证：

- BLAST：蛋白随机序列
- MSA：两条 FASTA 随机序列
- Sequence Analysis：随机 DNA FASTA
- Primer Design：随机 DNA 模板
- Antibody Annotation：标准重链示例序列
- Peptide Calculator：固定质量参数（500/1.0/4）

通过标准：

- 页面可提交，不被强制跳转登录。
- API 返回符合工具预期状态（202/200/400 依输入合理性）。

### 4.2 鉴权边界

- 匿名访问 `/projects` 页面并观察请求行为。
- 确认受保护资源依旧遵守鉴权边界。

通过标准：

- 受保护模块不被匿名放开。
- 公共工具页不因 401 误跳登录。

## 5. 证据采集

每次调试需保留以下证据：

- 路由回归截图（至少 1 张全页）
- 关键页面快照（URL + 标题 + 输入区）
- API 关键状态码记录（含 429 时的 `Retry-After`）
- 问题复现步骤与复测结果

## 6. 失败判定与处理

若出现以下任一项即判定未通过：

1. URL 与页面标题不一致。
2. 连续导航出现链式错位。
3. 公共工具页触发异常登录跳转。
4. 核心工具页无法触发正确 API 请求。

处理流程：

- 先记录复现路径与截图；
- 回滚到最近稳定分支或提交；
- 修复后按本方案全量复测，不允许局部抽测替代。

## 7. 发布门禁

以下全部满足才可进入下一阶段：

1. 路由专项调试全部通过。
2. 页面+API 联动回归通过。
3. 证据齐全并归档到调试日志。
4. checklist/spec/iteration plan 与实际实现保持一致。
