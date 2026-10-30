import { afterAll, beforeAll, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import app from "../server/index";
import { parseVisionResult } from "../server/recognition";
const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: "vision-test",
        modules: true,
        script: 'export default {fetch(){return new Response("ok")}}',
        d1Databases: ["DB"],
      },
    ],
  }),
);
let DB: D1Database,
  cookie = "";
let calls = 0;
const AI = {
  async run() {
    calls++;
    return {
      choices: [
        {
          message: {
            content: JSON.stringify({
              exercises: [{ kind: "equation", math: "x + 5 = 12", prompt: "" }],
            }),
          },
        },
      ],
    };
  },
};
const image = "data:image/jpeg;base64,/9j/2Q==";
async function request(
  path: string,
  method = "GET",
  data?: unknown,
  actor = cookie,
) {
  return app.request(
    "https://pilot.test/api" + path,
    {
      method,
      headers: {
        Origin: "https://pilot.test",
        "Content-Type": "application/json",
        Cookie: actor,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    },
    { DB, AI },
  );
}
beforeAll(async () => {
  DB = (await mf.getD1Database("DB")) as unknown as D1Database;
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    for (const sql of readFileSync("migrations/" + file, "utf8")
      .split(";")
      .filter((s) => s.trim()))
      await DB.prepare(sql).run();
  const r = await request(
    "/auth/register",
    "POST",
    {
      email: "vision@test.test",
      password: "test-password-1234",
      name: "test",
      consent: true,
    },
    "",
  );
  cookie = r.headers.get("set-cookie")!.split(";")[0];
});
afterAll(() => mf.dispose());
it("requires an authenticated teacher and explicit cloud consent before inference", async () => {
  expect(
    (await request("/recognition", "POST", { image, consent: true }, ""))
      .status,
  ).toBe(401);
  expect((await request("/recognition", "POST", { image })).status).toBe(400);
  const s = (await (
    await request("/students", "POST", { name: "student", consent: true })
  ).json()) as any;
  const pair = await request("/auth/student", "POST", { code: s.code }, "");
  expect(
    (
      await request(
        "/recognition",
        "POST",
        { image, consent: true },
        pair.headers.get("set-cookie")!.split(";")[0],
      )
    ).status,
  ).toBe(403);
  expect(calls).toBe(0);
  const response = await request("/recognition", "POST", {
    image,
    consent: true,
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    exercises: [
      { prompt: "פתרו את התרגיל", math: "x + 5 = 12", kind: "equation" },
    ],
  });
  expect(calls).toBe(1);
});
it("rejects unbounded, malformed or unsupported model output rather than displaying invented content", () => {
  expect(() =>
    parseVisionResult({ choices: [{ message: { content: "not json" } }] }),
  ).toThrow();
  expect(() =>
    parseVisionResult({
      choices: [
        {
          message: {
            content: JSON.stringify({
              exercises: [{ kind: "automatic-grade", math: "1+1", prompt: "" }],
            }),
          },
        },
      ],
    }),
  ).toThrow();
  expect(
    parseVisionResult({
      choices: [{ message: { content: '{"exercises":[]}' } }],
    }),
  ).toEqual([]);
});
