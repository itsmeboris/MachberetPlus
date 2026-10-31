import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Review } from "../src/features/review/Review";
import { WorkRecord } from "../src/features/review/WorkRecord";
import { recordHtml } from "../src/features/review/export";
import type { Assignment } from "../src/types";

const assignment: Assignment = {
  id: "a",
  studentId: "s",
  title: "בדיקה",
  status: "submitted",
  contentRevision: 0,
  revision: 1,
  confirmed: true,
  sourceId: null,
  instructionsId: null,
  acknowledgedAt: null,
  exercises: ["correct", "retry", "unmarked"].map((id) => ({
    id,
    kind: "arithmetic",
    prompt: "פתרו",
    math: "2 + 3",
    spokenText: "",
  })),
  answers: { correct: { text: "5" }, retry: { text: "4" } },
  feedback: { correct: { decision: "reviewed" }, retry: { decision: "retry" } },
};

it("offers explicit teacher marking only for submitted work", () => {
  const html = renderToStaticMarkup(
    createElement(Review, { assignment, onBack() {} }),
  );
  expect(html).toContain("סימון התשובה לתרגיל 1");
  expect(html).toContain("תשובה נכונה");
  expect(html).toContain("כדאי לנסות שוב");
  expect(html).toContain("לא סומן");
  expect(html).toContain("אין בדיקה אוטומטית");
  const reviewed = renderToStaticMarkup(
    createElement(Review, {
      assignment: { ...assignment, status: "reviewed" },
      onBack() {},
    }),
  );
  expect(reviewed).not.toContain('type="radio"');
  expect(reviewed).toContain("החזרה לתיקון");
});

it("shows teacher decisions and unmarked answers in shared records and exports", () => {
  const html = renderToStaticMarkup(createElement(WorkRecord, { assignment }));
  const exported = recordHtml(assignment, {});
  for (const output of [html, exported]) {
    expect(output).toContain("תשובה נכונה");
    expect(output).toContain("כדאי לנסות שוב");
    expect(output).toContain("לא סומן");
  }
});

it("keeps a single page heading when records are embedded in a review", () => {
  const html = renderToStaticMarkup(
    createElement(Review, {
      assignment: { ...assignment, status: "reviewed" },
      onBack() {},
    }),
  );
  expect(html.match(/<h1>/g)).toHaveLength(1);
  expect(html).toContain("<h2><bdi>בדיקה</bdi></h2>");
  expect(html).toContain("<h3>תרגיל 1");
  const standalone = renderToStaticMarkup(
    createElement(WorkRecord, { assignment }),
  );
  expect(standalone).toContain("<h1><bdi>בדיקה</bdi></h1>");
  expect(standalone).toContain("<h2>תרגיל 1");
});
