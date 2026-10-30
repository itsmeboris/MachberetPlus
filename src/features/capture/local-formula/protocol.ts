export type FormulaProgress =
  | { phase: "download"; file: string; loaded: number; total: number }
  | { phase: "loading" }
  | { phase: "recognize"; completed: number; total: number };

export type FormulaRequest = {
  lines: { pixels: ArrayBuffer; width: number; height: number }[];
};
export type FormulaResponse =
  | { type: "progress"; progress: FormulaProgress }
  | { type: "result"; lines: string[] }
  | { type: "error"; message: string };
