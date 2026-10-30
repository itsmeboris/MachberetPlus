export type Exercise = {
  id: string;
  kind: "text" | "arithmetic" | "vertical" | "fraction" | "equation";
  prompt: string;
  math: string;
  spokenText: string;
  operands?: string[];
};
export type Answer = { text: string; cells?: Record<string, string> };
export type Feedback = {
  text?: string;
  sticker?: "star" | "heart" | "effort";
  decision?: "reviewed" | "retry";
  audioId?: string;
};
export type Assignment = {
  contentRevision: number;
  id: string;
  studentId: string;
  title: string;
  status: string;
  exercises: Exercise[];
  confirmed: boolean;
  answers: Record<string, Answer>;
  revision: number;
  feedback: Record<string, Feedback>;
  sourceId: string | null;
  instructionsId: string | null;
  acknowledgedAt: number | null;
};
export type Preferences = {
  mode: "standard" | "motor" | "gaze" | "switch";
  dwellMs: number;
  dwellSource: "app" | "device" | "off";
  spotlight: boolean;
  fontScale: number;
  switchNext: string;
  switchSelect: string;
};
export type User = {
  id: string;
  name: string;
  role: "teacher" | "student";
  preferences?: Partial<Preferences>;
};
export const statuses: Record<string, string> = {
  draft: "טיוטה",
  assigned: "ממתינה לפתרון",
  in_progress: "בתהליך",
  submitted: "ממתינה לבדיקה",
  returned: "ניסיון נוסף",
  reviewed: "נבדקה",
  parent_acknowledged: "עברו יחד בבית",
};
