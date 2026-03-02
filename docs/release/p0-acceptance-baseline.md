# P0 发布验收基线

更新时间：2026-03-02

## 1) P0 清单

- [x] 学生闭环联调（#29）
- [x] 授权流程联调（#30）
- [x] 活动发布执行联调（#31）
- [x] 权限与越权回归（#32）

## 2) 关键 API 错误率

- 目标阈值：`< 1%`
- 当前观测：集成回归测试样本中错误率 `0%`
- 统计口径：`npm test` 集成与回归链路

## 3) 数据可追溯

- 导入数据：可追溯字段 `datasetType/total/success/failed/errors`
- 报告数据：可追溯字段 `studentNo/jobId/status/payloadJson`
- 任务数据：可追溯字段 `taskId/studentId/checkInId/fileId/submittedAt`

## 4) API 基线出口

新增：`GET /admin/release/p0-baseline`

- 返回 P0 清单状态
- 返回错误率阈值与观测值
- 返回导入/报告/任务的可追溯字段声明
