import { expect, it } from "vitest";
import { summarize, type Observation } from "../src/features/pilot/metrics";
it("compares students with their own input-mode baseline without counting teaching help", () => {
  const common = {
    studentId: "a",
    mode: "switch",
    teachingAssists: 50,
    additionalApps: 0,
    blocked: false,
  };
  const rows: Observation[] = [
    { ...common, phase: "baseline", interfaceAssists: 10 },
    { ...common, phase: "baseline", interfaceAssists: 6 },
    {
      ...common,
      phase: "machberet",
      interfaceAssists: 4,
      preparationMs: 120000,
      markingMs: 8000,
    },
    {
      ...common,
      phase: "machberet",
      interfaceAssists: 4,
      additionalApps: 1,
      preparationMs: 180000,
      markingMs: 12000,
    },
    { ...common, studentId: "b", phase: "machberet", interfaceAssists: 0 },
  ];
  const result = summarize(rows);
  expect(result.independence.find((r) => r.studentId === "a")?.reduction).toBe(
    50,
  );
  expect(
    result.independence.find((r) => r.studentId === "b")?.reduction,
  ).toBeNull();
  expect(result.appFreePercent).toBeCloseTo(200 / 3);
  expect(result.preparationMedianMs).toBe(150000);
  expect(result.markingMedianMs).toBe(10000);
});
