CREATE TABLE `enrollment_profiles` (
  `id` int AUTO_INCREMENT NOT NULL,
  `student_no` varchar(32) NOT NULL,
  `name` varchar(64),
  `school_name` varchar(128),
  `major_name` varchar(128),
  `score` int,
  `admission_year` int,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `enrollment_profiles_id` PRIMARY KEY(`id`),
  CONSTRAINT `enrollment_profiles_student_no_unique` UNIQUE(`student_no`)
);
--> statement-breakpoint
CREATE INDEX `enrollment_profiles_student_no_idx` ON `enrollment_profiles` (`student_no`);
--> statement-breakpoint
CREATE INDEX `enrollment_profiles_admission_year_idx` ON `enrollment_profiles` (`admission_year`);
