CREATE TABLE `certificates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `certificates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teacher_class_grants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teacher_id` varchar(64) NOT NULL,
	`class_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `teacher_class_grants_id` PRIMARY KEY(`id`),
	CONSTRAINT `teacher_class_grants_teacher_class_unique` UNIQUE(`teacher_id`,`class_id`)
);
--> statement-breakpoint
CREATE TABLE `teacher_student_grants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teacher_id` varchar(64) NOT NULL,
	`student_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `teacher_student_grants_id` PRIMARY KEY(`id`),
	CONSTRAINT `teacher_student_grants_teacher_student_unique` UNIQUE(`teacher_id`,`student_id`)
);
--> statement-breakpoint
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacher_class_grants` ADD CONSTRAINT `teacher_class_grants_class_id_classes_id_fk` FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacher_student_grants` ADD CONSTRAINT `teacher_student_grants_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `certificates_student_id_idx` ON `certificates` (`student_id`);--> statement-breakpoint
CREATE INDEX `profiles_student_id_idx` ON `profiles` (`student_id`);--> statement-breakpoint
CREATE INDEX `reports_student_id_idx` ON `reports` (`student_id`);--> statement-breakpoint
CREATE INDEX `tasks_student_id_idx` ON `tasks` (`student_id`);--> statement-breakpoint
CREATE INDEX `teacher_class_grants_teacher_id_idx` ON `teacher_class_grants` (`teacher_id`);--> statement-breakpoint
CREATE INDEX `teacher_class_grants_class_id_idx` ON `teacher_class_grants` (`class_id`);--> statement-breakpoint
CREATE INDEX `teacher_student_grants_teacher_id_idx` ON `teacher_student_grants` (`teacher_id`);--> statement-breakpoint
CREATE INDEX `teacher_student_grants_student_id_idx` ON `teacher_student_grants` (`student_id`);