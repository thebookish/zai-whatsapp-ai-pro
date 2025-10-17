// functions/src/utils/parse.ts

/**
 * Extracts the first email address found in a string.
 * - Case-insensitive
 * - Ignores surrounding punctuation like <...>, ( ... ), "..."
 * - Returns the email lowercased, or null if none found
 */
export function extractEmail(input: string | undefined | null): string | null {
  if (!input) return null;

  // Quick normalize: collapse whitespace, strip common wrappers
  const text = String(input)
    .replace(/\s+/g, " ")
    .replace(/[<>\(\)\[\]"']/g, " ")
    .trim();

  // RFC5322-compliant is complex; this pragmatic regex covers standard emails well.
  // - local part: letters/digits/._%+- (at least 1)
  // - domain: labels separated by dots, each label starts/ends with alnum, may contain hyphens
  // - TLD: at least 2 letters
  const emailRe =
    /([a-z0-9._%+-]+)@([a-z0-9-]+(?:\.[a-z0-9-]+)*)\.([a-z]{2,})/i;

  const match = text.match(emailRe);
  if (!match) return null;

  // Normalize to lowercase
  return match[0].toLowerCase();
}
