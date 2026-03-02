CREATE TABLE `assessment_submissions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `student_id` int NOT NULL,
  `question_set_version` varchar(32) NOT NULL DEFAULT 'v1',
  `answers_json` text NOT NULL,
  `answer_count` int NOT NULL,
  `submitted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `assessment_submissions_id` PRIMARY KEY(`id`),
  CONSTRAINT `assessment_submissions_student_id_unique` UNIQUE(`student_id`)
);
--> statement-breakpoint
ALTER TABLE `assessment_submissions` ADD CONSTRAINT `assessment_submissions_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `assessment_submissions_submitted_at_idx` ON `assessment_submissions` (`submitted_at`);
