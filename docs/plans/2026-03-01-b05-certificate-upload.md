# B05 Certificate Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为学生打卡凭证实现受鉴权保护的文件上传接口，支持格式/大小校验并返回 fileId。

**Architecture:** 使用“上传服务 + 学生路由 + 元数据表”三层结构。路由负责鉴权与状态码映射，服务负责文件校验、落盘和元数据入库。

**Tech Stack:** TypeScript, Hono, Drizzle ORM, Node fs/promises

---

### Task 1: 上传接口测试（RED）

**Files:**
- Create: `tests/upload/certificate-upload.test.ts`

**Step 1:** 写未登录、缺文件、非法格式、超大小、成功上传测试。
**Step 2:** 跑定向测试确认 RED。

### Task 2: 上传服务实现（GREEN）

**Files:**
- Create: `src/modules/upload/certificate-upload.ts`

**Step 1:** 实现格式/大小校验与 fileId 生成。
**Step 2:** 实现磁盘写入与失败回滚。

### Task 3: 路由接入与索引装配

**Files:**
- Create: `src/routes/student.ts`
- Modify: `src/index.ts`

**Step 1:** 新增 `/student/certificates/upload`。
**Step 2:** 挂载 `requireStudentAuth`，接入上传服务。

### Task 4: 数据模型与迁移

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0005_*.sql`
- Modify: `drizzle/meta/*`
- Modify: `tests/db/schema.test.ts`
- Modify: `tests/db/migrations.test.ts`

**Step 1:** 新增 `certificate_files` 表。
**Step 2:** 生成迁移并补测试断言。

### Task 5: 回归与收口

**Files:**
- Modify: `.gitignore`

**Step 1:** 忽略 `uploads/` 目录。
**Step 2:** 执行 `npm test && npm run check && npm run build`。
**Step 3:** 提交、推送、Issue 回写、PR。
