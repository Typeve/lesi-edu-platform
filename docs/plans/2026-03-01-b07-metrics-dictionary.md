# B07 Metrics Dictionary Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立统一、可版本追溯的驾驶舱指标口径字典与计算规则模块。

**Architecture:** 新增 `metrics` 模块，拆分为“口径定义（字典）+ 计算函数（指标率/漏斗）”。以纯函数实现，暂不依赖数据库和 API。

**Tech Stack:** TypeScript, Node test runner

---

### Task 1: 口径定义测试（RED）

**Files:**
- Create: `tests/metrics/metrics-dictionary.test.ts`

**Step 1:** 断言指标定义完整、漏斗顺序固定、版本可追溯。
**Step 2:** 运行定向测试确认 RED。

### Task 2: 计算规则测试（RED）

**Files:**
- Create: `tests/metrics/metrics-calculation.test.ts`

**Step 1:** 断言四项比率计算正确。
**Step 2:** 断言分母为 0 时回退 0。
**Step 3:** 断言漏斗阶段转化计算正确。

### Task 3: 实现 metrics 模块（GREEN）

**Files:**
- Create: `src/modules/metrics/dictionary.ts`

**Step 1:** 实现版本字典、changelog、指标定义、漏斗定义。
**Step 2:** 实现指标率与漏斗纯函数。

### Task 4: 验证与收口

**Files:**
- Modify: `docs/plans/*`（当前文档）

**Step 1:** 运行 `npm test && npm run check && npm run build`。
**Step 2:** 提交、推送、Issue 回写、PR。
