import { codeToHtml } from "shiki";

const LANGUAGES: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  json: "json",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  yml: "yaml",
  yaml: "yaml",
  css: "css",
  html: "html",
  md: "markdown",
  toml: "toml"
};

export function languageFor(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGES[ext] ?? null;
}

/**
 * Server-side syntax highlighting. The markup is deliberately returned unsanitized:
 * generated files are untrusted, so it is sanitized at the point of injection in
 * PreviewBrowser — the same place, and the same way, rendered markdown is. Sanitizing
 * here as well would mean a server-side DOM (jsdom), which cannot load in Vercel's
 * serverless runtime (a CommonJS -> ESM require deep in its dependency tree).
 */
export async function highlight(code: string, path: string): Promise<string | null> {
  const lang = languageFor(path);
  if (!lang) return null;
  return codeToHtml(code, { lang, theme: "github-dark-default" });
}
