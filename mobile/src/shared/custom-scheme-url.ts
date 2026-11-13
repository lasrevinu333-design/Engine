export interface ParsedExternalUrl {
  input: URL;
  protocol: string;
}

export function parseUrlWithHierarchicalCustomSchemes(
  rawSource: unknown,
  customSchemes: ReadonlySet<string>,
): ParsedExternalUrl | null {
  const source = String(rawSource ?? '').trim();
  if (!source) return null;

  let parsed: URL;
  try {
    parsed = new URL(source, 'https://localhost/app-shell.html');
  } catch {
    return null;
  }

  const protocol = parsed.protocol.toLowerCase();
  if (!customSchemes.has(protocol)) return { input: parsed, protocol };

  const separator = source.indexOf(':');
  if (separator < 1 || !source.slice(separator + 1).startsWith('//')) return null;
  try {
    const input = new URL(`https:${source.slice(separator + 1)}`);
    if (input.username || input.password || input.port) return null;
    return { input, protocol };
  } catch {
    return null;
  }
}
