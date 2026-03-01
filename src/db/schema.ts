import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";

export const schools = mysqlTable("schools", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const colleges = mysqlTable(
  "colleges",
  {
    id: int("id").autoincrement().primaryKey(),
    schoolId: int("school_id")
      .notNull()
      .references(() => schools.id),
    name: varchar("name", { length: 128 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    schoolNameUnique: uniqueIndex("colleges_school_id_name_unique").on(table.schoolId, table.name)
  })
);

export const classes = mysqlTable(
  "classes",
  {
    id: int("id").autoincrement().primaryKey(),
    collegeId: int("college_id")
      .notNull()
      .references(() => colleges.id),
    name: varchar("name", { length: 128 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    collegeNameUnique: uniqueIndex("classes_college_id_name_unique").on(table.collegeId, table.name)
  })
);

export const students = mysqlTable(
  "students",
  {
    id: int("id").autoincrement().primaryKey(),
    classId: int("class_id")
      .notNull()
      .references(() => classes.id),
    studentNo: varchar("student_no", { length: 32 }).notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    studentNoUnique: uniqueIndex("students_student_no_unique").on(table.studentNo),
    classIdIdx: index("students_class_id_idx").on(table.classId)
  })
);

export const roles = mysqlTable(
  "roles",
  {
    id: int("id").autoincrement().primaryKey(),
    code: mysqlEnum("code", ["student", "teacher", "admin"]).notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    roleCodeUnique: uniqueIndex("roles_code_unique").on(table.code)
  })
);

export const authScopes = mysqlTable(
  "auth_scopes",
  {
    id: int("id").autoincrement().primaryKey(),
    scopeType: mysqlEnum("scope_type", ["school", "college", "class", "student"]).notNull(),
    schoolId: int("school_id").references(() => schools.id),
    collegeId: int("college_id").references(() => colleges.id),
    classId: int("class_id").references(() => classes.id),
    studentId: int("student_id").references(() => students.id),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    schoolIdIdx: index("auth_scopes_school_id_idx").on(table.schoolId),
    collegeIdIdx: index("auth_scopes_college_id_idx").on(table.collegeId),
    classIdIdx: index("auth_scopes_class_id_idx").on(table.classId),
    studentIdIdx: index("auth_scopes_student_id_idx").on(table.studentId)
  })
);

export const roleScopes = mysqlTable(
  "role_scopes",
  {
    id: int("id").autoincrement().primaryKey(),
    roleId: int("role_id")
      .notNull()
      .references(() => roles.id),
    scopeId: int("scope_id")
      .notNull()
      .references(() => authScopes.id),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    roleScopeUnique: uniqueIndex("role_scopes_role_id_scope_id_unique").on(table.roleId, table.scopeId),
    roleIdIdx: index("role_scopes_role_id_idx").on(table.roleId),
    scopeIdIdx: index("role_scopes_scope_id_idx").on(table.scopeId)
  })
);
