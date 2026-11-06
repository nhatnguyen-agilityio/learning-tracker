/** Reads a JSON object from a request; anything else gives null. */
export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | null> {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}
