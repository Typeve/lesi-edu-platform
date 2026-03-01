# B02 Auth & Password Security Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现学生登录 JWT、密码哈希、首次改密、管理员重置密码能力，满足 B02 全部验收标准。

**Architecture:** 采用 `auth service + route + middleware` 分层。先用 TDD 定义接口与规则，再最小实现，最后迁移字段并做集成验证。

**Tech Stack:** TypeScript, Hono, Drizzle ORM, MySQL, bcryptjs, jsonwebtoken, Node test runner

---

### Task 1: 依赖与环境变量基线

**Files:**
- Modify: `package.json`
- Modify: `src/config/env.ts`
- Modify: `.env.example`

**Step 1: 添加依赖**
- `bcryptjs`, `jsonwebtoken`

**Step 2: 增加配置项**
- `JWT_SECRET`
- `JWT_EXPIRES_IN_DAYS`
- `ADMIN_API_KEY`

**Step 3: 检查配置编译**
Run: `npm run check`
Expected: PASS

### Task 2: 扩展 students schema 与迁移（TDD）

**Files:**
- Modify: `tests/db/schema.test.ts`
- Modify: `src/db/schema.ts`
- Create/Modify: `drizzle/*`

**Step 1: 写失败测试**
- 断言 `students` 暴露 `passwordHash`、`mustChangePassword`、`passwordUpdatedAt`

**Step 2: 运行测试确认失败**
Run: `npm test`
Expected: FAIL（字段不存在）

**Step 3: 最小实现字段**
- 修改 `students` schema

**Step 4: 回归测试**
Run: `npm test`
Expected: PASS

**Step 5: 生成迁移**
Run: `npm run db:generate`
Expected: 生成新增字段 SQL

### Task 3: 学生登录接口（TDD）

**Files:**
- Create: `tests/auth/student-login.test.ts`
- Create: `src/modules/auth/token.ts`
- Create: `src/modules/auth/password.ts`
- Create: `src/routes/auth.ts`
- Modify: `src/index.ts`

**Step 1: 失败测试**
- 正确密码返回 token + `mustChangePassword`
- 错误密码返回 401

**Step 2: 最小实现**
- bcrypt compare
- JWT sign（7 天）

**Step 3: 验证**
Run: `npm test`
Expected: PASS

### Task 4: 首登强制改密中间件 + 改密接口（TDD）

**Files:**
- Create: `tests/auth/change-password.test.ts`
- Create: `src/middleware/auth.ts`
- Modify/Create: `src/routes/auth.ts`

**Step 1: 失败测试**
- 首登用户访问非改密接口返回 403
- 改密需旧密码正确
- 改密后 `mustChangePassword=false`

**Step 2: 最小实现并验证**
Run: `npm test`
Expected: PASS

### Task 5: 管理员重置密码接口（TDD）

**Files:**
- Create: `tests/auth/admin-reset-password.test.ts`
- Create/Modify: `src/routes/admin.ts`

**Step 1: 失败测试**
- 无/错 `X-Admin-Key` 返回 403
- 正确 key + newPassword 成功，目标学生密码哈希更新

**Step 2: 最小实现并验证**
Run: `npm test`
Expected: PASS

### Task 6: 收尾验证与交付

**Files:**
- Modify: `README.md`

**Step 1: 全量验证**
Run: `npm run check && npm run build && npm test && npm run db:generate`
Expected: 全通过

**Step 2: 提交与推送**
- 按任务批次 commit
- `git push`

**Step 3: Issue 回写**
- 评论变更摘要 + 验证结果
