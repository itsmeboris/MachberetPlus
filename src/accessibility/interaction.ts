export class DwellActivation {
  private target: string | null = null;
  private since = 0;
  private fired = false;
  constructor(public duration = 1000) {}
  update(
    target: string | null,
    now: number,
    enabled = true,
  ): { progress: number; activate: boolean } {
    if (!enabled || !target) {
      this.reset();
      return { progress: 0, activate: false };
    }
    if (target !== this.target) {
      this.target = target;
      this.since = now;
      this.fired = false;
    }
    const progress = Math.min(
      1,
      Math.max(0, (now - this.since) / this.duration),
    );
    const activate = progress === 1 && !this.fired;
    if (activate) this.fired = true;
    return { progress, activate };
  }
  reset() {
    this.target = null;
    this.fired = false;
  }
}
export function mathSpeech(text: string) {
  const words: Record<string, string> = {
    "+": "ועוד",
    "-": "פחות",
    "−": "פחות",
    "×": "כפול",
    "*": "כפול",
    "/": "חלקי",
    "÷": "חלקי",
    "=": "שווה",
    x: "איקס",
    "(": "פתח סוגריים",
    ")": "סגור סוגריים",
  };
  return text
    .replace(/[+\-−×*/÷=x()]/g, (char) => ` ${words[char]} `)
    .replace(/\s+/g, " ")
    .trim();
}
