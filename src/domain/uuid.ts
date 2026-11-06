const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids from a URL reach queries as text; Postgres errors on a malformed uuid. */
export function isUuid(value: string) {
  return UUID.test(value);
}
