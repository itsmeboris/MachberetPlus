CREATE TABLE student_focus (
 student_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_id TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 acknowledged_at INTEGER,
 ended_by TEXT
);
