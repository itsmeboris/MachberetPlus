import { Hono } from "hono";
import { type Env, type AssignmentRow, fail } from "./database";
import { hash } from "./auth";
import { media } from "./media";
async function draft(db: D1Database, token: string) {
  const row = await db
    .prepare(
      "SELECT a.* FROM assignments a JOIN capture_links t ON t.assignment_id=a.id WHERE t.token_hash=? AND t.revoked=0 AND t.expires_at>? AND a.status='draft'",
    )
    .bind(await hash(token), Date.now())
    .first<AssignmentRow>();
  if (!row) fail(404, "קישור הצילום אינו זמין. בקשו קישור חדש מהמורה.");
  return row;
}
export const capture = new Hono<Env>();
capture.get("/:token", async (c) => {
  const a = await draft(c.env.DB, c.req.param("token"));
  return c.json({ id: a.id, title: a.title, sourceId: a.source_id });
});
capture.use("/:token/*", async (c, next) => {
  const a = await draft(c.env.DB, c.req.param("token"));
  // This capability exposes only this draft's source media router, never teacher routes.
  const match = c.req.path.match(/\/media\/([^/]+)/);
  if (match) {
    const m = await c.env.DB.prepare(
      "SELECT id FROM media WHERE id=? AND assignment_id=? AND kind=?",
    )
      .bind(match[1], a.id, "source")
      .first();
    if (!m) fail(404, "הקובץ אינו שייך לקישור");
  } else if (c.req.method === "POST" && c.req.path.endsWith("/media")) {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      fail(400, "נתונים לא תקינים");
    }
    if (body.assignmentId !== a.id || body.kind !== "source")
      fail(403, "הקישור מאפשר צילום דף זה בלבד");
  } else fail(404, "לא נמצא");
  c.set("actor", {
    id: a.teacher_id,
    role: "teacher",
    name: "",
    teacher_id: null,
    preferences: "{}",
  });
  await next();
});
capture.route("/:token/media", media);
