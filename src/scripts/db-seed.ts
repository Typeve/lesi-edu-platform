import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "../db/client.js";
import {
  assessmentSubmissions,
  authScopes,
  classes,
  colleges,
  enrollmentProfiles,
  majors,
  profiles,
  reports,
  roles,
  roleScopes,
  schools,
  students,
  teacherClassGrants,
  teachers,
  teacherStudentGrants
} from "../db/schema.js";
import { bcryptPasswordHasher } from "../modules/auth/password.js";

const DEFAULT_PASSWORD = "111111";
const ADMIN_ACCOUNT = "admin";
const TEACHER_ACCOUNT = "t01";
const TEACHER_ID = "T-0001";
const SCHOOL_NAME = "星河大学";
const COLLEGE_NAME = "计算机学院";
const MAJOR_NAME = "软件工程";
const CLASS_NAME = "软件工程2401";
const PRIMARY_STUDENT_NO = "s01";
const SECONDARY_STUDENT_NO = "s02";

const STUDENT_SEEDS = [
  { studentNo: PRIMARY_STUDENT_NO, name: "张三", credentialNo: "110101200001011111" },
  { studentNo: SECONDARY_STUDENT_NO, name: "李四", credentialNo: "110101200002022222" },
  { studentNo: "s03", name: "王五", credentialNo: "110101200003033333" }
] as const;

const asInsertId = (inserted: unknown): number => {
  const insertRows = inserted as Array<{ insertId?: number | bigint }>;
  const rawInsertId = insertRows[0]?.insertId;
  if (typeof rawInsertId !== "number" && typeof rawInsertId !== "bigint") {
    throw new Error("无法解析 insertId");
  }
  return Number(rawInsertId);
};

const findSchoolId = async (name: string) => {
  const rows = await db.select({ id: schools.id }).from(schools).where(eq(schools.name, name)).limit(1);
  return rows[0]?.id ?? null;
};

const findCollegeId = async (options: { schoolId: number; name: string }) => {
  const rows = await db
    .select({ id: colleges.id })
    .from(colleges)
    .where(and(eq(colleges.schoolId, options.schoolId), eq(colleges.name, options.name)))
    .limit(1);
  return rows[0]?.id ?? null;
};

const findMajorId = async (options: { collegeId: number; name: string }) => {
  const rows = await db
    .select({ id: majors.id })
    .from(majors)
    .where(and(eq(majors.collegeId, options.collegeId), eq(majors.name, options.name)))
    .limit(1);
  return rows[0]?.id ?? null;
};

const findClassId = async (options: { collegeId: number; name: string }) => {
  const rows = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.collegeId, options.collegeId), eq(classes.name, options.name)))
    .limit(1);
  return rows[0]?.id ?? null;
};

const upsertOrganization = async () => {
  let schoolId = await findSchoolId(SCHOOL_NAME);
  if (!schoolId) {
    schoolId = asInsertId(await db.insert(schools).values({ name: SCHOOL_NAME }));
  }

  await db.insert(colleges).values({ schoolId, name: COLLEGE_NAME }).onDuplicateKeyUpdate({ set: { name: COLLEGE_NAME } });
  const collegeId = await findCollegeId({ schoolId, name: COLLEGE_NAME });
  if (!collegeId) {
    throw new Error("无法定位学院数据");
  }

  await db.insert(majors).values({ collegeId, name: MAJOR_NAME }).onDuplicateKeyUpdate({ set: { name: MAJOR_NAME } });
  const majorId = await findMajorId({ collegeId, name: MAJOR_NAME });
  if (!majorId) {
    throw new Error("无法定位专业数据");
  }

  await db.insert(classes).values({ collegeId, majorId, name: CLASS_NAME }).onDuplicateKeyUpdate({ set: { majorId } });
  const classId = await findClassId({ collegeId, name: CLASS_NAME });
  if (!classId) {
    throw new Error("无法定位班级数据");
  }

  return { schoolId, classId };
};

