CREATE TABLE capture_links (token_hash TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
