ALTER TABLE `students` ADD `password_hash` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `students` ADD `must_change_password` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `students` ADD `password_updated_at` timestamp;