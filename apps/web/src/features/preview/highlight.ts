import { codeToHtml } from "shiki";
import DOMPurify from "isomorphic-dompurify";

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
 * Server-side syntax highlighting. Generated files are untrusted text, so the
 * highlighter's HTML goes through the same sanitizer as rendered markdown —
 * shiki must never become an injection route.
 */
export async function highlight(code: string, path: string): Promise<string | null> {
  const lang = languageFor(path);
  if (!lang) return null;
  const html = await codeToHtml(code, { lang, theme: "github-dark-default" });
  return DOMPurify.sanitize(html);
}
