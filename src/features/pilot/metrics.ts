export interface Observation {
  studentId: string;
  phase: "baseline" | "machberet";
  mode: string;
  interfaceAssists: number;
  teachingAssists: number;
  additionalApps: number;
  blocked: boolean;
  preparationMs?: number;
  markingMs?: number;
}
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
export function summarize(rows: Observation[]) {
  const pilot = rows.filter((r) => r.phase === "machberet");
  const keys = [...new Set(pilot.map((r) => `${r.studentId}|${r.mode}`))];
  const independence = keys.map((key) => {
    const [studentId, mode] = key.split("|");
    const own = rows.filter(
      (r) => r.studentId === studentId && r.mode === mode,
    );
    const baseline = median(
        own
          .filter((r) => r.phase === "baseline")
          .map((r) => r.interfaceAssists),
      ),
      current = median(
        own
          .filter((r) => r.phase === "machberet")
          .map((r) => r.interfaceAssists),
      );
    return {
      studentId,
      mode,
      baseline,
      current,
      reduction:
        baseline && current !== null
          ? ((baseline - current) / baseline) * 100
          : null,
    };
  });
  return {
    independence,
    appFreePercent: pilot.length
      ? (pilot.filter((r) => r.additionalApps === 0).length / pilot.length) *
        100
      : null,
    preparationMedianMs: median(
      pilot.flatMap((r) =>
        r.preparationMs === undefined ? [] : [r.preparationMs],
      ),
    ),
    markingMedianMs: median(
      pilot.flatMap((r) => (r.markingMs === undefined ? [] : [r.markingMs])),
    ),
    blockedSessions: pilot.filter((r) => r.blocked).length,
    sessionCount: pilot.length,
  };
}
