const LATIN_REGEX = /[A-Za-z\u00C0-\u024F]/;

function extractFileName(path: string): string {
  const normalized = path.split(/[?#]/)[0];
  return normalized.split("/").pop() ?? normalized;
}

export function humanizeDocumentName(path: string): string {
  const rawName = extractFileName(path);
  if (!rawName) return path;
  const [namePart, ...rest] = rawName.split(".");
  const extension = rest.length ? `.${rest.pop()}` : "";
  const segments = namePart.split(/[-_]+/);
  const firstMeaningfulIndex = segments.findIndex((segment) => LATIN_REGEX.test(segment));
  const candidate = firstMeaningfulIndex > 0 ? segments.slice(firstMeaningfulIndex).join(" ") : segments.join(" ");
  const friendlyCore = candidate.trim();
  if (!friendlyCore) {
    return rawName;
  }
  return `${friendlyCore}${extension}`.trim();
}
