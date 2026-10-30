import { Hono } from "hono";
import { z } from "zod";
import { type Env, type Ctx, teacher, fail, input } from "./database";
export const classrooms = new Hono<Env>();
async function owned(c: Ctx) {
  const a = teacher(c);
  const room = await c.env.DB.prepare(
    "SELECT id,name FROM classrooms WHERE id=? AND teacher_id=?",
  )
    .bind(c.req.param("id"), a.id)
    .first<{ id: string; name: string }>();
  if (!room) fail(404, "הכיתה לא נמצאה");
  return room;
}
async function roster(c: Ctx, id: string) {
  return (
    await c.env.DB.prepare(
      "SELECT u.id,u.name FROM users u JOIN classroom_students cs ON cs.student_id=u.id WHERE cs.classroom_id=? ORDER BY u.name",
    )
      .bind(id)
      .all()
  ).results;
}
classrooms.get("/", async (c) => {
  const a = teacher(c);
  const rooms = (
    await c.env.DB.prepare(
      "SELECT id,name FROM classrooms WHERE teacher_id=? ORDER BY name",
    )
      .bind(a.id)
      .all<{ id: string; name: string }>()
  ).results;
  return c.json(
    await Promise.all(
      rooms.map(async (r) => ({ ...r, students: await roster(c, r.id) })),
    ),
  );
});
classrooms.post("/", async (c) => {
  const a = teacher(c),
    d = await input(c, z.object({ name: z.string().trim().min(1).max(80) })),
    id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO classrooms VALUES (?,?,?,?)")
    .bind(id, a.id, d.name, Date.now())
    .run();
  return c.json({ id, name: d.name, students: [] }, 201);
});
classrooms.post("/:id/students", async (c) => {
  const room = await owned(c),
    a = teacher(c);
  const d = await input(
    c,
    z.union([
      z.object({
        names: z.array(z.string().trim().min(1).max(80)).min(1).max(100),
        consent: z.literal(true),
      }),
      z.object({ studentIds: z.array(z.string()).min(1).max(100) }),
    ]),
  );
  const statements: D1PreparedStatement[] = [];
  if ("names" in d) {
    const entries = JSON.stringify(
      d.names.map((name) => ({ id: crypto.randomUUID(), name })),
    );
    statements.push(
      c.env.DB.prepare(
        "INSERT INTO users (id,role,name,teacher_id,consent_at) SELECT json_extract(value,'$.id'),'student',json_extract(value,'$.name'),?,? FROM json_each(?)",
      ).bind(a.id, Date.now(), entries),
      c.env.DB.prepare(
        "INSERT INTO classroom_students SELECT ?,json_extract(value,'$.id') FROM json_each(?)",
      ).bind(room.id, entries),
    );
  } else {
    const ids = [...new Set(d.studentIds)],
      entries = JSON.stringify(ids);
    const valid = await c.env.DB.prepare(
      "SELECT COUNT(*) AS count FROM users u JOIN json_each(?) j ON j.value=u.id WHERE u.teacher_id=? AND u.role='student'",
    )
      .bind(entries, a.id)
      .first<{ count: number }>();
    if (valid?.count !== ids.length) fail(404, "התלמיד לא נמצא");
    statements.push(
      c.env.DB.prepare(
        "INSERT OR IGNORE INTO classroom_students SELECT ?,u.id FROM users u JOIN json_each(?) j ON j.value=u.id WHERE u.teacher_id=? AND u.role='student'",
      ).bind(room.id, entries, a.id),
    );
  }
  await c.env.DB.batch(statements);
  return c.json({ ...room, students: await roster(c, room.id) }, 201);
});
classrooms.delete("/:id/students/:studentId", async (c) => {
  const room = await owned(c);
  await c.env.DB.prepare(
    "DELETE FROM classroom_students WHERE classroom_id=? AND student_id=?",
  )
    .bind(room.id, c.req.param("studentId"))
    .run();
  return c.json({ ok: true });
});
