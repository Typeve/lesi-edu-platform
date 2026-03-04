CREATE TABLE `auth_scopes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scope_type` enum('school','college','class','student') NOT NULL,
	`school_id` int,
	`college_id` int,
	`class_id` int,
	`student_id` int,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `auth_scopes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `classes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`college_id` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `classes_id` PRIMARY KEY(`id`),
	CONSTRAINT `classes_college_id_name_unique` UNIQUE(`college_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `colleges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`school_id` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `colleges_id` PRIMARY KEY(`id`),
	CONSTRAINT `colleges_school_id_name_unique` UNIQUE(`school_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `role_scopes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role_id` int NOT NULL,
	`scope_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `role_scopes_id` PRIMARY KEY(`id`),
	CONSTRAINT `role_scopes_role_id_scope_id_unique` UNIQUE(`role_id`,`scope_id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` enum('student','teacher','admin') NOT NULL,
	`name` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `schools` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `schools_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`class_id` int NOT NULL,
	`student_no` varchar(32) NOT NULL,
	`name` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `students_id` PRIMARY KEY(`id`),
	CONSTRAINT `students_student_no_unique` UNIQUE(`student_no`)
);
--> statement-breakpoint
ALTER TABLE `auth_scopes` ADD CONSTRAINT `auth_scopes_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_scopes` ADD CONSTRAINT `auth_scopes_college_id_colleges_id_fk` FOREIGN KEY (`college_id`) REFERENCES `colleges`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_scopes` ADD CONSTRAINT `auth_scopes_class_id_classes_id_fk` FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_scopes` ADD CONSTRAINT `auth_scopes_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `classes` ADD CONSTRAINT `classes_college_id_colleges_id_fk` FOREIGN KEY (`college_id`) REFERENCES `colleges`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `colleges` ADD CONSTRAINT `colleges_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_scopes` ADD CONSTRAINT `role_scopes_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_scopes` ADD CONSTRAINT `role_scopes_scope_id_auth_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `auth_scopes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `students` ADD CONSTRAINT `students_class_id_classes_id_fk` FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `auth_scopes_school_id_idx` ON `auth_scopes` (`school_id`);--> statement-breakpoint
CREATE INDEX `auth_scopes_college_id_idx` ON `auth_scopes` (`college_id`);--> statement-breakpoint
CREATE INDEX `auth_scopes_class_id_idx` ON `auth_scopes` (`class_id`);--> statement-breakpoint
CREATE INDEX `auth_scopes_student_id_idx` ON `auth_scopes` (`student_id`);--> statement-breakpoint
CREATE INDEX `role_scopes_role_id_idx` ON `role_scopes` (`role_id`);--> statement-breakpoint
CREATE INDEX `role_scopes_scope_id_idx` ON `role_scopes` (`scope_id`);--> statement-breakpoint
CREATE INDEX `students_class_id_idx` ON `students` (`class_id`);
