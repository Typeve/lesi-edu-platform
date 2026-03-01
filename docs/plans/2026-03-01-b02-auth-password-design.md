# B02 统一认证与密码安全设计

## 任务
Issue #4（B02）：实现统一认证与密码安全（学号登录、bcrypt、改密、重置）。

## 已确认范围
- 本期仅学生登录（学号 + 密码）
- token 方案：JWT 单 token，过期 7 天
- 学生可自助改密（需旧密码）
- 管理员重置密码接口使用 `X-Admin-Key`（过渡方案）
- 初始密码：导入身份证后 4 位
- 首次登录强制改密
- 身份证缺失或格式异常：导入失败且不创建账号
- 首登状态下：登录返回 token + `mustChangePassword=true`，仅放行改密接口

## 方案对比

### 方案 A（采用）
最小可交付：学生登录 + JWT + 改密 + 管理员重置。

### 方案 B
一次性实现学生/教师/管理员统一登录；超出当前任务范围。

### 方案 C
Session 方案；实现成本偏高，不适配当前阶段。

## 接口设计
- `POST /auth/student/login`
  - 入参：`studentNo`, `password`
  - 出参：`token`, `expiresIn`, `mustChangePassword`
- `POST /auth/student/change-password`（需学生 JWT）
  - 入参：`oldPassword`, `newPassword`
- `POST /admin/students/:id/reset-password`（需 `X-Admin-Key`）
  - 入参：`newPassword`

## 数据模型增量
在 `students` 表新增：
- `password_hash` (varchar, not null)
- `must_change_password` (boolean/tinyint, not null, default true)
- `password_updated_at` (timestamp, nullable)

## 鉴权与拦截
- 新增 JWT 验签中间件
- 新增“首登强制改密”中间件：`must_change_password=true` 且访问非改密接口时返回 403

## 错误码
- 400 参数错误
- 401 登录失败/token 无效
- 403 必须先改密
- 403 管理员密钥无效

## 验证标准映射
- 登录成功返回 token：`/auth/student/login`
- 密码哈希不可逆：统一 bcrypt 存储
- 改密需旧密码：`/auth/student/change-password` 校验
- 重置仅管理员：`X-Admin-Key` 校验
