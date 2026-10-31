import { Hono } from "hono";
import { z } from "zod";
import { type Env, type Ctx, teacher, fail, input } from "./database";
export const focus = new Hono<Env>();
type Row = {
  request_id: string;
  expires_at: number;
  acknowledged_at: number | null;
  ended_by: string | null;
};
function state(row: Row | null, serverNow = Date.now()) {
  return {
    active: !!row && row.expires_at > serverNow,
    requestId: row?.request_id ?? null,
    expiresAt: row?.expires_at ?? 0,
    acknowledgedAt: row?.acknowledged_at ?? null,
    endedBy: row?.ended_by ?? null,
    serverNow,
  };
}
function student(c: Ctx) {
  const actor = c.get("actor");
  if (actor.role !== "student") fail(403, "פעולה לתלמידים בלבד");
  return actor;
}
focus.get("/", async (c) => {
  const actor = student(c);
  return c.json(
    state(
      await c.env.DB.prepare("SELECT * FROM student_focus WHERE student_id=?")
        .bind(actor.id)
        .first<Row>(),
    ),
  );
});
for (const action of ["ack", "dismiss"] as const) {
  focus.post(`/${action}`, async (c) => {
    const actor = student(c),
      { requestId } = await input(
        c,
        z.object({ requestId: z.string().uuid() }),
      );
    const now = Date.now();
    const sql =
      action === "ack"
        ? "UPDATE student_focus SET acknowledged_at=COALESCE(acknowledged_at,?) WHERE student_id=? AND request_id=? AND expires_at>?"
        : "UPDATE student_focus SET expires_at=0,ended_by='student' WHERE student_id=? AND request_id=? AND expires_at>?";
    await c.env.DB.prepare(sql)
      .bind(
        ...(action === "ack"
          ? [now, actor.id, requestId, now]
          : [actor.id, requestId, now]),
      )
      .run();
    return c.json({ ok: true });
  });
}
focus.get("/classrooms/:id", async (c) => {
  const actor = teacher(c);
  if (
    !(await c.env.DB.prepare(
      "SELECT id FROM classrooms WHERE id=? AND teacher_id=?",
    )
      .bind(c.req.param("id"), actor.id)
      .first())
  )
    fail(404, "הכיתה לא נמצאה");
  const rows = await c.env.DB.prepare(
    "SELECT u.id,u.name,f.* FROM classroom_students cs JOIN users u ON u.id=cs.student_id LEFT JOIN student_focus f ON f.student_id=u.id WHERE cs.classroom_id=? AND u.teacher_id=? ORDER BY u.name",
  )
    .bind(c.req.param("id"), actor.id)
    .all<Row & { id: string; name: string }>();
  const now = Date.now();
  return c.json(
    rows.results.map((r) => ({ id: r.id, name: r.name, ...state(r, now) })),
  );
});
focus.put("/students/:id", async (c) => {
  const actor = teacher(c),
    id = c.req.param("id");
  if (
    !(await c.env.DB.prepare(
      "SELECT id FROM users WHERE id=? AND teacher_id=? AND role='student'",
    )
      .bind(id, actor.id)
      .first())
  )
    fail(404, "התלמיד לא נמצא");
  const data = await input(
    c,
    z.object({
      active: z.boolean(),
      seconds: z.number().int().min(60).max(600).optional(),
    }),
  );
  const row: Row = {
    request_id: crypto.randomUUID(),
    expires_at: data.active ? Date.now() + (data.seconds ?? 300) * 1000 : 0,
    acknowledged_at: null,
    ended_by: data.active ? null : "teacher",
  };
  await c.env.DB.prepare(
    "INSERT INTO student_focus (student_id,teacher_id,request_id,expires_at,acknowledged_at,ended_by) VALUES (?,?,?,?,NULL,?) ON CONFLICT(student_id) DO UPDATE SET teacher_id=excluded.teacher_id,request_id=excluded.request_id,expires_at=excluded.expires_at,acknowledged_at=NULL,ended_by=excluded.ended_by",
  )
    .bind(id, actor.id, row.request_id, row.expires_at, row.ended_by)
    .run();
  return c.json(state(row));
});
