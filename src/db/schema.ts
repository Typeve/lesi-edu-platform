import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
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

export const majors = mysqlTable(
  "majors",
  {
    id: int("id").autoincrement().primaryKey(),
    collegeId: int("college_id")
      .notNull()
      .references(() => colleges.id),
    name: varchar("name", { length: 128 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    collegeNameUnique: uniqueIndex("majors_college_id_name_unique").on(table.collegeId, table.name),
    collegeIdIdx: index("majors_college_id_idx").on(table.collegeId)
  })
);

export const classes = mysqlTable(
  "classes",
  {
    id: int("id").autoincrement().primaryKey(),
    collegeId: int("college_id")
      .notNull()
      .references(() => colleges.id),
    majorId: int("major_id").references(() => majors.id),
    name: varchar("name", { length: 128 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    collegeNameUnique: uniqueIndex("classes_college_id_name_unique").on(table.collegeId, table.name),
    majorIdIdx: index("classes_major_id_idx").on(table.majorId)
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
    credentialNo: varchar("credential_no", { length: 32 }),
    passwordHash: varchar("password_hash", { length: 255 }),
    mustChangePassword: boolean("must_change_password").notNull().default(true),
    passwordUpdatedAt: timestamp("password_updated_at"),
    firstLoginVerifiedAt: timestamp("first_login_verified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    studentNoUnique: uniqueIndex("students_student_no_unique").on(table.studentNo),
    classIdIdx: index("students_class_id_idx").on(table.classId)
  })
);

export const enrollmentProfiles = mysqlTable(
  "enrollment_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    studentNo: varchar("student_no", { length: 32 }).notNull(),
    name: varchar("name", { length: 64 }),
    schoolName: varchar("school_name", { length: 128 }),
    majorName: varchar("major_name", { length: 128 }),
    score: int("score"),
    admissionYear: int("admission_year"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (table) => ({
    studentNoUnique: uniqueIndex("enrollment_profiles_student_no_unique").on(table.studentNo),
    studentNoIdx: index("enrollment_profiles_student_no_idx").on(table.studentNo),
    admissionYearIdx: index("enrollment_profiles_admission_year_idx").on(table.admissionYear)
  })
);

export const assessmentSubmissions = mysqlTable(
  "assessment_submissions",
  {
    id: int("id").autoincrement().primaryKey(),
    studentId: int("student_id")
      .notNull()
      .references(() => students.id),
    questionSetVersion: varchar("question_set_version", { length: 32 }).notNull().default("v1"),
    answersJson: text("answers_json").notNull(),
    answerCount: int("answer_count").notNull(),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (table) => ({
    studentIdUnique: uniqueIndex("assessment_submissions_student_id_unique").on(table.studentId),
    submittedAtIdx: index("assessment_submissions_submitted_at_idx").on(table.submittedAt)
  })
);

export const reportGenerationJobs = mysqlTable(
  "report_generation_jobs",
  {
    id: int("id").autoincrement().primaryKey(),
    studentNo: varchar("student_no", { length: 32 }).notNull(),
    payloadJson: text("payload_json").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("done"),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    studentNoIdx: index("report_generation_jobs_student_no_idx").on(table.studentNo),
    createdAtIdx: index("report_generation_jobs_created_at_idx").on(table.createdAt)
  })
);

export const reports = mysqlTable(
  "reports",
  {
    id: int("id").autoincrement().primaryKey(),
    studentId: int("student_id")
      .notNull()
      .references(() => students.id),
    direction: mysqlEnum("direction", ["employment", "postgraduate", "civil_service"])
      .notNull()
      .default("employment"),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    studentIdIdx: index("reports_student_id_idx").on(table.studentId),
    directionIdx: index("reports_direction_idx").on(table.direction)
  })
);

export const tasks = mysqlTable(
  "tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    studentId: int("student_id")
      .notNull()
      .references(() => students.id),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    studentIdIdx: index("tasks_student_id_idx").on(table.studentId)
  })
);

export const certificates = mysqlTable(
  "certificates",
  {
    id: int("id").autoincrement().primaryKey(),
    studentId: int("student_id")
      .notNull()
      .references(() => students.id),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    studentIdIdx: index("certificates_student_id_idx").on(table.studentId)
  })
);

export const certificateFiles = mysqlTable(
  "certificate_files",
  {
    id: int("id").autoincrement().primaryKey(),
    fileId: varchar("file_id", { length: 64 }).notNull(),
    studentId: int("student_id")
      .notNull()
      .references(() => students.id),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    sizeBytes: int("size_bytes").notNull(),
    storagePath: varchar("storage_path", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    fileIdUnique: uniqueIndex("certificate_files_file_id_unique").on(table.fileId),
    studentIdIdx: index("certificate_files_student_id_idx").on(table.studentId),
    createdAtIdx: index("certificate_files_created_at_idx").on(table.createdAt)
  })
);

export const profiles = mysqlTable(
  "profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    studentId: int("student_id")
      .notNull()
      .references(() => students.id),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    studentIdIdx: index("profiles_student_id_idx").on(table.studentId)
  })
);

export const teacherStudentGrants = mysqlTable(
  "teacher_student_grants",
  {
    id: int("id").autoincrement().primaryKey(),
    teacherId: varchar("teacher_id", { length: 64 }).notNull(),
    studentId: int("student_id")
      .notNull()
      .references(() => students.id),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    teacherStudentUnique: uniqueIndex("teacher_student_grants_teacher_student_unique").on(
      table.teacherId,
      table.studentId
    ),
    teacherIdIdx: index("teacher_student_grants_teacher_id_idx").on(table.teacherId),
    studentIdIdx: index("teacher_student_grants_student_id_idx").on(table.studentId)
  })
);

export const teacherClassGrants = mysqlTable(
  "teacher_class_grants",
  {
    id: int("id").autoincrement().primaryKey(),
    teacherId: varchar("teacher_id", { length: 64 }).notNull(),
    classId: int("class_id")
      .notNull()
      .references(() => classes.id),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    teacherClassUnique: uniqueIndex("teacher_class_grants_teacher_class_unique").on(
      table.teacherId,
      table.classId
    ),
    teacherIdIdx: index("teacher_class_grants_teacher_id_idx").on(table.teacherId),
    classIdIdx: index("teacher_class_grants_class_id_idx").on(table.classId)
  })
);

export const activities = mysqlTable(
  "activities",
  {
    id: int("id").autoincrement().primaryKey(),
    activityType: mysqlEnum("activity_type", ["course", "competition", "project"]).notNull(),
    title: varchar("title", { length: 128 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    activityTypeIdx: index("activities_activity_type_idx").on(table.activityType)
  })
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    operator: varchar("operator", { length: 64 }).notNull(),
    action: mysqlEnum("action", [
      "authorization_grant",
      "authorization_revoke",
      "password_reset",
      "activity_publish"
    ]).notNull(),
    target: varchar("target", { length: 191 }).notNull(),
    detail: varchar("detail", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    actionIdx: index("audit_logs_action_idx").on(table.action),
    operatorIdx: index("audit_logs_operator_idx").on(table.operator),
    targetIdx: index("audit_logs_target_idx").on(table.target)
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
