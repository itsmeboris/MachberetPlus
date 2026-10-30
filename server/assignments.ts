import { Hono } from "hono";
import { z } from "zod";
import {
  type Env,
  type AssignmentRow,
  assignment,
  present,
  teacher,
  fail,
  input,
  event,
} from "./database";
import { hash, randomToken } from "./auth";
export const exercise = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["text", "arithmetic", "vertical", "fraction", "equation"]),
  prompt: z.string().max(4000),
  math: z.string().max(1000).default(""),
  spokenText: z.string().max(5000).default(""),
  operands: z.array(z.string().max(12)).max(3).optional(),
});
const exercises = z
  .array(exercise)
  .min(1)
  .max(50)
  .refine((es) => new Set(es.map((e) => e.id)).size === es.length);
const answer = z.object({
  text: z.string().max(5000).default(""),
  cells: z.record(z.string(), z.string().max(20)).optional(),
});
export const assignments = new Hono<Env>();
assignments.get("/", async (c) => {
  const a = c.get("actor");
  const sql =
    a.role === "teacher"
      ? "SELECT * FROM assignments WHERE teacher_id=? ORDER BY updated_at DESC"
      : "SELECT * FROM assignments WHERE student_id=? AND status != 'draft' ORDER BY created_at";
  return c.json(
    (await c.env.DB.prepare(sql).bind(a.id).all<AssignmentRow>()).results.map(
      present,
    ),
  );
});
assignments.post("/", async (c) => {
  const a = teacher(c);
  const data = await input(
    c,
    z.object({
      studentId: z.string(),
      title: z.string().trim().min(1).max(120),
      exercises: z
        .array(exercise)
        .max(50)
        .refine((es) => new Set(es.map((e) => e.id)).size === es.length),
    }),
  );
  if (
    !(await c.env.DB.prepare("SELECT id FROM users WHERE id=? AND teacher_id=?")
      .bind(data.studentId, a.id)
      .first())
  )
    fail(404, "התלמיד לא נמצא");
  const id = crypto.randomUUID(),
    now = Date.now();
  await c.env.DB.prepare(
    "INSERT INTO assignments (id,teacher_id,student_id,title,exercises,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
  )
    .bind(
      id,
      a.id,
      data.studentId,
      data.title,
      JSON.stringify(data.exercises),
      now,
      now,
    )
    .run();
  return c.json(present(await assignment(c, id)), 201);
});
assignments.get("/:id", async (c) =>
  c.json(present(await assignment(c, c.req.param("id")))),
);
assignments.patch("/:id", async (c) => {
  teacher(c);
  const row = await assignment(c, c.req.param("id"));
  if (row.status !== "draft") fail(409, "אפשר לערוך רק טיוטה");
  const data = await input(
    c,
    z.object({
      title: z.string().trim().min(1).max(120).optional(),
      exercises: exercises.optional(),
      confirmed: z.boolean().optional(),
      contentRevision: z.number().int().nonnegative(),
    }),
  );
  if (data.confirmed && !JSON.parse(row.exercises).length)
    fail(400, "יש להכין תרגילים לפני האישור");
  const result = await c.env.DB.prepare(
    "UPDATE assignments SET title=?,exercises=?,confirmed=?,updated_at=?,content_revision=content_revision+1 WHERE id=? AND status=? AND content_revision=?",
  )
    .bind(
      data.title ?? row.title,
      data.exercises ? JSON.stringify(data.exercises) : row.exercises,
      data.exercises ? 0 : Number(data.confirmed ?? !!row.confirmed),
      Date.now(),
      row.id,
      "draft",
      data.contentRevision,
    )
    .run();
  if (!result.meta.changes)
    fail(409, "הטיוטה השתנתה. יש לטעון אותה שוב לפני אישור.");
  return c.json(present(await assignment(c, row.id)));
});
assignments.put("/:id/answers", async (c) => {
  if (c.get("actor").role !== "student")
    fail(403, "תשובות נכתבות על ידי התלמיד");
  const row = await assignment(c, c.req.param("id"));
  const data = await input(
    c,
    z.object({
      revision: z.number().int().nonnegative(),
      answers: z.record(z.string(), answer),
    }),
  );
  const ids = new Set(
    JSON.parse(row.exercises).map((e: { id: string }) => e.id),
  );
  if (Object.keys(data.answers).some((id) => !ids.has(id)))
    fail(400, "שאלה לא מוכרת");
  const result = await c.env.DB.prepare(
    "UPDATE assignments SET answers=?,revision=revision+1,status='in_progress',updated_at=? WHERE id=? AND revision=? AND status IN ('assigned','in_progress','returned')",
  )
    .bind(JSON.stringify(data.answers), Date.now(), row.id, data.revision)
    .run();
  if (!result.meta.changes)
    fail(409, "העבודה השתנתה או הוגשה. יש לטעון את הגרסה השמורה.");
  return c.json({ revision: data.revision + 1, savedAt: Date.now() });
});
assignments.post("/:id/transition", async (c) => {
  const row = await assignment(c, c.req.param("id"));
  const { action, contentRevision, revision } = await input(
    c,
    z.object({
      action: z.enum(["assign", "submit", "return", "review"]),
      contentRevision: z.number().int().nonnegative().optional(),
      revision: z.number().int().nonnegative().optional(),
    }),
  );
  const actor = c.get("actor");
  if ((action === "submit") !== (actor.role === "student"))
    fail(403, "אין הרשאה לפעולה");
  const valid: Record<string, string[]> = {
    assign: ["draft"],
    submit: ["assigned", "in_progress", "returned"],
    return: ["submitted"],
    review: ["submitted"],
  };
  if (!valid[action].includes(row.status))
    fail(409, "הפעולה אינה זמינה בשלב זה");
  if (action === "assign" && !row.confirmed)
    fail(400, "יש לאשר את התרגילים לפני השליחה");
  if (
    (action === "submit" && revision === undefined) ||
    (action !== "submit" && contentRevision === undefined)
  )
    fail(400, "נדרשת הגרסה שנבדקה");
  const status = {
    assign: "assigned",
    submit: "submitted",
    return: "returned",
    review: "reviewed",
  }[action];
  const result = await c.env.DB.prepare(
    "UPDATE assignments SET status=?,updated_at=? WHERE id=? AND status=? AND content_revision=? AND revision=? AND (? != 'assign' OR confirmed=1)",
  )
    .bind(
      status,
      Date.now(),
      row.id,
      row.status,
      action === "submit" ? row.content_revision : contentRevision,
      action === "submit" ? revision : row.revision,
      action,
    )
    .run();
  if (!result.meta.changes) fail(409, "המשימה השתנתה. נסו שוב.");
  await event(c.env.DB, row.id, status).run();
  return c.json(present(await assignment(c, row.id)));
});
assignments.put("/:id/review", async (c) => {
  teacher(c);
  const row = await assignment(c, c.req.param("id"));
  if (row.status !== "submitted") fail(409, "אפשר לבדוק עבודה שהוגשה");
  const data = await input(
    c,
    z.object({
      contentRevision: z.number().int().nonnegative(),
      feedback: z.record(
        z.string(),
        z.object({
          sticker: z.enum(["star", "heart", "effort"]).optional(),
          text: z.string().max(2000).default(""),
          decision: z.enum(["reviewed", "retry"]).optional(),
          audioId: z.string().optional(),
        }),
      ),
    }),
  );
  const ids = new Set(
    JSON.parse(row.exercises).map((e: { id: string }) => e.id),
  );
  if (Object.keys(data.feedback).some((id) => !ids.has(id)))
    fail(400, "שאלה לא מוכרת");
  for (const [questionId, feedback] of Object.entries(data.feedback)) {
    if (
      feedback.audioId &&
      !(await c.env.DB.prepare(
        "SELECT id FROM media WHERE id=? AND assignment_id=? AND question_id=? AND kind=? AND complete=1",
      )
        .bind(feedback.audioId, row.id, questionId, "feedback")
        .first())
    )
      fail(400, "הקלטה לא תקינה");
  }
  const result = await c.env.DB.prepare(
    "UPDATE assignments SET feedback=?,updated_at=?,content_revision=content_revision+1 WHERE id=? AND status=? AND content_revision=?",
  )
    .bind(
      JSON.stringify(data.feedback),
      Date.now(),
      row.id,
      "submitted",
      data.contentRevision,
    )
    .run();
  if (!result.meta.changes)
    fail(409, "המשוב או מצב המשימה השתנו. יש לטעון מחדש.");
  return c.json({ ok: true, contentRevision: data.contentRevision + 1 });
});
assignments.post("/:id/parent-links", async (c) => {
  teacher(c);
  const row = await assignment(c, c.req.param("id"));
  if (!["reviewed", "parent_acknowledged"].includes(row.status))
    fail(409, "יש להשלים את הבדיקה לפני השיתוף");
  const token = randomToken(),
    expiresAt = Date.now() + 7 * 86400000;
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO parent_links VALUES (?,?,?,0)").bind(
      await hash(token),
      row.id,
      expiresAt,
    ),
    event(c.env.DB, row.id, "shared"),
  ]);
  return c.json({ token, expiresAt }, 201);
});
assignments.delete("/:id/parent-links", async (c) => {
  teacher(c);
  const row = await assignment(c, c.req.param("id"));
  await c.env.DB.prepare(
    "UPDATE parent_links SET revoked=1 WHERE assignment_id=?",
  )
    .bind(row.id)
    .run();
  return c.json({ ok: true });
});
assignments.post("/:id/capture-links", async (c) => {
  teacher(c);
  const row = await assignment(c, c.req.param("id"));
  if (row.status !== "draft") fail(409, "אפשר לבקש צילום רק לטיוטה");
  const token = randomToken(),
    expiresAt = Date.now() + 86400000;
  await c.env.DB.prepare("INSERT INTO capture_links VALUES (?,?,?,0)")
    .bind(await hash(token), row.id, expiresAt)
    .run();
  return c.json({ token, expiresAt }, 201);
});
assignments.delete("/:id/capture-links", async (c) => {
  teacher(c);
  const row = await assignment(c, c.req.param("id"));
  await c.env.DB.prepare(
    "UPDATE capture_links SET revoked=1 WHERE assignment_id=?",
  )
    .bind(row.id)
    .run();
  return c.json({ ok: true });
});
assignments.delete("/:id", async (c) => {
  teacher(c);
  const row = await assignment(c, c.req.param("id"));
  await c.env.DB.prepare("DELETE FROM assignments WHERE id=?")
    .bind(row.id)
    .run();
  return c.json({ ok: true });
});
export const parent = new Hono<Env>();
export async function parentAssignment(db: D1Database, token: string) {
  const row = await db
    .prepare(
      "SELECT a.* FROM assignments a JOIN parent_links p ON a.id=p.assignment_id WHERE p.token_hash=? AND p.expires_at>? AND p.revoked=0 AND a.status IN ('reviewed','parent_acknowledged')",
    )
    .bind(await hash(token), Date.now())
    .first<AssignmentRow>();
  if (!row) fail(404, "הקישור פג או אינו זמין. בקשו קישור חדש מהמורה.");
  return row;
}
parent.get("/:token", async (c) => {
  const row = await parentAssignment(c.env.DB, c.req.param("token"));
  const { studentId, ...safe } = present(row);
  return c.json(safe);
});
parent.post("/:token/acknowledge", async (c) => {
  const row = await parentAssignment(c.env.DB, c.req.param("token"));
  await c.env.DB.prepare(
    "UPDATE assignments SET acknowledged_at=COALESCE(acknowledged_at,?),status='parent_acknowledged',updated_at=? WHERE id=?",
  )
    .bind(Date.now(), Date.now(), row.id)
    .run();
  const saved = await c.env.DB.prepare(
    "SELECT acknowledged_at FROM assignments WHERE id=?",
  )
    .bind(row.id)
    .first<{ acknowledged_at: number }>();
  return c.json({ acknowledgedAt: saved!.acknowledged_at });
});
