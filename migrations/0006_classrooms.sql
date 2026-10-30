CREATE TABLE classrooms (id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE classroom_students (classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE, student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(classroom_id,student_id));
CREATE TABLE distributions (id TEXT PRIMARY KEY, classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE, assignment_id TEXT UNIQUE REFERENCES assignments(id) ON DELETE SET NULL, content_revision INTEGER NOT NULL, created_at INTEGER NOT NULL);
ALTER TABLE assignments ADD COLUMN distribution_id TEXT REFERENCES distributions(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN classroom_id TEXT REFERENCES classrooms(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX assignment_distribution_student ON assignments(distribution_id,student_id);
CREATE INDEX classrooms_teacher ON classrooms(teacher_id);
