# B08 驾驶舱维度聚合 API 设计

## 任务
Issue #10（B08）：实现院系/专业/班级维度聚合 API，返回指标卡、柱状图、堆叠柱，并支持组织筛选。

## 已确认范围
- 单接口返回全部数据结构
- 组织筛选参数：`schoolId/collegeId/majorId/classId`
- 报告方向堆叠维度：`employment/postgraduate/civil_service`
- 补齐专业维度数据模型

## API 设计
- `GET /admin/dashboard/dimension-aggregation`
- 鉴权：`X-Admin-Key`
- 参数：
  - `dimension`: `college|major|class`
  - 可选筛选：`schoolId`,`collegeId`,`majorId`,`classId`

### 返回结构
- `dictionaryVersion`
- `metricCards`
  - `activatedStudentsCount`
  - `assessmentCompletionRate`
  - `reportGenerationRate`
  - `taskCompletionRate`
  - `activityParticipationRate`
- `barChart`
  - `dimension`
  - `categories`
  - `series`（四项比率）
- `stackedBarChart`
  - `dimension`
  - `categories`
  - `series`（三方向分布）

## 数据模型扩展
- 新增 `majors` 表（college 下专业）
- `classes` 增加 `major_id`
- `reports` 增加 `direction`（就业/考研/考公）

## 验收映射
- 按维度聚合接口 ✅
- 返回指标卡 + 柱状图 + 堆叠柱数据结构 ✅
- 支持组织维度筛选 ✅
