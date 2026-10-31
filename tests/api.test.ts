import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import app from "../server/index";

const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: "test",
        modules: true,
        script: 'export default {fetch(){return new Response("test")}}',
        d1Databases: ["DB"],
      },
    ],
  }),
);
let DB: D1Database;
let teacher = "",
  other = "",
  student = "",
  studentId = "",
  assignmentId = "",
  parentToken = "";
let mediaId = "";
async function request(
  path: string,
  method = "GET",
  data?: unknown,
  cookie = teacher,
  headers: Record<string, string> = {},
) {
  // Sequential fixtures behave like a client that has just loaded the resource.
  // Race tests pass explicit revisions so stale versions remain stale.
  if (
    data &&
    typeof data === "object" &&
    (method === "PATCH" ||
      path.endsWith("/review") ||
      path.endsWith("/transition"))
  ) {
    const id = path.split("/")[2];
    const current = await request(
      `/assignments/${id}`,
      "GET",
      undefined,
      cookie,
    );
    data = {
      contentRevision: current.body.contentRevision,
      revision: current.body.revision,
      ...data,
    };
  }
  const response = await app.request(
    `https://pilot.test/api${path}`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: "https://pilot.test",
        Cookie: cookie,
        ...headers,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    },
    { DB },
  );
  const text = await response.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return {
    status: response.status,
    body,
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
  };
}
beforeAll(async () => {
  DB = (await mf.getD1Database("DB")) as unknown as D1Database;
  if (existsSync("migrations/0001_initial.sql")) {
    for (const file of readdirSync("migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort())
      for (const sql of readFileSync(`migrations/${file}`, "utf8")
        .split(";")
        .filter((s) => s.trim()))
        await DB.prepare(sql).run();
  }
});
afterAll(() => mf.dispose());
describe("persisted authorized worksheet lifecycle", () => {
  it("creates a consenting teacher account and rejects duplicate registration", async () => {
    const account = {
      email: "teacher@example.test",
      password: "long-password-for-pilot",
      name: "מורה",
      consent: true,
    };
    const result = await request("/auth/register", "POST", account, "");
    expect(result.status).toBe(201);
    teacher = result.cookie;
    expect(teacher).toContain("session=");
    expect((await request("/auth/register", "POST", account, "")).status).toBe(
      409,
    );
    other = (
      await request(
        "/auth/register",
        "POST",
        { ...account, email: "other@example.test" },
        "",
      )
    ).cookie;
  });
  it("rejects unconsented signup, invalid login and cross-origin mutations", async () => {
    expect(
      (
        await request(
          "/auth/register",
          "POST",
          {
            email: "no@example.test",
            password: "long-password-for-pilot",
            name: "No",
            consent: false,
          },
          "",
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          "/auth/login",
          "POST",
          { email: "teacher@example.test", password: "wrong" },
          "",
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await request(
          "/students",
          "POST",
          { name: "תלמיד", consent: true },
          teacher,
          { Origin: "https://evil.test" },
        )
      ).status,
    ).toBe(403);
  });
  it("pairs a protected student session and reuses an unexpired link", async () => {
    const created = await request("/students", "POST", {
      name: "תלמיד",
      consent: true,
    });
    expect(created.status).toBe(201);
    studentId = created.body.id;
    const joined = await request(
      "/auth/student",
      "POST",
      { code: created.body.code },
      "",
    );
    expect(joined.status).toBe(200);
    student = joined.cookie;
    expect(
      (await request("/auth/student", "POST", { code: created.body.code }, ""))
        .status,
    ).toBe(200);
    expect((await request("/students", "GET", undefined, other)).body).toEqual(
      [],
    );
  });
  it("rejects expired, replaced and explicitly revoked links", async () => {
    const created = await request("/students", "POST", {
      name: "קישור לבדיקה",
      consent: true,
    });
    await DB.prepare("UPDATE pairing_codes SET expires_at=? WHERE student_id=?")
      .bind(Date.now() - 1, created.body.id)
      .run();
    expect(
      (await request("/auth/student", "POST", { code: created.body.code }, ""))
        .status,
    ).toBe(401);
    const first = await request(
      `/students/${created.body.id}/pair`,
      "POST",
      {},
    );
    const second = await request(
      `/students/${created.body.id}/pair`,
      "POST",
      {},
    );
    expect(
      (await request("/auth/student", "POST", { code: first.body.code }, ""))
        .status,
    ).toBe(401);
    expect(
      (await request("/auth/student", "POST", { code: second.body.code }, ""))
        .status,
    ).toBe(200);
    expect(
      (
        await request(
          `/students/${created.body.id}/pairing`,
          "DELETE",
          {},
          other,
        )
      ).status,
    ).toBe(404);
    expect(
      (await request("/auth/student", "POST", { code: second.body.code }, ""))
        .status,
    ).toBe(200);
    expect(
      (await request(`/students/${created.body.id}/pairing`, "DELETE", {}))
        .status,
    ).toBe(200);
    expect(
      (await request("/auth/student", "POST", { code: second.body.code }, ""))
        .status,
    ).toBe(401);
    await request(`/students/${created.body.id}`, "DELETE", {});
  });
  it("requires confirmed exercises before assignment and blocks another teacher", async () => {
    const result = await request("/assignments", "POST", {
      studentId,
      title: "חיבור",
      exercises: [
        {
          id: "q1",
          kind: "arithmetic",
          prompt: "פתרו",
          math: "12 + 3",
          spokenText: "שתים עשרה ועוד שלוש",
        },
      ],
    });
    expect(result.status).toBe(201);
    assignmentId = result.body.id;
    expect(
      (await request(`/assignments/${assignmentId}`, "GET", undefined, other))
        .status,
    ).toBe(404);
    expect(
      (
        await request(`/assignments/${assignmentId}/transition`, "POST", {
          action: "assign",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(`/assignments/${assignmentId}`, "PATCH", {
          confirmed: true,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(`/assignments/${assignmentId}/transition`, "POST", {
          action: "assign",
        })
      ).body.status,
    ).toBe("assigned");
    expect(
      (
        await request(
          `/assignments/${assignmentId}`,
          "PATCH",
          { title: "hijack" },
          other,
        )
      ).status,
    ).toBe(404);
  });
  it("persists revisioned answers and rejects stale saves and premature parent sharing", async () => {
    expect(
      (await request(`/assignments/${assignmentId}/parent-links`, "POST", {}))
        .status,
    ).toBe(409);
    const result = await request(
      `/assignments/${assignmentId}/answers`,
      "PUT",
      { revision: 0, answers: { q1: { text: "15" } } },
      student,
    );
    expect(result.status).toBe(200);
    expect(result.body.revision).toBe(1);
    expect(
      (
        await request(
          `/assignments/${assignmentId}/answers`,
          "PUT",
          { revision: 0, answers: { q1: { text: "14" } } },
          student,
        )
      ).status,
    ).toBe(409);
    const saved = await request(
      `/assignments/${assignmentId}`,
      "GET",
      undefined,
      student,
    );
    expect(saved.body.answers.q1.text).toBe("15");
    expect(saved.body.status).toBe("in_progress");
    expect(
      (
        await request(
          `/assignments/${assignmentId}/answers`,
          "PUT",
          { revision: 1, answers: { q1: { text: "wrong" } } },
          other,
        )
      ).status,
    ).toBe(403);
  });
  it("stores bounded private media and rejects incomplete or foreign uploads", async () => {
    const create = await request("/media", "POST", {
      assignmentId,
      kind: "instructions",
      mime: "audio/webm",
      size: 4,
      duration: 3,
    });
    expect(create.status).toBe(201);
    mediaId = create.body.id;
    expect(
      (await request(`/media/${mediaId}/complete`, "POST", {})).status,
    ).toBe(409);
    expect(
      (
        await request(
          `/media/${mediaId}/chunks/0`,
          "PUT",
          { data: "AQIDBA==" },
          other,
        )
      ).status,
    ).toBe(404);
    expect(
      (await request(`/media/${mediaId}/chunks/0`, "PUT", { data: "AQIDBA==" }))
        .status,
    ).toBe(200);
    expect(
      (await request(`/media/${mediaId}/complete`, "POST", {})).status,
    ).toBe(200);
    expect(
      (await request(`/assignments/${assignmentId}`)).body.instructionsId,
    ).toBe(mediaId);
    const file = await app.request(
      `https://pilot.test/api/media/${mediaId}`,
      { headers: { Cookie: student } },
      { DB },
    );
    expect(file.status).toBe(200);
    expect([...new Uint8Array(await file.arrayBuffer())]).toEqual([1, 2, 3, 4]);
    expect(
      (await request(`/media/${mediaId}`, "GET", undefined, other)).status,
    ).toBe(404);
    expect(
      (
        await request("/media", "POST", {
          assignmentId,
          kind: "feedback",
          mime: "audio/webm",
          size: 4,
          duration: 16,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request("/media", "POST", {
          assignmentId,
          kind: "source",
          mime: "text/html",
          size: 4,
        })
      ).status,
    ).toBe(400);
  });
  it("returns and resubmits work before a teacher reviews it", async () => {
    expect(
      (
        await request(
          `/assignments/${assignmentId}/transition`,
          "POST",
          { action: "review" },
          student,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          `/assignments/${assignmentId}/transition`,
          "POST",
          { action: "submit" },
          student,
        )
      ).body.status,
    ).toBe("submitted");
    expect(
      (
        await request(
          `/assignments/${assignmentId}/answers`,
          "PUT",
          { revision: 1, answers: { q1: { text: "16" } } },
          student,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await request(`/assignments/${assignmentId}/transition`, "POST", {
          action: "return",
        })
      ).body.status,
    ).toBe("returned");
    expect(
      (
        await request(
          `/assignments/${assignmentId}/transition`,
          "POST",
          { action: "submit" },
          student,
        )
      ).body.status,
    ).toBe("submitted");
    const voice = await request("/media", "POST", {
      assignmentId,
      kind: "feedback",
      questionId: "q1",
      mime: "audio/webm",
      size: 4,
      duration: 3,
    });
    await request(`/media/${voice.body.id}/chunks/0`, "PUT", {
      data: "AQIDBA==",
    });
    await request(`/media/${voice.body.id}/complete`, "POST", {});
    const late = await request("/media", "POST", {
      assignmentId,
      kind: "feedback",
      questionId: "q1",
      mime: "audio/webm",
      size: 4,
      duration: 2,
    });
    await request(`/media/${late.body.id}/chunks/0`, "PUT", {
      data: "AQIDBA==",
    });
    expect(
      (
        await request(`/assignments/${assignmentId}/review`, "PUT", {
          feedback: {
            q1: { sticker: "star", text: "כל הכבוד", audioId: voice.body.id },
          },
        })
      ).status,
    ).toBe(200);
    expect(
      (await request(`/assignments/${assignmentId}`)).body.feedback.q1.audioId,
    ).toBe(voice.body.id);
    expect(
      (
        await request(`/assignments/${assignmentId}/transition`, "POST", {
          action: "review",
        })
      ).body.status,
    ).toBe("reviewed");
    expect(
      (await request(`/media/${late.body.id}/complete`, "POST", {})).status,
    ).toBe(409);
    expect(
      (await request(`/media/${voice.body.id}/complete`, "POST", {})).status,
    ).toBe(200);
    expect(
      (await request(`/assignments/${assignmentId}`)).body.feedback.q1.audioId,
    ).toBe(voice.body.id);
  });
  it("scopes parent access and persists an idempotent acknowledgement", async () => {
    expect(
      (
        await request("/media", "POST", {
          assignmentId,
          kind: "feedback",
          questionId: "q1",
          mime: "audio/webm",
          size: 4,
          duration: 2,
        })
      ).status,
    ).toBe(409);
    const link = await request(
      `/assignments/${assignmentId}/parent-links`,
      "POST",
      {},
    );
    expect(link.status).toBe(201);
    parentToken = link.body.token;
    const parent = await request(
      `/parent/${parentToken}`,
      "GET",
      undefined,
      "",
    );
    expect(parent.status).toBe(200);
    expect(parent.body.answers.q1.text).toBe("15");
    expect(
      (
        await app.request(
          `https://pilot.test/api/parent/${parentToken}/media/${mediaId}`,
          {},
          { DB },
        )
      ).status,
    ).toBe(200);
    expect(
      (await request(`/assignments/${assignmentId}`, "GET", undefined, ""))
        .status,
    ).toBe(401);
    const ack = await request(
      `/parent/${parentToken}/acknowledge`,
      "POST",
      {},
      "",
    );
    expect(ack.status).toBe(200);
    expect(
      (await request(`/parent/${parentToken}/acknowledge`, "POST", {}, "")).body
        .acknowledgedAt,
    ).toBe(ack.body.acknowledgedAt);
    expect((await request(`/assignments/${assignmentId}`)).body.status).toBe(
      "parent_acknowledged",
    );
    expect(
      (await request(`/assignments/${assignmentId}/parent-links`, "DELETE", {}))
        .status,
    ).toBe(200);
    expect(
      (await request(`/parent/${parentToken}`, "GET", undefined, "")).status,
    ).toBe(404);
    expect(
      (
        await app.request(
          `https://pilot.test/api/parent/${parentToken}/media/${mediaId}`,
          {},
          { DB },
        )
      ).status,
    ).toBe(404);
  });
  it("rejects expired parent links", async () => {
    const link = await request(
      `/assignments/${assignmentId}/parent-links`,
      "POST",
      {},
    );
    await DB.prepare("UPDATE parent_links SET expires_at = 1").run();
    expect(
      (await request(`/parent/${link.body.token}`, "GET", undefined, ""))
        .status,
    ).toBe(404);
  });
  it("persists accessibility settings and bounds dwell timing", async () => {
    expect(
      (await request("/preferences", "GET", undefined, student)).body.theme,
    ).toBe("cream");
    const themed = await request(
      "/preferences",
      "PUT",
      { theme: "slate", fontScale: 1.25 },
      student,
    );
    expect(themed.body.theme).toBe("slate");
    expect(
      (await request("/preferences", "PATCH", { theme: "blue" }, student))
        .status,
    ).toBe(200);
    const changed = (await request("/preferences", "GET", undefined, student))
      .body;
    expect(changed.theme).toBe("blue");
    expect(changed.fontScale).toBe(1.25);
    expect(
      (await request("/preferences", "PATCH", { theme: "neon" }, student))
        .status,
    ).toBe(400);
    await request("/preferences", "PATCH", { theme: "slate" }, student);
    expect(
      (await request("/preferences", "GET", undefined, student)).body.theme,
    ).toBe("slate");
    expect((await request("/preferences", "GET")).body.theme).toBe("cream");
    expect(
      (await request("/preferences", "PUT", { theme: "neon" }, student)).status,
    ).toBe(400);
    expect(
      (
        await request(
          "/preferences",
          "PUT",
          { mode: "gaze", dwellMs: 1200, dwellSource: "app", spotlight: true },
          student,
        )
      ).status,
    ).toBe(200);
    expect(
      (await request("/preferences", "GET", undefined, student)).body.dwellMs,
    ).toBe(1200);
    expect(
      (
        await request(
          "/preferences",
          "PUT",
          { mode: "gaze", dwellMs: 200 },
          student,
        )
      ).status,
    ).toBe(400);
  });
  it("denies another student access and admits only one concurrent save", async () => {
    const added = await request("/students", "POST", {
      name: "שני",
      consent: true,
    });
    const second = (
      await request("/auth/student", "POST", { code: added.body.code }, "")
    ).cookie;
    expect(
      (await request(`/assignments/${assignmentId}`, "GET", undefined, second))
        .status,
    ).toBe(404);
    expect(
      (
        await request(
          `/assignments/${assignmentId}/answers`,
          "PUT",
          { revision: 1, answers: {} },
          second,
        )
      ).status,
    ).toBe(404);
    const draft = await request("/assignments", "POST", {
      studentId: added.body.id,
      title: "שנייה",
      exercises: [{ id: "q", kind: "text", prompt: "שם" }],
    });
    await request(`/assignments/${draft.body.id}`, "PATCH", {
      confirmed: true,
    });
    await request(`/assignments/${draft.body.id}/transition`, "POST", {
      action: "assign",
    });
    const saves = await Promise.all(
      ["א", "ב"].map((text) =>
        request(
          `/assignments/${draft.body.id}/answers`,
          "PUT",
          { revision: 0, answers: { q: { text } } },
          second,
        ),
      ),
    );
    expect(saves.map((s) => s.status).sort()).toEqual([200, 409]);
    expect(
      (await request(`/assignments/${draft.body.id}`, "GET", undefined, second))
        .body.revision,
    ).toBe(1);
  });
  it("invalidates logout sessions and deletes an entire teacher account", async () => {
    const login = await request(
      "/auth/login",
      "POST",
      { email: "other@example.test", password: "long-password-for-pilot" },
      "",
    );
    expect(login.status).toBe(200);
    expect(
      (await request("/auth/me", "GET", undefined, login.cookie)).body.password,
    ).toBeUndefined();
    expect(
      (await request("/auth/logout", "POST", {}, login.cookie)).status,
    ).toBe(200);
    expect(
      (await request("/auth/me", "GET", undefined, login.cookie)).status,
    ).toBe(401);
    const disposable = (
      await request(
        "/auth/register",
        "POST",
        {
          email: "delete@example.test",
          password: "long-password-for-pilot",
          name: "Delete",
          consent: true,
        },
        "",
      )
    ).cookie;
    expect((await request("/account", "DELETE", {}, disposable)).status).toBe(
      200,
    );
    expect(
      (await request("/auth/me", "GET", undefined, disposable)).status,
    ).toBe(401);
  });
  it("deletes a student and all linked work, tokens and sessions", async () => {
    expect(
      (await request(`/students/${studentId}`, "DELETE", {}, other)).status,
    ).toBe(404);
    expect((await request(`/students/${studentId}`, "DELETE", {})).status).toBe(
      200,
    );
    expect((await request(`/assignments/${assignmentId}`)).status).toBe(404);
    expect((await request("/auth/me", "GET", undefined, student)).status).toBe(
      401,
    );
    expect(
      (await DB.prepare("SELECT count(*) AS n FROM parent_links").first<any>())
        ?.n,
    ).toBe(0);
  });
  it("records consented observations within teacher ownership and reports the pilot", async () => {
    const s = await request("/students", "POST", {
      name: "מדידה",
      consent: true,
    });
    const observation = {
      studentId: s.body.id,
      phase: "baseline",
      mode: "touch",
      interfaceAssists: 10,
      teachingAssists: 2,
      additionalApps: 1,
      blocked: false,
    };
    expect(
      (await request("/pilot/observations", "POST", observation, other)).status,
    ).toBe(404);
    expect(
      (await request("/pilot/observations", "POST", observation)).status,
    ).toBe(201);
    expect(
      (
        await request("/pilot/observations", "POST", {
          ...observation,
          phase: "machberet",
          interfaceAssists: 5,
          additionalApps: 0,
        })
      ).status,
    ).toBe(201);
    const report = await request("/pilot");
    expect(report.status).toBe(200);
    expect(
      report.body.summary.independence.find(
        (r: any) => r.studentId === s.body.id,
      ).reduction,
    ).toBe(50);
    await request(`/students/${s.body.id}`, "DELETE", {});
    expect((await request("/pilot")).body.observations).toHaveLength(0);
  });
  it("binds draft confirmation to a version and rejects competing edits or assignment", async () => {
    const s = await request("/students", "POST", {
      name: "גרסאות",
      consent: true,
    });
    const created = await request("/assignments", "POST", {
      studentId: s.body.id,
      title: "גרסה",
      exercises: [{ id: "q", kind: "text", prompt: "ראשון" }],
    });
    const id = created.body.id;
    const edited = await Promise.all(
      ["שני", "שלישי"].map((title) =>
        request(`/assignments/${id}`, "PATCH", { title, contentRevision: 0 }),
      ),
    );
    expect(edited.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      (
        await request(`/assignments/${id}`, "PATCH", {
          confirmed: true,
          contentRevision: 0,
        })
      ).status,
    ).toBe(409);
    const confirmed = await request(`/assignments/${id}`, "PATCH", {
      confirmed: true,
      contentRevision: 1,
    });
    expect(confirmed.status).toBe(200);
    const race = await Promise.all([
      request(`/assignments/${id}`, "PATCH", {
        exercises: [{ id: "q", kind: "text", prompt: "חדש" }],
        contentRevision: 2,
      }),
      request(`/assignments/${id}/transition`, "POST", {
        action: "assign",
        contentRevision: 2,
      }),
    ]);
    expect(race.map((r) => r.status).sort()).toEqual([200, 409]);
    const final = (await request(`/assignments/${id}`)).body;
    expect(final.status === "assigned" && !final.confirmed).toBe(false);
  });
  it("allows a parent capture ticket to upload only its draft source and expires it on assignment", async () => {
    const s = await request("/students", "POST", {
      name: "צילום בבית",
      consent: true,
    });
    const created = await request("/assignments", "POST", {
      studentId: s.body.id,
      title: "דף מהבית",
      exercises: [],
    });
    expect(created.status).toBe(201);
    const id = created.body.id;
    const ticket = await request(
      `/assignments/${id}/capture-links`,
      "POST",
      {},
    );
    expect(ticket.status).toBe(201);
    const prefix = `/capture/${ticket.body.token}`;
    expect((await request(prefix, "GET", undefined, "")).body.id).toBe(id);
    expect(
      (
        await request(
          `${prefix}/media`,
          "POST",
          { assignmentId: "other", kind: "source", mime: "image/png", size: 4 },
          "",
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          `${prefix}/media`,
          "POST",
          {
            assignmentId: id,
            kind: "instructions",
            mime: "audio/webm",
            size: 4,
            duration: 3,
          },
          "",
        )
      ).status,
    ).toBe(403);
    const m = await request(
      `${prefix}/media`,
      "POST",
      { assignmentId: id, kind: "source", mime: "image/png", size: 4 },
      "",
    );
    expect(m.status).toBe(201);
    expect(
      (
        await request(
          `${prefix}/media/${m.body.id}/chunks/0`,
          "PUT",
          { data: "AQIDBA==" },
          "",
        )
      ).status,
    ).toBe(200);
    expect(
      (await request(`${prefix}/media/${m.body.id}/complete`, "POST", {}, ""))
        .status,
    ).toBe(200);
    expect((await request(`/assignments/${id}`)).body.sourceId).toBe(m.body.id);
    await request(`/assignments/${id}`, "PATCH", {
      exercises: [{ id: "q", kind: "text", prompt: "שאלה" }],
    });
    await request(`/assignments/${id}`, "PATCH", { confirmed: true });
    await request(`/assignments/${id}/transition`, "POST", {
      action: "assign",
    });
    expect((await request(prefix, "GET", undefined, "")).status).toBe(404);
    expect(
      (await request(`${prefix}/media/${m.body.id}`, "GET", undefined, ""))
        .status,
    ).toBe(404);
  });
});
