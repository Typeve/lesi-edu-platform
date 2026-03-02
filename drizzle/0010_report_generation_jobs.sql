CREATE TABLE `report_generation_jobs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `student_no` varchar(32) NOT NULL,
  `payload_json` text NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'done',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `report_generation_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `report_generation_jobs_student_no_idx` ON `report_generation_jobs` (`student_no`);
--> statement-breakpoint
CREATE INDEX `report_generation_jobs_created_at_idx` ON `report_generation_jobs` (`created_at`);
