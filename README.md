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
npm install
```

2. 配置环境变量

```bash
cp .env.example .env
```

3. 启动开发服务

```bash
npm run dev
```

默认端口：`3000`

## 常用命令

```bash
npm run check
npm run build
npm test
npm run db:generate
npm run db:migrate
npm run db:studio
```

## 当前数据模型（B01）

- 组织层级：`schools` / `colleges` / `classes` / `students`
- 角色：`roles`（student/teacher/admin）
- 授权范围：`auth_scopes`（school/college/class/student）
- 角色范围关联：`role_scopes`

支持通过 `class_id` / `student_id` 表达授权范围。

## 健康检查

接口：`GET /health`
