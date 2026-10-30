import { useEffect, useRef, useState } from "react";
import { ErrorMessage, useAction } from "./Common";
export function AudioRecorder({
  label,
  onSave,
  onPendingChange,
}: {
  label: string;
  onSave: (blob: Blob, duration: number) => Promise<void>;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [recording, setRecording] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [clip, setClip] = useState<Blob | null>(null),
    [saved, setSaved] = useState(false),
    [preview, setPreview] = useState("");
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setInterval> | null>(null),
    started = useRef(0);
  const { run, error, busy } = useAction();
  const pending = busy || recording || (!!clip && !saved);
  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => {
    if (!clip) return;
    const u = URL.createObjectURL(clip);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [clip]);
  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    if (timer.current) clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);
  }
  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
      throw new Error("הקלטה דורשת דפדפן תומך וחיבור מאובטח");
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.current = s;
    const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find((x) =>
      MediaRecorder.isTypeSupported(x),
    );
    const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
    recorder.current = r;
    const chunks: BlobPart[] = [];
    r.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    r.onstop = () => {
      setClip(new Blob(chunks, { type: r.mimeType.split(";")[0] }));
      setElapsed(Math.min(15, (Date.now() - started.current) / 1000));
      s.getTracks().forEach((t) => t.stop());
    };
    started.current = Date.now();
    setSaved(false);
    setElapsed(0);
    setRecording(true);
    r.start();
    timer.current = setInterval(() => {
      const seconds = (Date.now() - started.current) / 1000;
      setElapsed(Math.min(seconds, 15));
      if (seconds >= 15) stop();
    }, 100);
  }
  return (
    <fieldset>
      <legend>{label}</legend>
      <p>עד 15 שניות. ההקלטה מתחילה רק בלחיצה.</p>
      <button
        disabled={busy}
        onClick={() => (recording ? stop() : void run(start))}
      >
        {recording ? `עצירת ההקלטה · ${Math.ceil(elapsed)}` : "הקלטת הודעה"}
      </button>
      {clip && (
        <>
          {preview && <audio controls src={preview} />}
          <button
            disabled={busy || saved || recording}
            onClick={() =>
              run(async () => {
                await onSave(clip, Math.max(0.1, elapsed));
                setSaved(true);
              })
            }
          >
            {saved ? "ההקלטה נשמרה" : "שמירת ההקלטה"}
          </button>
          {!recording && !saved && (
            <button
              disabled={busy}
              onClick={() => {
                setClip(null);
                setPreview("");
              }}
            >
              ויתור על ההקלטה
            </button>
          )}
        </>
      )}
      <ErrorMessage error={error} />
    </fieldset>
  );
}
