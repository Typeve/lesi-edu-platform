import { int, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  studentNo: varchar("student_no", { length: 32 }).notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

