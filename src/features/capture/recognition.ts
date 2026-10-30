export function candidates(text: string): Array<{
  prompt: string;
  math: string;
  kind: "text" | "fraction" | "equation" | "arithmetic";
}> {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^\d+[.)]\s*/, ""))
    .filter((line) =>
      /[\u05d0-\u05eaA-Za-z]{2}|\d\s*[+−\-×÷*/=]|[xy]\s*[+−\-=]/i.test(
        line.replace(/[\u0591-\u05c7]/g, ""),
      ),
    )
    .slice(0, 50)
    .map((line) => {
      const math =
        line.match(/[\d(xy][\d\sxy+−\-×÷*/=().]+/i)?.[0].trim() ?? "";
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
