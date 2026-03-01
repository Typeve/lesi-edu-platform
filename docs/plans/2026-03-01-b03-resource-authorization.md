# B03 Resource Authorization Middleware Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现教师访问学生资源的资源级鉴权中间件，覆盖报告/任务/凭证/画像，满足 401/403/授权可见验收标准。

**Architecture:** 采用“授权关系表 + 统一鉴权服务 + 资源解析器 + 路由中间件”架构。先以 TDD 固定授权判定，再最小落地 DB 迁移与路由接入。

**Tech Stack:** TypeScript, Hono, Drizzle ORM, Node test runner

---

### Task 1: 先写失败测试（鉴权核心）

**Files:**
- Create: `tests/auth/resource-authorization.test.ts`

**Step 1:** 写 401/403/404/200 场景失败测试（含四类资源）。
**Step 2:** 运行 `npm test -- tests/auth/resource-authorization.test.ts`，确认 RED。

### Task 2: 实现授权关系 schema 与迁移

**Files:**
- Modify: `src/db/schema.ts`
- Create/Modify: `drizzle/*`

**Step 1:** 新增 `teacher_student_grants` 与 `teacher_class_grants`。
**Step 2:** 运行 `npm run db:generate` 生成迁移。
**Step 3:** 跑 `npm test` 确认未破坏既有测试。

### Task 3: 实现资源级鉴权模块

**Files:**
- Create: `src/modules/authorization/service.ts`
- Create: `src/middleware/resource-authorization.ts`

**Step 1:** 实现 `X-Teacher-Id` 解析与错误返回。
**Step 2:** 实现“学生级优先、班级级兜底”判定。
**Step 3:** 运行定向测试转 GREEN。

### Task 4: 接入四类资源路由

**Files:**
- Create: `src/routes/resources.ts`
- Modify: `src/index.ts`

**Step 1:** 新增四类占位资源路由并接中间件。
**Step 2:** 验证四类资源均可触发鉴权分支。

### Task 5: 收尾与验证

**Files:**
- Modify: `README.md`

**Step 1:** 补充 B03 鉴权说明。
**Step 2:** 执行 `npm test && npm run check && npm run build`。
**Step 3:** 提交、推送、Issue 回写。
