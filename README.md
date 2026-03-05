# lesi-edu-platform

高校数智化就业育人大模型平台后端 API（一期 MVP）。

## 技术栈

- Hono.js
- MySQL 5.7
- Drizzle ORM
- TypeScript

## 本地启动

1. 安装依赖

```bash
pnpm install
```

2. 配置环境变量

```bash
cp .env.example .env
```

3. 启动开发服务

```bash
pnpm run dev
```

默认端口：`3000`

## 常用命令

```bash
pnpm run check
pnpm run build
pnpm test
pnpm run db:generate
pnpm run db:migrate
pnpm run db:seed
pnpm run db:studio
```

## 初始化数据库种子数据

数据库迁移完成后，执行以下命令写入种子数据（支持重复执行，按 upsert 更新）：

```bash
pnpm run db:migrate
pnpm run db:seed
```

默认账号：

- 管理员：`admin / 111111`（由 `.env` 中 `ADMIN_API_KEY` 控制）
- 教师：`t01 / 111111`
- 学生：`s01`、`s02`、`s03`，密码均为 `111111`

## 当前能力（B01 + B02）

- 组织层级：`schools` / `colleges` / `classes` / `students`
- 角色：`roles`（student/teacher/admin）
- 授权范围：`auth_scopes`（school/college/class/student）
- 角色范围关联：`role_scopes`

支持通过 `class_id` / `student_id` 表达授权范围。

- 认证能力：
  - 学生登录：`POST /auth/student/login`（JWT）
  - 学生改密：`POST /auth/student/change-password`（旧密码校验）
  - 管理员重置：`POST /admin/students/:id/reset-password`（`X-Admin-Key`）

## 健康检查

接口：`GET /health`
