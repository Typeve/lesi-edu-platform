# B05 打卡凭证文件上传设计

## 任务
Issue #7（B05）：实现打卡凭证文件上传能力（图片/文件），支持白名单与大小限制，返回可追踪 fileId，非法格式拒绝。

## 已确认约束
- 存储方式：本地磁盘目录
- 白名单：jpg/jpeg/png/pdf/doc/docx
- 大小限制：10MB
- 鉴权：必须校验学生登录态（Bearer token）
- 成功返回：仅返回 `fileId`

## API 设计
- `POST /student/certificates/upload`
- Header：`Authorization: Bearer <token>`
- Body：`multipart/form-data`，字段 `file`

### 返回语义
- 200：`{ "fileId": "..." }`
- 400：请求体非法或缺少文件
- 401：未登录或登录态无效
- 413：文件超过 10MB
- 415：文件格式不在白名单

## 数据模型
新增 `certificate_files`：
- `id` int pk
- `file_id` varchar(64) unique
- `student_id` int fk -> students.id
- `original_name` varchar(255)
- `mime_type` varchar(128)
- `size_bytes` int
- `storage_path` varchar(255)
- `created_at` timestamp

## 落盘策略
- 目录：`uploads/certificates/`
- 文件名：`<fileId>.<ext>`
- 若写盘成功但入库失败：删除已写入文件（回滚）

## 模块拆分
- `src/modules/upload/certificate-upload.ts`
  - 校验格式/大小
  - 生成 fileId
  - 写入磁盘
  - 调用 repo 写入元数据
- `src/routes/student.ts`
  - 学生上传路由
  - 映射错误到 HTTP 状态码

## 验收映射
- 白名单与大小限制 ✅
- 返回可追踪 fileId ✅
- 非法格式拒绝并提示 ✅
