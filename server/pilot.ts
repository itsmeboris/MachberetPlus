import { Hono } from "hono";
import { z } from "zod";
import { type Env, teacher, input, fail } from "./database";
import { summarize, type Observation } from "../src/features/pilot/metrics";
export const pilot = new Hono<Env>();
pilot.post("/observations", async (c) => {
  const a = teacher(c);
  const data = await input(
    c,
    z.object({
      studentId: z.string(),
      phase: z.enum(["baseline", "machberet"]),
      mode: z.enum(["touch", "keyboard", "gaze", "switch"]),
      interfaceAssists: z.number().int().min(0).max(1000),
      teachingAssists: z.number().int().min(0).max(1000),
      additionalApps: z.number().int().min(0).max(100),
      blocked: z.boolean(),
      preparationMs: z.number().min(0).max(86400000).optional(),
      markingMs: z.number().min(0).max(86400000).optional(),
    }),
  );
  if (
    !(await c.env.DB.prepare(
      "SELECT id FROM users WHERE id=? AND teacher_id=? AND consent_at>0",
    )
      .bind(data.studentId, a.id)
      .first())
  )
    fail(404, "התלמיד לא נמצא");
  await c.env.DB.prepare("INSERT INTO observations VALUES (?,?,?,?,?)")
    .bind(
      crypto.randomUUID(),
      data.studentId,
      a.id,
      Date.now(),
      JSON.stringify(data),
    )
    .run();
  return c.json({ ok: true }, 201);
});
pilot.get("/", async (c) => {
  const a = teacher(c);
  const observations = (
    await c.env.DB.prepare(
      "SELECT id,at,data FROM observations WHERE teacher_id=? ORDER BY at",
    )
      .bind(a.id)
      .all<{ id: string; at: number; data: string }>()
  ).results.map((r) => ({
    id: r.id,
    at: r.at,
    ...(JSON.parse(r.data) as Observation),
  }));
  const counts = await c.env.DB.prepare(
    "SELECT count(*) AS assigned, SUM(CASE WHEN status IN ('reviewed','parent_acknowledged') THEN 1 ELSE 0 END) AS reviewed FROM assignments WHERE teacher_id=? AND status!='draft'",
  )
    .bind(a.id)
    .first<{ assigned: number; reviewed: number }>();
  const shared = (
    await c.env.DB.prepare(
      "SELECT a.id,a.acknowledged_at,MIN(e.at) AS shared_at FROM assignments a JOIN events e ON e.assignment_id=a.id AND e.kind='shared' WHERE a.teacher_id=? GROUP BY a.id",
    )
      .bind(a.id)
      .all<{ id: string; acknowledged_at: number | null; shared_at: number }>()
  ).results;
  const eligible = shared.filter(
    (r) => r.acknowledged_at || r.shared_at <= Date.now() - 48 * 3600000,
  );
  const within = eligible.filter(
    (r) =>
      r.acknowledged_at !== null &&
      r.acknowledged_at - r.shared_at <= 48 * 3600000,
  );
  return c.json({
    observations,
    summary: summarize(observations),
    workflow: {
      assigned: counts?.assigned ?? 0,
      reviewed: counts?.reviewed ?? 0,
    },
    parents: {
      shared: shared.length,
      eligible: eligible.length,
      within48h: within.length,
      pendingWindow: shared.length - eligible.length,
    },
  });
});