const upsertTeacher = async (passwordHash: string) => {
  await db.insert(teachers).values({
    teacherId: TEACHER_ID,
    name: "示例教师",
    account: TEACHER_ACCOUNT,
    passwordHash,
    status: "active"
  }).onDuplicateKeyUpdate({
    set: {
      name: "示例教师",
      passwordHash,
      status: "active"
    }
  });

  const rows = await db
    .select({ id: teachers.id, teacherId: teachers.teacherId })
    .from(teachers)
    .where(eq(teachers.account, TEACHER_ACCOUNT))
    .limit(1);
  if (!rows[0]) {
    throw new Error("无法定位教师账号");
  }
  return rows[0];
};

const upsertStudents = async (options: { classId: number; passwordHash: string; now: Date }) => {
  const studentIdByNo = new Map<string, number>();
  for (const item of STUDENT_SEEDS) {
    await db.insert(students).values({
      classId: options.classId,
      studentNo: item.studentNo,
      name: item.name,
      credentialNo: item.credentialNo,
      passwordHash: options.passwordHash,
      mustChangePassword: false,
      passwordUpdatedAt: options.now,
      firstLoginVerifiedAt: options.now
    }).onDuplicateKeyUpdate({
      set: {
        classId: options.classId,
        name: item.name,
        credentialNo: item.credentialNo,
        passwordHash: options.passwordHash,
        mustChangePassword: false,
        passwordUpdatedAt: options.now,
        firstLoginVerifiedAt: options.now
      }
    });

    const rows = await db.select({ id: students.id }).from(students).where(eq(students.studentNo, item.studentNo)).limit(1);
    if (!rows[0]) {
      throw new Error(`无法定位学生: ${item.studentNo}`);
    }

    studentIdByNo.set(item.studentNo, rows[0].id);
    await db.insert(enrollmentProfiles).values({
      studentNo: item.studentNo,
      name: item.name,
      schoolName: SCHOOL_NAME,
      majorName: MAJOR_NAME,
      score: 580,
      admissionYear: 2024,
      updatedAt: options.now
    }).onDuplicateKeyUpdate({
      set: {
        name: item.name,
        schoolName: SCHOOL_NAME,
        majorName: MAJOR_NAME,
        score: 580,
        admissionYear: 2024,
        updatedAt: options.now
      }
    });
  }
  return studentIdByNo;
};

const requireStudentId = (studentIdByNo: Map<string, number>, studentNo: string): number => {
  const studentId = studentIdByNo.get(studentNo);
  if (!studentId) {
    throw new Error(`缺少学生数据: ${studentNo}`);
  }
  return studentId;
};

const upsertRole = async (code: "student" | "teacher" | "admin", name: string) => {
  await db.insert(roles).values({ code, name }).onDuplicateKeyUpdate({ set: { name } });
  const rows = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, code)).limit(1);
  if (!rows[0]) {
    throw new Error(`无法定位角色: ${code}`);
  }
  return rows[0].id;
};

const findOrCreateScope = async (options: {
  scopeType: "school" | "class" | "student";
  schoolId?: number;
  classId?: number;
  studentId?: number;
}) => {
  const rows = await db
    .select({ id: authScopes.id })
    .from(authScopes)
    .where(
      options.scopeType === "school"
        ? and(eq(authScopes.scopeType, "school"), eq(authScopes.schoolId, options.schoolId ?? 0))
        : options.scopeType === "class"
          ? and(eq(authScopes.scopeType, "class"), eq(authScopes.classId, options.classId ?? 0))
          : and(eq(authScopes.scopeType, "student"), eq(authScopes.studentId, options.studentId ?? 0))
    )
    .limit(1);
  if (rows[0]) {
    return rows[0].id;
  }

  return asInsertId(await db.insert(authScopes).values(options));
};

const upsertRoleScopes = async (options: { schoolId: number; classId: number; primaryStudentId: number }) => {
  const roleStudentId = await upsertRole("student", "学生");
  const roleTeacherId = await upsertRole("teacher", "教师");
  const roleAdminId = await upsertRole("admin", "管理员");
  const schoolScopeId = await findOrCreateScope({ scopeType: "school", schoolId: options.schoolId });
  const classScopeId = await findOrCreateScope({ scopeType: "class", classId: options.classId });
  const studentScopeId = await findOrCreateScope({ scopeType: "student", studentId: options.primaryStudentId });

  await db.insert(roleScopes).values({ roleId: roleAdminId, scopeId: schoolScopeId }).onDuplicateKeyUpdate({ set: { roleId: roleAdminId } });
  await db.insert(roleScopes).values({ roleId: roleTeacherId, scopeId: classScopeId }).onDuplicateKeyUpdate({ set: { roleId: roleTeacherId } });
  await db.insert(roleScopes).values({ roleId: roleStudentId, scopeId: studentScopeId }).onDuplicateKeyUpdate({ set: { roleId: roleStudentId } });
};

