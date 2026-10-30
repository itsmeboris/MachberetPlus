import { expect, it } from "vitest";
import { recordHtml } from "../src/features/review/export";
import type { Assignment } from "../src/types";
it("exports escaped Hebrew, vertical working, and embedded audio without account links", () => {
  const a: Assignment = {
    id: "a",
    studentId: "s",
    title: "דף <script>alert(1)</script>",
    status: "reviewed",
    contentRevision: 0,
    revision: 1,
    confirmed: true,
    sourceId: null,
    instructionsId: null,
    acknowledgedAt: null,
    exercises: [
      {
        id: "q",
        kind: "vertical",
        prompt: "חיבור",
        math: "12 + 3",
        spokenText: "",
      },
    ],
    answers: {
      q: {
        text: "15",
        cells: { "carry-1": "1", "answer-1": "1", "answer-2": "5" },
      },
    },
    feedback: { q: { text: "כל הכבוד", audioId: "voice" } },
  };
  const html = recordHtml(a, { voice: "data:audio/webm;base64,AQIDBA==" });
  expect(html).toContain('lang="he"');
  expect(html).toContain("כל הכבוד");
  expect(html).toContain("data:audio/webm;base64,AQIDBA==");
  expect(html).toContain("המרה");
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("/api/");
});
