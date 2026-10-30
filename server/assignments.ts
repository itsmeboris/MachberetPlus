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
      ? "SELECT a.*,d.id AS prepared_distribution_id FROM assignments a LEFT JOIN distributions d ON d.assignment_id=a.id WHERE a.teacher_id=? ORDER BY a.updated_at DESC"
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
      classroomId: z.string().nullable().optional(),
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
  if (
    data.classroomId &&
    !(await c.env.DB.prepare(
      "SELECT id FROM classrooms WHERE id=? AND teacher_id=?",
    )
      .bind(data.classroomId, a.id)
      .first())
  )
    fail(404, "הכיתה לא נמצאה");
  const id = crypto.randomUUID(),
    now = Date.now();
  await c.env.DB.prepare(
    "INSERT INTO assignments (id,teacher_id,student_id,title,exercises,created_at,updated_at,classroom_id) VALUES (?,?,?,?,?,?,?,?)",
  )
    .bind(
      id,
      a.id,
      data.studentId,
      data.title,
      JSON.stringify(data.exercises),
      now,
      now,
      data.classroomId ?? null,
    )
    .run();
  return c.json(present(await assignment(c, id)), 201);
});
assignments.get("/:id", async (c) =>
  c.json(present(await assignment(c, c.req.param("id")))),
);
assignments.patch("/:id", async (c) => {
  const actor = teacher(c);
  const row = await assignment(c, c.req.param("id"));
  if (row.status !== "draft") fail(409, "אפשר לערוך רק טיוטה");
  const data = await input(
    c,
    z.object({
      title: z.string().trim().min(1).max(120).optional(),
      classroomId: z.string().nullable().optional(),
      exercises: exercises.optional(),
      confirmed: z.boolean().optional(),
      contentRevision: z.number().int().nonnegative(),
    }),
  );
  if (data.confirmed && !JSON.parse(row.exercises).length)
    fail(400, "יש להכין תרגילים לפני האישור");
  if (
    data.classroomId &&
    !(await c.env.DB.prepare(
      "SELECT id FROM classrooms WHERE id=? AND teacher_id=?",
    )
      .bind(data.classroomId, actor.id)
      .first())
  )
    fail(404, "הכיתה לא נמצאה");
  const result = await c.env.DB.prepare(
    "UPDATE assignments SET title=?,exercises=?,confirmed=?,updated_at=?,classroom_id=?,content_revision=content_revision+1 WHERE id=? AND status=? AND content_revision=?",
  )
    .bind(
      data.title ?? row.title,
      data.exercises ? JSON.stringify(data.exercises) : row.exercises,
      data.exercises ? 0 : Number(data.confirmed ?? !!row.confirmed),
      Date.now(),
      data.classroomId === undefined
        ? (row.classroom_id ?? null)
        : data.classroomId,
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

// A distribution snapshots both the roster and media in one atomic D1 batch.
// Copies keep per-student permissions and survive deletion of the preparation draft.
assignments.post("/:id/distribute", async (c) => {
  const actor = teacher(c),
    row = await assignment(c, c.req.param("id"));
  const data = await input(
    c,
    z.object({
      classroomId: z.string(),
      contentRevision: z.number().int().nonnegative(),
    }),
  );
  if (
    !(await c.env.DB.prepare(
      "SELECT id FROM classrooms WHERE id=? AND teacher_id=?",
    )
      .bind(data.classroomId, actor.id)
      .first())
  )
    fail(404, "הכיתה לא נמצאה");
  const summary = async () => {
    const d = await c.env.DB.prepare(
      "SELECT id,classroom_id,assignment_id,content_revision FROM distributions WHERE assignment_id=?",
    )
      .bind(row.id)
      .first<{
        id: string;
        classroom_id: string;
        assignment_id: string;
        content_revision: number;
      }>();
    if (!d) return null;
    if (
      d.classroom_id !== data.classroomId ||
      d.content_revision !== data.contentRevision
    )
      fail(409, "המשימה כבר נשלחה. יש להכין משימה חדשה לשליחה נוספת.");
    const items = (
      await c.env.DB.prepare(
        "SELECT id,student_id AS studentId FROM assignments WHERE distribution_id=? ORDER BY student_id",
      )
        .bind(d.id)
        .all()
    ).results;
    return {
      id: d.id,
      classroomId: d.classroom_id,
      assignmentId: d.assignment_id,
      assignments: items,
      count: items.length,
    };
  };
  const previous = await summary();
  if (previous) return c.json(previous);
  if (row.status !== "draft") fail(409, "אפשר לשלוח לכיתה רק טיוטה");
  if (!row.confirmed || !JSON.parse(row.exercises).length)
    fail(400, "יש לאשר את התרגילים לפני השליחה");
  if (row.content_revision !== data.contentRevision)
    fail(409, "הטיוטה השתנתה. יש לטעון אותה מחדש.");
  if (
    !(await c.env.DB.prepare(
      "SELECT student_id FROM classroom_students WHERE classroom_id=? LIMIT 1",
    )
      .bind(data.classroomId)
      .first())
  )
    fail(400, "יש להוסיף תלמידים לכיתה");
  const id = crypto.randomUUID(),
    now = Date.now();
  const statements = [
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO distributions SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM assignments WHERE id=? AND teacher_id=? AND status='draft' AND confirmed=1 AND content_revision=?)`,
    ).bind(
      id,
      data.classroomId,
      row.id,
      data.contentRevision,
      now,
      row.id,
      actor.id,
      data.contentRevision,
    ),
    c.env.DB.prepare(
      `INSERT INTO assignments (id,teacher_id,student_id,title,status,exercises,confirmed,created_at,updated_at,distribution_id,classroom_id) SELECT lower(hex(randomblob(16))),a.teacher_id,cs.student_id,a.title,'assigned',a.exercises,1,?,?,d.id,d.classroom_id FROM distributions d JOIN assignments a ON a.id=d.assignment_id JOIN classroom_students cs ON cs.classroom_id=d.classroom_id JOIN users u ON u.id=cs.student_id AND u.teacher_id=a.teacher_id WHERE d.id=?`,
    ).bind(now, now, id),
    c.env.DB.prepare(
      `INSERT INTO media (id,assignment_id,kind,mime,size,duration,question_id,complete,base_revision) SELECT child.id || '-' || m.kind,child.id,m.kind,m.mime,m.size,m.duration,m.question_id,1,0 FROM assignments child JOIN distributions d ON d.id=child.distribution_id JOIN assignments source ON source.id=d.assignment_id JOIN media m ON m.id IN (source.source_id,source.instructions_id) AND m.assignment_id=source.id AND m.complete=1 AND m.kind IN ('source','instructions') WHERE d.id=?`,
    ).bind(id),
    c.env.DB.prepare(
      `INSERT INTO media_chunks (media_id,part,data) SELECT child.id || '-' || m.kind,mc.part,mc.data FROM assignments child JOIN distributions d ON d.id=child.distribution_id JOIN assignments source ON source.id=d.assignment_id JOIN media m ON m.id IN (source.source_id,source.instructions_id) AND m.assignment_id=source.id AND m.complete=1 AND m.kind IN ('source','instructions') JOIN media_chunks mc ON mc.media_id=m.id WHERE d.id=?`,
    ).bind(id),
    c.env.DB.prepare(
      `UPDATE assignments SET source_id=(SELECT id FROM media WHERE assignment_id=assignments.id AND kind='source'),instructions_id=(SELECT id FROM media WHERE assignment_id=assignments.id AND kind='instructions') WHERE distribution_id=?`,
    ).bind(id),
  ];
  await c.env.DB.batch(statements);
  const result = await summary();
  if (!result) fail(409, "הטיוטה השתנתה. יש לטעון אותה מחדש.");
  return c.json(result, 201);
});
