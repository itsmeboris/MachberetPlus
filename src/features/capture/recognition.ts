export function candidates(text: string): Array<{
  prompt: string;
  math: string;
  kind: "text" | "fraction" | "equation" | "arithmetic";
}> {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^\d+[.)]\s*/, ""))
    .filter(Boolean)
    .slice(0, 50)
    .map((line) => {
      const math = line.match(/[\d(][\d\sxy+−\-×÷*/=().]+/i)?.[0].trim() ?? "";
      const kind = !math
        ? "text"
        : /[xy]/i.test(math)
          ? "equation"
          : math.includes("/")
            ? "fraction"
            : "arithmetic";
      return {
        prompt: line.replace(math, "").trim() || (math ? "פתרו את התרגיל" : ""),
        math,
        kind,
      };
    });
}
