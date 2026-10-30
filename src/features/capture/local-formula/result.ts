import type { Exercise } from "../../../types";

// Translate notation only. Never solve equations or substitute a plausible digit.
export function formulaProposals(
  lines: string[],
): Array<Omit<Exercise, "id" | "spokenText">> {
  const result = lines
    .filter((line) => line.trim())
    .map((line) => {
      if (line.length > 1000)
        throw new Error("התרגיל ארוך מדי. חתכו אזור קטן יותר ונסו שוב.");
      let math = line
        .trim()
        .replace(/^\$+|\$+$/g, "")
        .replace(/\\(?:left|right)(?![a-z])/g, "")
        .replace(/\\(?:,|!|;|quad|qquad| )/g, " ")
        .replace(/\\(?:times|cdot)(?![a-z])/g, "×")
        .replace(/\\div(?![a-z])/g, "÷")
        .replace(/\\(?:leq|le)(?![a-z])/g, "≤")
        .replace(/\\(?:geq|ge)(?![a-z])/g, "≥")
        .replace(/\\(?:neq|ne)(?![a-z])/g, "≠");
    if (/[\d}]\s*\\(?:dfrac|tfrac|frac)\s*\{/.test(math))
      throw new Error(
        "זוהה שבר מעורב או כפל שאינו חד-משמעי. הזינו את התרגיל ידנית כדי לשמור על משמעותו. התרגילים הקיימים נשמרו.",
      );
      // Innermost groups first, retaining parentheses for mathematical grouping.
      for (let i = 0; i < 8; i++) {
        const next = math.replace(
          /\\(?:dfrac|tfrac|frac)\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,
          "($1)/($2)",
        );
        if (next === math) break;
        math = next;
      }
      math = math.replace(/\s+/g, "");
      if (!math || /\\|[\u0590-\u05ff]/.test(math))
        throw new Error(
          "הזיהוי המקומי מיועד לתרגילי חשבון ומשוואות פשוטות. נמצא סימון שאינו נתמך; חתכו תרגיל אחד או הזינו אותו ידנית. התרגילים הקיימים נשמרו.",
        );
      return {
        prompt: "פתרו את התרגיל",
        math,
        kind: (/[a-z]/i.test(math)
          ? "equation"
          : math.includes("/")
            ? "fraction"
            : "arithmetic") as Exercise["kind"],
      };
    });
  if (!result.length || result.length > 30)
    throw new Error(
      "לא נמצאו תרגילים ברורים. חתכו את הדף או תרגיל אחד ונסו שוב.",
    );
  return result;
}
