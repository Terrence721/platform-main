/**
 * An error as one line of text for the command-line tools: its message, then
 * each cause after it. Drizzle wraps every database error, so its message is
 * only the failed query ("Failed query: …"); the reason (a refused
 * connection, a wrong password, a conflicting migration) is the cause.
 */
export function errorText(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current = error;
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
    } else {
      parts.push(String(current));
      current = undefined;
    }
  }
  return parts.join(' — ');
}
