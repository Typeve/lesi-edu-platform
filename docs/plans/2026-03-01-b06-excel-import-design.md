# B06 Excel 导入与质量校验设计

## 任务
Issue #8（B06）：实现招生/就业 Excel 导入与质量校验基础能力。

## 已确认约束
- 仅支持 `.xlsx`
- 单接口，`datasetType` 区分 `enrollment` / `employment`
- 本阶段只做校验，不落库
- 返回 `total/success/failed + errors[]`（行号/字段/原因）

## API 设计
- `POST /admin/imports/excel/validate`
- 鉴权：`X-Admin-Key`
- 请求：`multipart/form-data`
  - `datasetType`: `enrollment | employment`
  - `file`: `.xlsx`

### 返回
- 200: `{ total, success, failed, errors: [{ row, field, reason }] }`
- 400: 缺少参数/非法 datasetType/缺文件
- 403: admin key 无效
- 415: 文件类型不支持

## 校验规则
通用：
- 缺失字段（必填为空）
- 重复学号（同一导入文件内）

招生（enrollment）额外：
- `score` 必须为 0~750 数值
- `admissionYear` 必须为 2000~2100 整数

就业（employment）额外：
- `status` 必须为 `employed|unemployed|further_study|civil_service`
- `salary` 必须为 >=0 数值

## 实现结构
- `src/modules/import/excel-validation.ts`：Excel 解析 + 规则校验
- `src/routes/admin.ts`：新增导入校验路由
- `src/index.ts`：装配导入服务

## 验收映射
- 支持 Excel 导入 ✅
- 识别缺失字段/重复学号/非法值 ✅
- 返回成功/失败计数 ✅
