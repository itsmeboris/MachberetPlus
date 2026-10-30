import type { Feedback } from "../../types";

// The existing wire value "reviewed" is an explicit per-answer teacher mark,
// independent of the whole assignment's reviewed status.
export const decisionLabels = {
  reviewed: "תשובה נכונה",
  retry: "כדאי לנסות שוב",
  unmarked: "לא סומן",
};

export function decisionLabel(decision: Feedback["decision"]) {
  return decisionLabels[decision ?? "unmarked"];
}