const upsertPermissions = async (options: { classId: number; teacherId: string; primaryStudentId: number; secondaryStudentId: number }) => {
  await db.insert(teacherClassGrants).values({
    teacherId: options.teacherId,
    classId: options.classId,
    accessLevel: "manage"
  }).onDuplicateKeyUpdate({ set: { accessLevel: "manage" } });

  await db.insert(teacherStudentGrants).values({
    teacherId: options.teacherId,
    studentId: options.primaryStudentId,
    accessLevel: "manage"
  }).onDuplicateKeyUpdate({ set: { accessLevel: "manage" } });

  await db.insert(teacherStudentGrants).values({
    teacherId: options.teacherId,
    studentId: options.secondaryStudentId,
    accessLevel: "read"
  }).onDuplicateKeyUpdate({ set: { accessLevel: "read" } });
};

const replaceDerivedSeedData = async (options: { now: Date; primaryStudentId: number; secondaryStudentId: number }) => {
  const studentIds = [options.primaryStudentId, options.secondaryStudentId];
  await db.delete(profiles).where(inArray(profiles.studentId, studentIds));
  await db.insert(profiles).values([
    { studentId: options.primaryStudentId, createdAt: options.now },
    { studentId: options.secondaryStudentId, createdAt: options.now }
  ]);

  await db.delete(reports).where(inArray(reports.studentId, studentIds));
  await db.insert(reports).values([
    { studentId: options.primaryStudentId, direction: "employment", createdAt: options.now },
    { studentId: options.secondaryStudentId, direction: "postgraduate", createdAt: options.now }
  ]);

  await db.insert(assessmentSubmissions).values({
    studentId: options.primaryStudentId,
    questionSetVersion: "v1",
    answersJson: JSON.stringify({ q1: 5, q2: 4, q3: 5 }),
    answerCount: 3,
    submittedAt: options.now,
    updatedAt: options.now
  }).onDuplicateKeyUpdate({
    set: {
      answersJson: JSON.stringify({ q1: 5, q2: 4, q3: 5 }),
      answerCount: 3,
      submittedAt: options.now,
      updatedAt: options.now
    }
  });
};

const printSummary = () => {
  const studentAccounts = STUDENT_SEEDS.map((item) => item.studentNo).join(", ");
  console.log("种子数据写入完成（upsert）。");
  console.log(`管理员账号: ${ADMIN_ACCOUNT}`);
  console.log(`管理员密码: ${DEFAULT_PASSWORD}（请确保 .env 中 ADMIN_API_KEY=111111）`);
  console.log(`教师账号: ${TEACHER_ACCOUNT}`);
  console.log(`教师密码: ${DEFAULT_PASSWORD}`);
  console.log(`学生账号: ${studentAccounts}`);
  console.log(`学生密码: ${DEFAULT_PASSWORD}`);
};

const createSeed = async () => {
  const now = new Date();
  const passwordHash = await bcryptPasswordHasher.hash(DEFAULT_PASSWORD);
  const { schoolId, classId } = await upsertOrganization();
  const teacher = await upsertTeacher(passwordHash);
  const studentIdByNo = await upsertStudents({ classId, passwordHash, now });
  const primaryStudentId = requireStudentId(studentIdByNo, PRIMARY_STUDENT_NO);
  const secondaryStudentId = requireStudentId(studentIdByNo, SECONDARY_STUDENT_NO);

  await upsertRoleScopes({ schoolId, classId, primaryStudentId });
  await upsertPermissions({
    classId,
    teacherId: teacher.teacherId,
    primaryStudentId,
    secondaryStudentId
  });
  await replaceDerivedSeedData({ now, primaryStudentId, secondaryStudentId });
  printSummary();
};

createSeed()
  .catch((error) => {
    console.error("db:seed 执行失败:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
