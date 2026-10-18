/** decodeURIComponent that never throws: malformed input is returned unchanged. */
export function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
