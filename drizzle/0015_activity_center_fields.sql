ALTER TABLE `activities`
  ADD `scope_type` enum('school','college','class') NOT NULL DEFAULT 'school',
  ADD `scope_target_id` int NOT NULL DEFAULT 0,
  ADD `owner_teacher_id` varchar(64) NOT NULL DEFAULT 'T-UNKNOWN',
  ADD `start_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD `end_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD `timeline_json` text,
  ADD `status` enum('draft','published','closed') NOT NULL DEFAULT 'published';

UPDATE `activities` SET `timeline_json` = '[]' WHERE `timeline_json` IS NULL;
ALTER TABLE `activities` MODIFY `timeline_json` text NOT NULL;

CREATE INDEX `activities_status_idx` ON `activities` (`status`);
CREATE INDEX `activities_owner_teacher_id_idx` ON `activities` (`owner_teacher_id`);
