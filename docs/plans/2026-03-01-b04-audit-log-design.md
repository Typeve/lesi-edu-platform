# B04 授权与关键操作审计日志设计

## 任务
Issue #6（B04）：授权分配/撤销、密码重置、活动发布均写审计日志；日志需包含操作者、目标、时间、动作。

## 设计目标
- 建立统一审计日志模型，避免各接口自行拼接日志字段。
- 先覆盖当前可落地关键操作：
  - 管理员重置密码
  - 授权分配/撤销
  - 活动发布
- 保持后续 A01/A04/A06 可复用。

## 数据模型
新增表：
1. `activities`
   - `activity_type`（course/competition/project）
   - `title`
   - `created_at`
2. `audit_logs`
   - `operator`（操作者）
   - `action`（authorization_grant / authorization_revoke / password_reset / activity_publish）
   - `target`（目标）
   - `detail`（补充信息）
   - `created_at`（时间）

## 应用层方案
- 新增审计服务 `modules/audit/service.ts`
  - 统一写入 operator/action/target/createdAt
- 新增授权分配服务 `modules/authorization/grant-service.ts`
- 新增活动发布服务 `modules/activity/service.ts`
- 在 `routes/admin.ts` 中接入：
  - `POST /admin/students/:id/reset-password`
  - `POST /admin/authorizations/grants`
  - `DELETE /admin/authorizations/grants`
  - `POST /admin/activities`

## 验收映射
- 授权分配/撤销写审计 ✅
- 密码重置写审计 ✅
- 活动发布写审计 ✅
- 日志含操作者/目标/时间/动作 ✅
