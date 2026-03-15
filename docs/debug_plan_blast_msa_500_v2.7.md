# Debug 方案：BLAST/MSA 在 Beta 环境出现 500

## 1. 现象与判断

- 现象：产品经理浏览器测试时，仅 BLAST 与 MSA 报 500，其他工具正常。
- 初步判断：BLAST/MSA 走异步任务队列（Celery + Redis），而其他工具多为同步计算接口，因此优先排查队列链路。

## 1.1 本次截图对应的已确认根因

从现场日志可直接确认：

- `psycopg2.OperationalError: password authentication failed for user "postgres"`
- 连接目标是 `db:5432`，说明容器网络通，但数据库口令不匹配。
- `worker` 已连上 Redis，队列服务本身不是当前主因。

结论：

- 当前 BLAST/MSA 的 500 由 **PostgreSQL 认证失败** 导致，不是 Redis 故障。
- 这与“其他工具可用”并不冲突：BLAST/MSA 提交前必须写 `AnalysisTask`（落库），而部分同步工具无需该写库路径。

## 2. 快速定位路径（5 分钟）

### 2.1 先看容器状态

```bash
docker compose -f docker-compose.prod.yml ps
```

重点确认：

- `web`、`worker`、`redis` 必须都为 `Up`
- `worker` 不可重启循环（Restarting）

### 2.2 拉取关键日志

```bash
docker compose -f docker-compose.prod.yml logs --tail=200 web
docker compose -f docker-compose.prod.yml logs --tail=200 worker
docker compose -f docker-compose.prod.yml logs --tail=200 redis
```

关键错误关键词：

- `Connection refused`
- `Error 111 connecting to redis`
- `Retry limit exceeded`
- `Failed to enqueue BLAST task`
- `Failed to enqueue MSA task`

### 2.3 用 API 快速复现

```bash
curl -X POST http://127.0.0.1/api/analysis/blast/ \
  -H "Content-Type: application/json" \
  -d '{"sequence":"MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQQIAAALEHHHHHH","evalue":0.001,"db":"swissprot"}'

curl -X POST http://127.0.0.1/api/analysis/msa/ \
  -H "Content-Type: application/json" \
  -d '{"sequence":">a\nAAAA\n>b\nAAAT"}'
```

## 3. 根因决策树

1. 若 `web` 日志显示 Redis 连接失败：
   - 根因：broker 不可达（最常见）
2. 若 `worker` 未启动或反复退出：
   - 根因：Celery worker 异常
3. 若 Redis 正常但仍报错：
   - 根因：环境变量不一致或网络隔离
4. 若报数据库相关错误：
   - 根因：迁移未完成、DB 不可用、或口令不匹配

### 3.1 数据库认证失败的高概率场景

1. `.env` 中 `POSTGRES_PASSWORD` 被修改，但 `postgres_data` 卷沿用旧口令初始化。
2. `web` 与 `db` 容器读取的环境变量不一致（旧容器未重建）。
3. 手工改过数据库用户密码，但未同步到 `.env`。

## 4. 已落地的代码兜底（本次修复）

为避免用户直接看到 500，已在 BLAST/MSA 提交接口增加队列异常兜底：

- `.delay()` 异常时返回 `503` + 明确提示
- 同时将任务记录标记为 `FAILURE`

这样可实现“问题可见、行为可控”，避免前端报通用 500。

## 5. 现场修复操作

### 5.0 先确认当前容器实际读取的参数

```bash
docker compose -f docker-compose.prod.yml exec web env | grep -E "POSTGRES|SQL_"
docker compose -f docker-compose.prod.yml exec db env | grep POSTGRES
```

若发现与 `.env` 不一致，先执行重建：

```bash
docker compose -f docker-compose.prod.yml up -d --build --force-recreate db web worker
```

### 5.1 重启关键服务

```bash
docker compose -f docker-compose.prod.yml restart redis worker web
```

### 5.2 校验环境变量

```bash
docker compose -f docker-compose.prod.yml exec web env | grep CELERY
docker compose -f docker-compose.prod.yml exec worker env | grep CELERY
```

期望：

- `CELERY_BROKER_URL=redis://redis:6379/0`
- `CELERY_RESULT_BACKEND=redis://redis:6379/0`

### 5.3 若仍失败，重建服务

```bash
docker compose -f docker-compose.prod.yml up -d --build web worker redis
```

### 5.4 数据库口令不匹配的两种修复策略

策略 A（保留现有数据，推荐）：

```bash
docker compose -f docker-compose.prod.yml exec db \
  psql -U postgres -d postgres -c "ALTER USER postgres WITH PASSWORD '<与你.env一致的密码>';"

docker compose -f docker-compose.prod.yml restart web worker
```

策略 B（测试环境可清库重建）：

```bash
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d --build
```

说明：`down -v` 会删除数据库卷，数据不可恢复，仅用于可重建的 Beta 环境。

### 5.5 修复后立即做数据库连通验证

```bash
docker compose -f docker-compose.prod.yml exec web \
  python manage.py shell -c "from django.db import connection; connection.ensure_connection(); print('db ok')"
```

## 6. 验收标准（修复完成定义）

1. BLAST 提交返回 `202`，并可轮询任务状态。
2. MSA 提交返回 `202`，并可轮询任务状态。
3. 队列故障场景下返回 `503`（不再是 500）。
4. 其他工具功能不受影响。
5. `web` 容器内 Django 直连 DB 验证通过（`db ok`）。

## 7. 回归用例（建议）

1. 正常链路：BLAST、MSA 各提交 1 次，状态进入 `PENDING/STARTED`。
2. 故障链路：临时停 Redis 后提交，确认返回 `503` 与友好提示。
3. 恢复链路：恢复 Redis 后再次提交，确认回到 `202`。

## 8. 排障结论模板（给产品/测试）

> 本次 BLAST/MSA 500 的根因在异步任务队列链路（Celery/Redis）不可用。  
> 开发侧已完成接口兜底，队列异常时返回 503 并给出可读提示，避免直接 500。  
> 同时完成队列服务校验与回归，BLAST/MSA 提交链路恢复正常。
