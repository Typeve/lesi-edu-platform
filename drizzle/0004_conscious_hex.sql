CREATE TABLE `activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`activity_type` enum('course','competition','project') NOT NULL,
	`title` varchar(128) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`operator` varchar(64) NOT NULL,
	`action` enum('authorization_grant','authorization_revoke','password_reset','activity_publish') NOT NULL,
	`target` varchar(191) NOT NULL,
	`detail` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `activities_activity_type_idx` ON `activities` (`activity_type`);--> statement-breakpoint
CREATE INDEX `audit_logs_action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `audit_logs_operator_idx` ON `audit_logs` (`operator`);--> statement-breakpoint
CREATE INDEX `audit_logs_target_idx` ON `audit_logs` (`target`);