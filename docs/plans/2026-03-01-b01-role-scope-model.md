# B01 Role Scope Model Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 MySQL/Drizzle 中实现角色、范围、关联模型，满足 `class_id`/`student_id` 级授权表达。

**Architecture:** 采用 `roles + auth_scopes + role_scopes` 三表为核心，配合组织层级表（school/college/class/student）支撑外键与层级范围表达。先通过失败测试定义目标，再最小实现 schema，最后生成迁移并验证。

**Tech Stack:** TypeScript, Drizzle ORM, drizzle-kit, Node.js test runner

---

### Task 1: 建立测试基线（TDD Red）

**Files:**
- Create: `tests/db/schema.test.ts`
- Modify: `package.json`

**Step 1: 写失败测试**
- 断言存在 `roles`、`authScopes`、`roleScopes`。
- 断言 `authScopes` 含 `classId`、`studentId`。

**Step 2: 运行并确认失败**
- Run: `npm test`
- 预期：因缺少导出/字段而失败。

### Task 2: 实现最小 schema（TDD Green）

**Files:**
- Modify: `src/db/schema.ts`

**Step 1: 增加组织与授权相关表**
- 新增 `schools/colleges/classes/roles/auth_scopes/role_scopes`。
- 扩展 `students` 增加 `class_id` 外键与唯一学号。

**Step 2: 再跑测试**
- Run: `npm test`
- 预期：测试通过。

### Task 3: 生成 migration 并验证

**Files:**
- Create/Modify: `drizzle/*`

**Step 1: 生成迁移**
- Run: `npm run db:generate`

**Step 2: 类型与构建验证**
- Run: `npm run check && npm run build`

### Task 4: 记录进展与交付

**Files:**
- Modify: `README.md`（如需补充）

**Step 1:** 汇总变更与验证结果。
**Step 2:** 在 Issue #3 留进展 comment。
