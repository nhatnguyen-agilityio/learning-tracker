/** Reads the token from `Authorization: Bearer <token>`. */
export function readBearerToken(header: string | null) {
  return header?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
}
