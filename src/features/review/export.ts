import type { Assignment } from "../../types";
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export function recordHtml(
  a: Assignment,
  audio: Record<string, string>,
): string {
  const voice = (id?: string | null) =>
    id &&
    /^data:audio\/(webm|ogg|mp4);base64,[A-Za-z0-9+/=]+$/.test(audio[id] ?? "")
      ? `<p>משוב קולי מצורף לקובץ הדיגיטלי</p><audio controls src="${audio[id]}"></audio>`
      : "";
  const questions = a.exercises
    .map((q, i) => {
      const answer = a.answers[q.id],
        feedback = a.feedback[q.id];
      let working = "";
      if (q.kind === "vertical") {
        const operands = q.operands ?? q.math.match(/\d+/g)?.slice(0, 2) ?? [];
        const count = Math.min(
          7,
          Math.max(2, ...operands.map((n) => n.length)) + 1,
        );
        working = `<table dir="ltr"><caption>דרך הפתרון — המרה ושארית</caption><tbody><tr>${Array.from({ length: count }, (_, col) => `<td>${escape(answer?.cells?.[`carry-${col}`])}</td>`).join("")}</tr>${operands.map((n) => `<tr>${[...n.padStart(count, " ")].map((d) => `<td>${escape(d)}</td>`).join("")}</tr>`).join("")}<tr>${Array.from({ length: count }, (_, col) => `<td>${escape(answer?.cells?.[`answer-${col}`])}</td>`).join("")}</tr></tbody></table>`;
      }
      return `<section><h2>${i + 1}. ${escape(q.prompt)}</h2><p dir="ltr" class="math">${escape(q.math)}</p>${working}<p dir="${q.kind === "text" ? "rtl" : "ltr"}" class="answer">${escape(answer?.text || "לא נכתבה תשובה")}</p>${feedback ? `<aside><p>${escape(feedback.sticker ? "☆" : "")} ${escape(feedback.text)}</p>${voice(feedback.audioId)}</aside>` : ""}</section>`;
    })
    .join("");
  return `<!doctype html><html lang="he" dir="rtl"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(a.title)} — מחברת+</title><style>body{font:20px Arial,sans-serif;line-height:1.7;color:#1e293b;max-width:900px;margin:40px auto;padding:20px}section{border-bottom:1px solid #cbd5e1;padding:24px 0;break-inside:avoid}.math,.answer{white-space:pre-wrap}.math{text-align:center;font-size:28px;unicode-bidi:isolate}aside{border-right:4px solid #cbd5e1;padding:16px}td{border:1px solid #cbd5e1;padding:12px;text-align:center}table{border-collapse:collapse;margin:auto}audio{max-width:100%}@media print{body{margin:0;font-size:14pt}audio{display:none}}</style><body><header><p>מחברת+ · עותק העבודה והמשוב</p><h1>${escape(a.title)}</h1>${a.acknowledgedAt ? `<p>אושר יחד בבית: ${escape(new Date(a.acknowledgedAt).toLocaleString("he-IL"))}</p>` : ""}</header>${voice(a.instructionsId)}${questions}</body></html>`;
}
export async function downloadRecord(a: Assignment, parentToken?: string) {
  const ids = [
    ...new Set(
      [
        a.instructionsId,
        ...Object.values(a.feedback).map((f) => f.audioId),
      ].filter((id): id is string => !!id),
    ),
  ];
  const audio: Record<string, string> = {};
  await Promise.all(
    ids.map(async (id) => {
      const response = await fetch(
        parentToken
          ? `/api/parent/${parentToken}/media/${id}`
          : `/api/media/${id}`,
      );
      if (!response.ok)
        throw new Error("לא ניתן להוריד את ההקלטות. נסו שוב לפני שמירת העותק.");
      const blob = await response.blob();
      audio[id] = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("שגיאה בהכנת ההורדה"));
        reader.readAsDataURL(blob);
      });
    }),
  );
  const url = URL.createObjectURL(
    new Blob([recordHtml(a, audio)], { type: "text/html;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "machberet-completed-work.html";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
