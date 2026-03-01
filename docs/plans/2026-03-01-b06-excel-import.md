# B06 Excel Import Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 提供统一 Excel 导入校验接口，支持招生/就业两类数据并返回完整质量报告。

**Architecture:** 采用“Admin 路由鉴权 + Import 校验服务”结构。服务负责 `.xlsx` 解析、规则校验和结果汇总，路由负责参数校验与状态码映射。

**Tech Stack:** TypeScript, Hono, SheetJS(xlsx), Node test runner

---

### Task 1: 校验服务测试（RED）

**Files:**
- Create: `tests/import/excel-validation.test.ts`

**Step 1:** 写缺失字段/重复学号/非法值测试。
**Step 2:** 跑定向测试确认 RED。

### Task 2: Admin 路由测试（RED）

**Files:**
- Create: `tests/import/admin-excel-import.test.ts`

**Step 1:** 写 403/400/415/200 场景。
**Step 2:** 跑定向测试确认 RED。

### Task 3: 实现导入校验服务（GREEN）

**Files:**
- Create: `src/modules/import/excel-validation.ts`
- Modify: `package.json` / `package-lock.json`

**Step 1:** 接入 xlsx 读取首个 sheet。
**Step 2:** 实现 datasetType 分支规则。
**Step 3:** 输出统计与 errors 明细。

### Task 4: 路由接入

**Files:**
- Modify: `src/routes/admin.ts`
- Modify: `src/index.ts`

**Step 1:** 新增 `/admin/imports/excel/validate`。
**Step 2:** 接入 admin key + 文件类型判断 + 服务调用。

### Task 5: 回归与收口

**Files:**
- Modify: `README.md`（如需）

**Step 1:** 执行 `npm test && npm run check && npm run build`。
**Step 2:** 提交、推送、Issue 回写、PR。
