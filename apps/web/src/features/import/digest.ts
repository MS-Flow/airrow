// Peppered content digests for imported files (spec 68). Server-side only.
//
// An imported file is stored as path + size + digest, never as content (spec 63). A raw SHA-256 of
// a short, structured file — a single `.env` line, say — is guessable, so a database leak could
// recover it. Hashing with a pepper that lives in the app's environment and never in the database
// removes that: the stored digest is useless without the key.
//
// The pepper is versioned so it can be rotated without every existing import suddenly reading as
// all-conflicts. `import_sources.digest_version` records which key an import was hashed with.
import crypto from "node:crypto";

/**
 * Digests written before peppering existed: raw SHA-256. Kept so imports made before the rollout
 * keep diffing correctly rather than reporting every generated file as a conflict.
 */
export const LEGACY_DIGEST_VERSION = 0;

const ENV_KEY = "IMPORT_DIGEST_PEPPERS";

/** `"1:<hex>[,2:<hex>]"` → version → secret. Highest version is the one new imports use. */
function keyring(): Map<number, string> {
  const raw = process.env[ENV_KEY];
  const ring = new Map<number, string>();
  if (raw === undefined || raw.trim() === "") return ring;

  for (const entry of raw.split(",")) {
    const separator = entry.indexOf(":");
    if (separator === -1) continue;
    const version = Number.parseInt(entry.slice(0, separator).trim(), 10);
    const secret = entry.slice(separator + 1).trim();
    if (!Number.isInteger(version) || version < 1 || secret === "") continue;
    ring.set(version, secret);
  }
  return ring;
}

/** The version new imports are hashed with. Throws when no pepper is configured. */
export function currentDigestVersion(): number {
  const versions = [...keyring().keys()];
  if (versions.length === 0) {
    throw new Error(
      `${ENV_KEY} is not configured. Set it to "1:<random hex>" — without it, imported file digests would be reversible.`
    );
  }
  return Math.max(...versions);
}

/**
 * The digest function for a stored version. Callers pass this into the engine, which never reads
 * env or crypto itself.
 */
export function digestFor(version: number): (content: string) => string {
  if (version === LEGACY_DIGEST_VERSION) {
    return (content) => crypto.createHash("sha256").update(content, "utf8").digest("hex");
  }
  const secret = keyring().get(version);
  if (secret === undefined) {
    throw new Error(
      `No import digest pepper for version ${version}. Keep retired keys in ${ENV_KEY} so existing imports still diff.`
    );
  }
  return (content) => crypto.createHmac("sha256", secret).update(content, "utf8").digest("hex");
}
