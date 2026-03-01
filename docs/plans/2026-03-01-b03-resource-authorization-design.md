# B03 资源级鉴权中间件设计

## 任务
Issue #5（B03）：实现报告/任务/凭证/画像的资源级鉴权中间件。

## 已确认范围
- 教师身份使用过渡方案：`X-Teacher-Id`
- 资源类型全覆盖：报告 / 任务 / 凭证 / 画像
- 授权优先级：学生级授权优先，班级级授权兜底
- 错误语义：未登录 `401`，越权 `403`，资源不存在 `404`

## 方案与取舍

### 方案 A（采用）：授权关系落库 + 统一中间件
- 新增授权关系表：
  - `teacher_student_grants`（teacher_id, student_id）
  - `teacher_class_grants`（teacher_id, class_id）
- 新增统一鉴权模块：输入资源类型 + 资源 ID，输出 allow/deny
- 在 4 类资源路由接入统一鉴权

优点：
- 直接满足 B03 验收
- 可复用于后续 T01/T03/A04

### 方案 B：先 mock 授权关系，不落库
优点：快；缺点：后续返工大，不作为本次方案。

## 数据模型

在现有 `students` 基础上新增：

1. `teacher_student_grants`
- id
- teacher_id (varchar 64)
- student_id (int fk -> students.id)
- created_at
- unique(teacher_id, student_id)

2. `teacher_class_grants`
- id
- teacher_id (varchar 64)
- class_id (int fk -> classes.id)
- created_at
- unique(teacher_id, class_id)

并为 teacher_id、student_id、class_id 建索引。

## 应用层设计

### 1) 教师身份解析
- 读取 `X-Teacher-Id`
- 缺失/空值：`401`

### 2) 资源归属解析
定义资源访问解析器接口：
- 输入：资源类型 + 资源ID
- 输出：`studentId` 或 `not found`

### 3) 授权判定
1. 先查 `teacher_student_grants(teacher_id, student_id)`
2. 未命中时，查学生所属 `class_id`
3. 再查 `teacher_class_grants(teacher_id, class_id)`
4. 都未命中：`403`

## 路由接入（B03可交付）
新增一组最小可验证路由，覆盖四类资源：
- `/resources/reports/:id`
- `/resources/tasks/:id`
- `/resources/certificates/:id`
- `/resources/profiles/:id`

每个路由先走资源鉴权中间件，再返回占位成功响应。

> 后续具体业务接口替换这些占位路由时，可复用同一中间件。

## 测试策略

TDD 用例覆盖：
1. 缺少 `X-Teacher-Id` -> 401
2. 资源不存在 -> 404
3. 学生级授权命中 -> 200
4. 学生级未命中 + 班级级命中 -> 200
5. 两级都未命中 -> 403
6. 四类资源均至少一条通过用例

## 验收映射
- 未登录访问返回 401 ✅
- 越权访问返回 403 ✅
- 授权教师仅可访问被分配学生资源 ✅
