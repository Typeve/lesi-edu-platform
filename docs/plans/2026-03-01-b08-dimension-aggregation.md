# B08 Dimension Aggregation API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 提供驾驶舱维度聚合 API，支持院系/专业/班级聚合并输出指标卡、柱状图、堆叠柱数据。

**Architecture:** 新增 `metrics/aggregation` 服务层，输入 class 级指标记录并按维度分组聚合；Admin 路由只负责鉴权、参数解析和响应。

**Tech Stack:** TypeScript, Hono, Drizzle ORM

---

### Task 1: 聚合服务与路由测试（RED）
- `tests/metrics/dashboard-aggregation.test.ts`
- `tests/metrics/admin-dimension-aggregation.test.ts`

### Task 2: 聚合服务实现（GREEN）
- `src/modules/metrics/aggregation.ts`

### Task 3: Admin 路由接入
- `src/routes/admin.ts`
- `src/index.ts`

### Task 4: 数据模型与迁移
- `src/db/schema.ts`
- `drizzle/0006_*.sql`
- `tests/db/schema.test.ts`
- `tests/db/migrations.test.ts`

### Task 5: 回归与收口
- `npm test && npm run check && npm run build`
- 提交、推送、Issue 回写、PR
