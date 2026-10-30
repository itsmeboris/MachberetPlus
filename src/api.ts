export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: data === undefined ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const body = await response.json();
  if (!response.ok)
    throw new ApiError(
      (body as { error?: string }).error ?? "לא ניתן להשלים את הפעולה",
      response.status,
    );
  return body as T;
}
export async function upload(
  assignmentId: string,
  blob: Blob,
  kind: "source" | "instructions" | "feedback",
  duration?: number,
  questionId?: string,
  prefix = "",
) {
  const { id, chunkSize } = await api(`${prefix}/media`, "POST", {
    assignmentId,
    kind,
    mime: blob.type.split(";")[0],
    size: blob.size,
    duration,
    questionId,
  });
  for (
    let offset = 0, part = 0;
    offset < blob.size;
    offset += chunkSize, part++
  ) {
    const bytes = new Uint8Array(
      await blob.slice(offset, offset + chunkSize).arrayBuffer(),
    );
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    await api(`${prefix}/media/${id}/chunks/${part}`, "PUT", {
      data: btoa(binary),
    });
  }
  await api(`${prefix}/media/${id}/complete`, "POST", {});
  return id as string;
}
