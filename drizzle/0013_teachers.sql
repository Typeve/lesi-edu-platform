CREATE TABLE `teachers` (
  `id` int AUTO_INCREMENT NOT NULL,
  `teacher_id` varchar(64) NOT NULL,
  `name` varchar(64) NOT NULL,
  `account` varchar(64) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `teachers_id` PRIMARY KEY(`id`),
  CONSTRAINT `teachers_teacher_id_unique` UNIQUE(`teacher_id`),
  CONSTRAINT `teachers_account_unique` UNIQUE(`account`)
);
