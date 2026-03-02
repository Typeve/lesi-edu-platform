ALTER TABLE `teacher_student_grants`
  ADD `access_level` enum('read','manage') NOT NULL DEFAULT 'read';

ALTER TABLE `teacher_class_grants`
  ADD `access_level` enum('read','manage') NOT NULL DEFAULT 'read';
