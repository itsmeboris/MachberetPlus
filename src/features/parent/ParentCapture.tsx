import { useEffect, useState } from "react";
import { api, upload } from "../../api";
import { Panel, ErrorMessage, useAction } from "../../components/Common";
import { ImageEditor } from "../capture/ImageEditor";
import { pageFile } from "../capture/pageFile";
export function ParentCapture({ token }: { token: string }) {
  const [draft, setDraft] = useState<{
      id: string;
      title: string;
      sourceId: string | null;
    } | null>(null),
    [file, setFile] = useState<File | null>(null),
    [blob, setBlob] = useState<Blob | null>(null),
    [url, setUrl] = useState(""),
    [pages, setPages] = useState(1),
    [page, setPage] = useState(1),
    [sent, setSent] = useState(false);
  const { run, error, busy } = useAction();
  const prefix = `/capture/${token}`;
  useEffect(() => {
    void run(async () => setDraft(await api(prefix)));
  }, [token]);
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  async function load(f: File, p = 1) {
    const result = await pageFile(f, p);
    setFile(f);
    setBlob(result.blob);
    setPages(result.pages);
    setPage(p);
    setSent(false);
  }
  return (
    <div className="parent-view">
      <h1>שולחים דף למורה</h1>
      <p>מצלמים עמוד אחד. המורה יבדוק את התרגילים לפני שישלח אותם לתלמיד.</p>
      <ErrorMessage error={error} />
      {draft && (
        <Panel>
          <h2>{draft.title}</h2>
          <label className="upload-zone">
            צילום או העלאת דף
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void run(() => load(f));
              }}
            />
          </label>
          <label>
            צילום במצלמה
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void run(() => load(f));
              }}
            />
          </label>
          {pages > 1 && (
            <label>
              עמוד מתוך {pages}
              <input
                type="number"
                min="1"
                max={pages}
                value={page}
                onChange={(e) => setPage(Number(e.target.value))}
              />
              <button
                disabled={busy}
                onClick={() => file && run(() => load(file, page))}
              >
                בחירת העמוד
              </button>
            </label>
          )}
          {url && <ImageEditor url={url} onChange={setBlob} />}
          <button
            className="primary"
            disabled={!blob || busy}
            onClick={() =>
              run(async () => {
                await upload(
                  draft.id,
                  blob!,
                  "source",
                  undefined,
                  undefined,
                  prefix,
                );
                setSent(true);
              })
            }
          >
            שליחת הדף למורה
          </button>
          {sent && <p role="status">הדף נשלח למורה. תודה!</p>}
        </Panel>
      )}
    </div>
  );
}
