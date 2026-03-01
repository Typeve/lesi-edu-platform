# B01 角色与范围数据模型设计

## 背景
任务 B01 需建立 Student/Teacher/Admin 角色模型，以及 School/College/Class/Student 的授权范围表达能力，并确保迁移可重复执行。

## 目标
1. 提供角色表、范围表、关联表。
2. 范围表可直接表达 `class_id` 与 `student_id`。
3. 为后续 B02/B03/A04 留出扩展点。

## 方案对比

### 方案 A（推荐）：通用 role + scope + role_scope
- `roles`：角色字典（student/teacher/admin）
- `auth_scopes`：范围实例（school/college/class/student）+ 组织/学生外键
- `role_scopes`：角色与范围关联
- 优点：满足当前验收；模型简单；后续易接入用户授权
- 缺点：不直接表示“具体用户被授予该范围”，后续任务补齐

### 方案 B：直接做 user_role_scope 三元模型
- 一次引入用户账号、角色、范围三元关系
- 优点：一步到位
- 缺点：超出 B01 范围，和 B02 认证耦合过早

### 方案 C：纯枚举字段（无独立字典表）
- 在授权表直接写 role/scope_type 字符串
- 优点：开发快
- 缺点：一致性差、扩展困难

## 采用方案
采用方案 A。

## 数据模型
- `schools` / `colleges` / `classes` / `students`
- `roles`
- `auth_scopes`（含 `scope_type`、`school_id`、`college_id`、`class_id`、`student_id`）
- `role_scopes`

## 约束
- `roles.code` 唯一
- `students.student_no` 唯一
- `auth_scopes` 对 `class_id`、`student_id` 建索引
- `role_scopes(role_id, scope_id)` 唯一

## 测试与验证
- 通过测试验证 schema 暴露了核心表与关键列（含 `class_id`/`student_id`）。
- `npm run db:generate` 生成迁移。
- 使用 drizzle migration 机制保证重复执行安全（已执行迁移不会重复应用）。
