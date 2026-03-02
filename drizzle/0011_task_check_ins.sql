CREATE TABLE `task_check_ins` (
  `id` int AUTO_INCREMENT NOT NULL,
  `task_id` int NOT NULL,
  `student_id` int NOT NULL,
  `file_id` varchar(64),
  `note` varchar(255),
  `submitted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `task_check_ins_id` PRIMARY KEY(`id`),
  CONSTRAINT `task_check_ins_task_student_unique` UNIQUE(`task_id`,`student_id`)
);
--> statement-breakpoint
ALTER TABLE `task_check_ins` ADD CONSTRAINT `task_check_ins_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `task_check_ins` ADD CONSTRAINT `task_check_ins_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `task_check_ins_task_id_idx` ON `task_check_ins` (`task_id`);
--> statement-breakpoint
CREATE INDEX `task_check_ins_student_id_idx` ON `task_check_ins` (`student_id`);
