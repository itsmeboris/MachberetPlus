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
  student = "";
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
describe("student corrections", () => {
  it("reopens unreviewed submissions, invalidates stale reviews and protects reviewed work", async () => {
    teacher = (
      await request(
        "/auth/register",
        "POST",
        {
          email: "correction@example.test",
          password: "long-password-for-pilot",
          name: "Teacher",
          consent: true,
        },
        "",
      )
    ).cookie;
    const pupil = (
      await request("/students", "POST", { name: "Student", consent: true })
    ).body;
    student = (await request("/auth/student", "POST", { code: pupil.code }, ""))
      .cookie;
    const a = (
      await request("/assignments", "POST", {
        studentId: pupil.id,
        title: "Corrections",
        exercises: [
          { id: "q", kind: "arithmetic", prompt: "Add", math: "1+1" },
        ],
      })
    ).body;
    const path = `/assignments/${a.id}`;
    await request(path, "PATCH", { confirmed: true });
    await request(`${path}/transition`, "POST", { action: "assign" });
    await request(
      `${path}/answers`,
      "PUT",
      { revision: 0, answers: { q: { text: "3" } } },
      student,
    );
    const submitted = (
      await request(
        `${path}/transition`,
        "POST",
        { action: "submit", revision: 1 },
        student,
      )
    ).body;
    expect(
      (await request(`${path}/transition`, "POST", { action: "withdraw" }))
        .status,
    ).toBe(403);
    expect(
      (
        await request(
          `${path}/transition`,
          "POST",
          { action: "withdraw", revision: 0 },
          student,
        )
      ).status,
    ).toBe(409);
    const reopened = await request(
      `${path}/transition`,
      "POST",
      { action: "withdraw" },
      student,
    );
    expect(reopened.status).toBe(200);
    expect(reopened.body.status).toBe("in_progress");
    expect(reopened.body.answers.q.text).toBe("3");
    await request(
      `${path}/answers`,
      "PUT",
      { revision: 1, answers: { q: { text: "2" } } },
      student,
    );
    await request(
      `${path}/transition`,
      "POST",
      { action: "submit", revision: 2 },
      student,
    );
    expect(
      (
        await request(`${path}/review`, "PUT", {
          contentRevision: submitted.contentRevision,
          feedback: { q: { text: "stale" } },
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(`${path}/review`, "PUT", {
          feedback: { q: { text: "Checked" } },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          `${path}/transition`,
          "POST",
          { action: "withdraw" },
          student,
        )
      ).status,
    ).toBe(409);
    await request(`${path}/transition`, "POST", { action: "review" });
    expect(
      (
        await request(
          `${path}/transition`,
          "POST",
          { action: "withdraw" },
          student,
        )
      ).status,
    ).toBe(409);
    expect((await request(path)).body.answers.q.text).toBe("2");
    const link = (await request(`${path}/parent-links`, "POST", {})).body.token;
    expect(
      (await request(`/parent/${link}/acknowledge`, "POST", {}, "")).status,
    ).toBe(200);
    const acknowledged = (await request(path)).body;
    expect(acknowledged.status).toBe("parent_acknowledged");
    expect(
      (
        await request(`${path}/transition`, "POST", {
          action: "return",
          expectedStatus: "reviewed",
        })
      ).status,
    ).toBe(409);
    const returned = await request(`${path}/transition`, "POST", {
      action: "return",
      expectedStatus: "parent_acknowledged",
    });
    expect(returned.status).toBe(200);
    expect(returned.body.status).toBe("returned");
    expect(returned.body.acknowledgedAt).toBeNull();
    expect(returned.body.feedback.q.text).toBe("Checked");
    expect(
      (await request(`/parent/${link}/acknowledge`, "POST", {}, "")).status,
    ).toBe(404);
    await request(
      `${path}/answers`,
      "PUT",
      { revision: 2, answers: { q: { text: "4" } } },
      student,
    );
    await request(
      `${path}/transition`,
      "POST",
      { action: "submit", revision: 3 },
      student,
    );
    await request(`${path}/transition`, "POST", { action: "review" });
    expect(
      (await request(`/parent/${link}`, "GET", undefined, "")).status,
    ).toBe(404);
    // Pause link issuance after its read: a teacher return wins before INSERT.
    const originalDB = DB;
    DB = new Proxy(originalDB, {
      get(target, property) {
        if (property === "batch")
          return async (statements: D1PreparedStatement[]) => {
            await originalDB
              .prepare(
                "UPDATE assignments SET status='returned',content_revision=content_revision+1 WHERE id=?",
              )
              .bind(a.id)
              .run();
            return originalDB.batch(statements);
          };
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    try {
      expect((await request(`${path}/parent-links`, "POST", {})).status).toBe(
        409,
      );
    } finally {
      DB = originalDB;
    }
    const liveLinks = await DB.prepare(
      "SELECT COUNT(*) AS n FROM parent_links WHERE assignment_id=? AND revoked=0",
    )
      .bind(a.id)
      .first<{ n: number }>();
    expect(liveLinks?.n).toBe(0);
  });
});
