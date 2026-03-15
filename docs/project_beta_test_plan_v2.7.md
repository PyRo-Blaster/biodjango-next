# Project 功能 Beta 测试方案（v2.7）

## 1. 目标

- 验证 Project 模块鉴权边界正确：匿名受限、普通用户受限、管理员可管理。
- 验证项目访问申请与审批闭环可用。
- 验证 FASTA 上传与序列展示流程可用。

## 2. 前置条件

### 2.1 数据库迁移

```bash
docker compose -f docker-compose.prod.yml exec web python manage.py showmigrations projects
```

通过标准：

- `projects` 下迁移均为 `[X]`。

### 2.2 测试账号

至少准备三类账号：

1. 管理员账号（`is_staff=true`）
2. 普通用户 A
3. 普通用户 B

若缺管理员账号：

```bash
docker compose -f docker-compose.prod.yml exec web python manage.py createsuperuser
```

## 3. 测试范围

1. 项目列表与可见性（public/private）
2. 项目创建（管理员）
3. 私有项目访问申请（普通用户）
4. 访问审批（管理员）
5. FASTA 上传（管理员）
6. 项目详情查看（获批用户）

## 4. 测试用例

### 用例 1：匿名访问受限

- 步骤：
  1. 未登录访问 `/projects`
  2. 直接请求 `/api/projects/projects/`
- 期望：
  - 页面跳转登录或显示未授权。
  - API 返回 401。

### 用例 2：管理员创建项目

- 步骤：
  1. 使用管理员登录。
  2. 进入 Projects，创建一个 public 项目与一个 private 项目。
- 期望：
  - 创建成功并显示在项目列表。
  - 类型标识正确（Public/Private）。

### 用例 3：普通用户访问 public 项目

- 步骤：
  1. 普通用户 A 登录。
  2. 进入 Projects，点击 public 项目。
- 期望：
  - 可直接查看项目序列页。

### 用例 4：普通用户申请 private 项目访问

- 步骤：
  1. 普通用户 A 登录。
  2. 对 private 项目点击 Request Access，填写理由并提交。
- 期望：
  - 按钮状态变为 Pending Approval。
  - 申请记录可被管理员看到。

### 用例 5：管理员审批申请

- 步骤：
  1. 管理员登录 Admin Dashboard。
  2. 审批普通用户 A 的访问申请（Approve）。
- 期望：
  - 申请状态更新为 APPROVED。
  - 普通用户 A 可进入该 private 项目。

### 用例 6：管理员上传 FASTA

- 步骤：
  1. 管理员进入项目详情页。
  2. 上传包含多条序列的 FASTA 文件。
- 期望：
  - 上传成功，列表出现新增序列。
  - 非法字符或重复序列给出友好错误提示。

### 用例 7：普通用户权限边界

- 步骤：
  1. 普通用户 B 登录（未获批 private 访问）。
  2. 尝试访问 private 项目详情 URL。
  3. 尝试调用管理操作接口（创建项目/审批）。
- 期望：
  - 不能查看 private 项目详情。
  - 管理接口返回 403。

## 5. 建议测试数据

- Public 项目：`beta-public-demo`
- Private 项目：`beta-private-demo`
- FASTA 文件：3~5 条蛋白序列，含 1 份非法字符样例用于负向测试

## 6. 关键排障命令

```bash
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f worker
docker compose -f docker-compose.prod.yml exec web python manage.py showmigrations projects
```

## 7. 通过标准

1. 匿名与普通用户权限边界符合预期（401/403）。
2. 管理员流程完整可用（创建项目、审批、上传）。
3. private 项目访问控制正确（审批前后差异明确）。
4. FASTA 上传正反向场景均可复现并有可读反馈。

## 8. 反馈模板（Project 专用）

1. 账号类型（匿名/普通/管理员）
2. 项目类型（public/private）
3. 操作步骤
4. 实际结果（附截图）
5. 期望结果
6. 页面 URL 与时间
