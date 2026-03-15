# BioDjango V2.7 Release Notes

发布日期：2026-03-15  
版本标签：`V2.7`

## 概述

V2.7 聚焦于三件事：

1. 分析工具匿名可用（并保持项目数据受保护）
2. 前端路由稳定性修复（消除工具页错位映射）
3. Beta 发布与排障文档体系完善

## 亮点功能

### 1) 公共分析工具开放 + 限流防护

- BLAST、MSA、Peptide Calculator、Sequence Analysis、Primer Design、Antibody Annotation 对匿名用户开放
- 保持 `/api/projects/*` 与 `/api/core/*` 的鉴权边界
- 新增匿名/登录双桶限流，返回标准 `429 + Retry-After`
- 分析任务列表端点禁用公开枚举，降低任务信息暴露风险

## 2) 前端路由重构与稳定性修复

- 将路由改为单一路由树（`Layout + Outlet`）
- 移除非标准双层 `Routes` 结构
- 修复工具页 URL 与页面内容错位问题

## 3) BLAST/MSA 提交链路鲁棒性提升

- 当任务队列不可用时，不再直接返回 500
- 接口返回可读的 `503`，并将任务状态标记为 `FAILURE`
- 降低 Beta 场景下“黑盒失败”概率，便于前后端快速定位

## 文档与测试交付

### 新增文档

- `docs/spec_v2.7.md`
- `docs/iteration_plan_v2.7.md`
- `docs/checklist_v2.7.md`
- `docs/beta_test_guide_v2.7.md`
- `docs/project_beta_test_plan_v2.7.md`
- `docs/debug_plan_v2.7.md`
- `docs/debug_plan_v2.7_routing_fix.md`
- `docs/debug_plan_blast_msa_500_v2.7.md`
- `docs/debug_log_v2.7.md`

### 验证结果

- Backend：`DEBUG=0 python manage.py test analysis.tests` 通过
- Frontend：`npm run build` 通过
- 浏览器回归：工具页路由映射一致性验证通过

## 升级注意事项

1. 生产部署前请核对 `.env` 中数据库与 Redis 参数一致性
2. BLAST/MSA 如出现异常，优先检查 DB 鉴权与队列可用性
3. Project 模块 Beta 测试需保证存在 staff/admin 账号

## 兼容性说明

- 本版本无数据库 schema 破坏性变更
- 对已有登录用户与项目管理流程保持兼容
- 匿名访问能力为增量能力，仅限分析工具模块
