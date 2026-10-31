import { afterAll, beforeAll, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import app from "../server/index";
const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: "focus",
        modules: true,
        script: 'export default {fetch(){return new Response("test")}}',
        d1Databases: ["DB"],
      },
    ],
  }),
);
let DB: D1Database,
  teacher = "",
  other = "",
  student = "",
  second = "",
  studentId = "",
  roomId = "";
async function request(
  path: string,
  method = "GET",
  data?: unknown,
  cookie = teacher,
) {
  const response = await app.request(
    `https://pilot.test/api${path}`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: "https://pilot.test",
        Cookie: cookie,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    },
    { DB },
  );
  return {
    status: response.status,
    body: (await response.json()) as any,
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
  };
}
beforeAll(async () => {
  DB = (await mf.getD1Database("DB")) as unknown as D1Database;
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    for (const sql of readFileSync(`migrations/${file}`, "utf8")
      .split(";")
      .filter((s) => s.trim()))
      await DB.prepare(sql).run();
  }
  for (const email of ["focus@example.test", "other@example.test"]) {
    const r = await request(
      "/auth/register",
      "POST",
      {
        email,
        name: "Teacher",
        password: "long-focus-password",
        consent: true,
      },
      "",
    );
    if (!teacher) teacher = r.cookie;
    else other = r.cookie;
  }
  const first = await request("/students", "POST", {
    name: "One",
    consent: true,
  });
  studentId = first.body.id;
  student = (
    await request("/auth/student", "POST", { code: first.body.code }, "")
  ).cookie;
  const next = await request("/students", "POST", {
    name: "Two",
    consent: true,
  });
  second = (
    await request("/auth/student", "POST", { code: next.body.code }, "")
  ).cookie;
  roomId = (await request("/classrooms", "POST", { name: "Room" })).body.id;
  await request(`/classrooms/${roomId}/students`, "POST", {
    studentIds: [studentId, next.body.id],
  });
});
afterAll(() => mf.dispose());
it("authorizes teacher focus requests and isolates students and classroom status", async () => {
  expect(
    (
      await request(
        `/focus/students/${studentId}`,
        "PUT",
        { active: true },
        other,
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await request(
        `/focus/students/${studentId}`,
        "PUT",
        { active: true },
        student,
      )
    ).status,
  ).toBe(403);
  expect(
    (await request(`/focus/classrooms/${roomId}`, "GET", undefined, other))
      .status,
  ).toBe(404);
  expect((await request("/focus", "GET", undefined, "")).status).toBe(401);
  const started = await request(`/focus/students/${studentId}`, "PUT", {
    active: true,
  });
  expect(started.status).toBe(200);
  const own = (await request("/focus", "GET", undefined, student)).body;
  expect(own.active).toBe(true);
  expect(own.expiresAt - own.serverNow).toBeGreaterThan(290000);
  expect((await request("/focus", "GET", undefined, second)).body.active).toBe(
    false,
  );
  await request("/focus/ack", "POST", { requestId: own.requestId }, student);
  const status = (await request(`/focus/classrooms/${roomId}`)).body;
  expect(
    status.find((s: any) => s.id === studentId).acknowledgedAt,
  ).toBeGreaterThan(0);
});
it("rejects stale dismiss/ack requests, bounds expiry, and leaves personal settings unchanged", async () => {
  const preferences = (await request("/preferences", "GET", undefined, student))
    .body;
  const old = (
    await request(`/focus/students/${studentId}`, "PUT", { active: true })
  ).body;
  const current = (
    await request(`/focus/students/${studentId}`, "PUT", { active: true })
  ).body;
  await request(
    "/focus/dismiss",
    "POST",
    { requestId: old.requestId },
    student,
  );
  await request("/focus/ack", "POST", { requestId: old.requestId }, student);
  const state = (await request("/focus", "GET", undefined, student)).body;
  expect(state.active).toBe(true);
  expect(state.requestId).toBe(current.requestId);
  expect(state.acknowledgedAt).toBeNull();
  expect(
    (
      await request(`/focus/students/${studentId}`, "PUT", {
        active: true,
        seconds: 999999,
      })
    ).status,
  ).toBe(400);
  await request(
    "/focus/dismiss",
    "POST",
    { requestId: current.requestId },
    student,
  );
  expect(
    (await request("/focus", "GET", undefined, student)).body,
  ).toMatchObject({ active: false, endedBy: "student" });
  expect(
    (await request("/preferences", "GET", undefined, student)).body,
  ).toEqual(preferences);
  await request(`/focus/students/${studentId}`, "PUT", { active: true });
  await DB.prepare("UPDATE student_focus SET expires_at=? WHERE student_id=?")
    .bind(Date.now() - 1, studentId)
    .run();
  expect((await request("/focus", "GET", undefined, student)).body.active).toBe(
    false,
  );
  await request(`/focus/students/${studentId}`, "PUT", { active: false });
  expect(
    (await request("/focus", "GET", undefined, student)).body.endedBy,
  ).toBe("teacher");
});
