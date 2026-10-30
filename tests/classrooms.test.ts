import { afterAll, beforeAll, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import app from "../server/index";
const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: "classrooms",
        modules: true,
        script: 'export default {fetch(){return new Response("test")}}',
        d1Databases: ["DB"],
      },
    ],
  }),
);
let DB: D1Database,
  teacher = "",
  other = "";
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
  const raw = await response.text();
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    body = raw;
  }
  return {
    status: response.status,
    body,
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
  };
}
beforeAll(async () => {
  DB = (await mf.getD1Database("DB")) as unknown as D1Database;
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    for (const sql of readFileSync(`migrations/${file}`, "utf8")
      .split(";")
      .filter((s) => s.trim()))
      await DB.prepare(sql).run();
  for (const email of ["class@test.test", "other@test.test"]) {
    const r = await request(
      "/auth/register",
      "POST",
      {
        email,
        name: "Teacher",
        password: "long-classroom-password",
        consent: true,
      },
      "",
    );
    if (!teacher) teacher = r.cookie;
    else other = r.cookie;
  }
});
afterAll(() => mf.dispose());
it("distributes a confirmed draft atomically with isolated answers, durable media, ownership and idempotent roster snapshot", async () => {
  const room = await request("/classrooms", "POST", { name: "Class A" });
  expect(room.status).toBe(201);
  const roster = await request(`/classrooms/${room.body.id}/students`, "POST", {
    names: ["One", "Two"],
    consent: true,
  });
  expect(roster.status).toBe(201);
  expect(roster.body.students).toHaveLength(2);
  const [one, two] = roster.body.students;
  expect(
    (
      await request(
        `/classrooms/${room.body.id}/students`,
        "POST",
        { names: ["Intruder"], consent: true },
        other,
      )
    ).status,
  ).toBe(404);
  const draft = (
    await request("/assignments", "POST", {
      studentId: one.id,
      title: "Shared worksheet",
      exercises: [{ id: "q", kind: "text", prompt: "Question" }],
    })
  ).body;
  const source = (
    await request("/media", "POST", {
      assignmentId: draft.id,
      kind: "source",
      mime: "image/png",
      size: 3,
    })
  ).body;
  await request(`/media/${source.id}/chunks/0`, "PUT", { data: "YWJj" });
  await request(`/media/${source.id}/complete`, "POST", {});
  const audio = (
    await request("/media", "POST", {
      assignmentId: draft.id,
      kind: "instructions",
      mime: "audio/webm",
      size: 3,
      duration: 1,
    })
  ).body;
  await request(`/media/${audio.id}/chunks/0`, "PUT", { data: "YWJj" });
  await request(`/media/${audio.id}/complete`, "POST", {});
  const current = (await request(`/assignments/${draft.id}`)).body;
  expect(
    (
      await request(`/assignments/${draft.id}/distribute`, "POST", {
        classroomId: room.body.id,
        contentRevision: current.contentRevision,
      })
    ).status,
  ).toBe(400);
  const confirmed = (
    await request(`/assignments/${draft.id}`, "PATCH", {
      confirmed: true,
      contentRevision: current.contentRevision,
    })
  ).body;
  const payload = {
    classroomId: room.body.id,
    contentRevision: confirmed.contentRevision,
  };
  expect(
    (
      await request(
        `/assignments/${draft.id}/distribute`,
        "POST",
        payload,
        other,
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await request(`/assignments/${draft.id}/distribute`, "POST", {
        ...payload,
        contentRevision: 0,
      })
    ).status,
  ).toBe(409);
  const results = await Promise.all([
    request(`/assignments/${draft.id}/distribute`, "POST", payload),
    request(`/assignments/${draft.id}/distribute`, "POST", payload),
  ]);
  expect(results.every((r) => r.status === 200 || r.status === 201)).toBe(true);
  expect(results[0].body.id).toBe(results[1].body.id);
  const distribution = results[0].body;
  expect(distribution.count).toBe(2);
  await request(`/classrooms/${room.body.id}/students`, "POST", {
    names: ["Later"],
    consent: true,
  });
  expect(
    (await request(`/assignments/${draft.id}/distribute`, "POST", payload)).body
      .count,
  ).toBe(2);
  const oneAssignment = distribution.assignments.find(
    (a: any) => a.studentId === one.id,
  ).id;
  const twoAssignment = distribution.assignments.find(
    (a: any) => a.studentId === two.id,
  ).id;
  const pairing = (await request(`/students/${one.id}/pair`, "POST", {})).body;
  const student = (
    await request("/auth/student", "POST", { code: pairing.code }, "")
  ).cookie;
  expect(
    (await request(`/assignments/${twoAssignment}`, "GET", undefined, student))
      .status,
  ).toBe(404);
  expect(
    (
      await request(
        `/assignments/${oneAssignment}/answers`,
        "PUT",
        { revision: 0, answers: { q: { text: "Mine" } } },
        student,
      )
    ).status,
  ).toBe(200);
  expect((await request(`/assignments/${twoAssignment}`)).body.answers).toEqual(
    {},
  );
  const copy = (await request(`/assignments/${oneAssignment}`)).body;
  const peer = (await request(`/assignments/${twoAssignment}`)).body;
  expect(copy.sourceId).not.toBe(source.id);
  expect(copy.instructionsId).not.toBe(audio.id);
  expect(
    (await request(`/media/${copy.instructionsId}`, "GET", undefined, student))
      .body,
  ).toBe("abc");
  expect(
    (await request(`/media/${peer.sourceId}`, "GET", undefined, student))
      .status,
  ).toBe(404);
  await DB.prepare("UPDATE assignments SET status='reviewed' WHERE id=?")
    .bind(oneAssignment)
    .run();
  const parent = (
    await request(`/assignments/${oneAssignment}/parent-links`, "POST", {})
  ).body;
  expect(
    (
      await request(
        `/parent/${parent.token}/media/${copy.sourceId}`,
        "GET",
        undefined,
        "",
      )
    ).body,
  ).toBe("abc");
  expect(
    (
      await request(
        `/parent/${parent.token}/media/${peer.sourceId}`,
        "GET",
        undefined,
        "",
      )
    ).status,
  ).toBe(404);
  await request(`/assignments/${draft.id}`, "DELETE", {});
  expect(
    (await request(`/media/${copy.sourceId}`, "GET", undefined, student)).body,
  ).toBe("abc");
  await request(`/classrooms/${room.body.id}/students/${one.id}`, "DELETE", {});
  expect(
    (await request(`/assignments/${oneAssignment}`, "GET", undefined, student))
      .status,
  ).toBe(200);
});

it("keeps classrooms teacher-only and rejects foreign roster additions and distribution targets", async () => {
  const room = (await request("/classrooms", "POST", { name: "Private" })).body;
  const foreign = (
    await request(
      "/students",
      "POST",
      { name: "Foreign", consent: true },
      other,
    )
  ).body;
  expect(
    (
      await request(`/classrooms/${room.id}/students`, "POST", {
        studentIds: [foreign.id],
      })
    ).status,
  ).toBe(404);
  const student = (
    await request("/auth/student", "POST", { code: foreign.code }, "")
  ).cookie;
  expect((await request("/classrooms", "GET", undefined, student)).status).toBe(
    403,
  );
  expect((await request("/classrooms", "GET", undefined, other)).body).toEqual(
    [],
  );
  const owned = (
    await request("/students", "POST", { name: "Owned", consent: true })
  ).body;
  expect(
    (
      await request(`/classrooms/${room.id}/students`, "POST", {
        studentIds: [owned.id, owned.id],
      })
    ).body.students,
  ).toHaveLength(1);
  expect(
    (
      await request(
        `/classrooms/${room.id}/students/${owned.id}`,
        "DELETE",
        {},
        other,
      )
    ).status,
  ).toBe(404);
  const draft = (
    await request(
      "/assignments",
      "POST",
      {
        studentId: foreign.id,
        title: "Wrong target",
        exercises: [{ id: "q", kind: "text", prompt: "Q" }],
      },
      other,
    )
  ).body;
  expect(
    (
      await request(
        `/assignments/${draft.id}/distribute`,
        "POST",
        { classroomId: room.id, contentRevision: 0 },
        other,
      )
    ).status,
  ).toBe(404);
});
it("persists draft classroom selection, preserves omitted values, clears null, and rejects foreign classes", async () => {
  const room = (await request("/classrooms", "POST", { name: "Saved class" }))
    .body;
  const foreign = (
    await request("/classrooms", "POST", { name: "Other class" }, other)
  ).body;
  const student = (
    await request("/students", "POST", { name: "Draft owner", consent: true })
  ).body;
  const data = {
    studentId: student.id,
    title: "Saved draft",
    exercises: [],
    classroomId: room.id,
  };
  const created = await request("/assignments", "POST", data);
  expect(created.status).toBe(201);
  expect(
    (await request(`/assignments/${created.body.id}`)).body.classroomId,
  ).toBe(room.id);
  expect(
    (
      await request("/assignments", "POST", {
        ...data,
        classroomId: foreign.id,
      })
    ).status,
  ).toBe(404);
  const preserved = await request(`/assignments/${created.body.id}`, "PATCH", {
    title: "Renamed",
    contentRevision: 0,
  });
  expect(preserved.body.classroomId).toBe(room.id);
  expect(
    (
      await request(`/assignments/${created.body.id}`, "PATCH", {
        classroomId: foreign.id,
        contentRevision: 1,
      })
    ).status,
  ).toBe(404);
  const cleared = await request(`/assignments/${created.body.id}`, "PATCH", {
    classroomId: null,
    contentRevision: 1,
  });
  expect(cleared.body.classroomId).toBeNull();
  const restored = await request(`/assignments/${created.body.id}`, "PATCH", {
    classroomId: room.id,
    contentRevision: 2,
  });
  expect(restored.body.classroomId).toBe(room.id);
  expect(
    (await request(`/assignments/${created.body.id}`)).body.classroomId,
  ).toBe(room.id);
});
it("creates and distributes to thirty students within a constant query budget", async () => {
  const room = (
    await request("/classrooms", "POST", { name: "Thirty students" })
  ).body;
  const originalDB = DB;
  let queries = 0;
  DB = new Proxy(originalDB, {
    get(target, key) {
      const value = Reflect.get(target, key);
      if (key === "prepare")
        return (...args: any[]) => {
          queries++;
          return value.apply(target, args);
        };
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  try {
    const roster = await request(`/classrooms/${room.id}/students`, "POST", {
      names: Array.from({ length: 30 }, (_, i) => `Student ${i + 1}`),
      consent: true,
    });
    expect(roster.status).toBe(201);
    expect(roster.body.students).toHaveLength(30);
    expect(queries).toBeLessThan(15);
    const draft = (
      await request("/assignments", "POST", {
        studentId: roster.body.students[0].id,
        classroomId: room.id,
        title: "Class practice",
        exercises: [{ id: "q", kind: "text", prompt: "Question" }],
      })
    ).body;
    const confirmed = (
      await request(`/assignments/${draft.id}`, "PATCH", {
        confirmed: true,
        contentRevision: 0,
      })
    ).body;
    queries = 0;
    const sent = await request(`/assignments/${draft.id}/distribute`, "POST", {
      classroomId: room.id,
      contentRevision: confirmed.contentRevision,
    });
    expect(sent.status).toBe(201);
    expect(sent.body.count).toBe(30);
    expect(queries).toBeLessThan(20);
    const one = sent.body.assignments[0],
      peer = sent.body.assignments[1];
    const code = (await request(`/students/${one.studentId}/pair`, "POST", {}))
      .body.code;
    const cookie = (await request("/auth/student", "POST", { code }, ""))
      .cookie;
    expect(
      (await request(`/assignments/${peer.id}`, "GET", undefined, cookie))
        .status,
    ).toBe(404);
    const secondRoom = (
      await request("/classrooms", "POST", { name: "Existing thirty" })
    ).body;
    queries = 0;
    const added = await request(
      `/classrooms/${secondRoom.id}/students`,
      "POST",
      { studentIds: roster.body.students.map((s: any) => s.id) },
    );
    expect(added.body.students).toHaveLength(30);
    expect(queries).toBeLessThan(15);
  } finally {
    DB = originalDB;
  }
});
