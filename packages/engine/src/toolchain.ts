// Reading a founder's stack description well enough to run their project. Pure — no I/O, no env.
//
// Airrow derives the commands for the two frameworks it scaffolds itself. For every other stack,
// spec 65 left them to the authoring model and, failing that, to a `[NEEDS CLARIFICATION]` marker.
// That floor turned out to be too low: a founder who answered "stack for mobileapp ios" opened
// their START_HERE and found four markers where every command should have been. Honest, and useless
// — the whole file exists to be run.
//
// So the ladder gains a rung between the model and the marker: what an engineer who had read that
// sentence would write down. It is a lookup rather than a guess — each profile carries the commands
// that ecosystem's own getting-started page gives — and a description nothing here recognises still
// falls through to the marker rather than to an invention.

import type { ToolchainSlot } from "../../schemas/src/authoring.ts";

/**
 * What CI has to install before this project's commands mean anything. `other` means the ecosystem
 * needs no setup step we can name — the runner either has it or the founder finishes that step.
 */
export type Runtime = "node" | "python" | "go" | "dotnet" | "ruby" | "rust" | "java" | "php" | "flutter" | "other";

export interface InferredStack {
  /** Which profile matched. Reported in the scaffold plan so the founder can see the reasoning. */
  id: string;
  /** How the ecosystem is named where a reader expects a name rather than the founder's sentence. */
  label: string;
  runtime: Runtime;
  /** Reproducible install, for CI. */
  install: string;
  /** The official way to start a project in this ecosystem, where there is one `/start` can name. */
  scaffold?: string;
  commands: Record<ToolchainSlot, string>;
}

/**
 * `CMD_TYPECHECK` in an ecosystem with no separate type-check step.
 *
 * It is never a copy of the linter — two identical commands in `CLAUDE.md` and a job that runs the
 * same check twice is worse than a slightly unusual one. It is the strongest *static* check the
 * ecosystem has: the compile step where there is one, and the load/analysis pass where there is not.
 */
interface Profile {
  id: string;
  /** Tried in table order, so a specific ecosystem always beats a general one. */
  match: RegExp;
  stack: (text: string) => InferredStack;
}

const fixed = (stack: InferredStack) => () => stack;

const cmds = (
  dev: string,
  build: string,
  typecheck: string,
  lint: string,
  test: string
): Record<ToolchainSlot, string> => ({
  CMD_DEV: dev,
  CMD_BUILD: build,
  CMD_TYPECHECK: typecheck,
  CMD_LINT: lint,
  CMD_TEST: test
});

/* ── The JavaScript case, which is a family rather than one stack ──────────────
 *
 * Node ecosystems all run through package scripts, so what actually varies is the package manager —
 * and that is the one thing a founder almost always names. Getting it wrong is not cosmetic: `npm
 * ci` in a pnpm project fails on the lockfile, in CI, on the first push.
 */
function jsStack(text: string): InferredStack {
  const manager = /\bpnpm\b/.test(text)
    ? "pnpm"
    : /\byarn\b/.test(text)
      ? "yarn"
      : /\bbun\b/.test(text)
        ? "bun"
        : "npm";
  const run = manager === "npm" ? "npm run" : manager === "bun" ? "bun run" : manager;
  const install =
    manager === "npm"
      ? "npm ci"
      : manager === "bun"
        ? "bun install --frozen-lockfile"
        : `${manager} install --frozen-lockfile`;
  return {
    id: "node",
    label: "Node with TypeScript",
    runtime: "node",
    install,
    commands: cmds(`${run} dev`, `${run} build`, `${run} typecheck`, `${run} lint`, `${run} test`)
  };
}

/**
 * Ordered most specific first. A Django description reaches the Django profile long before the
 * general Python words in it could match anything else, and the bare-mobile catch-all sits last so
 * naming Swift, Kotlin or Flutter always wins over the word "ios".
 */
const PROFILES: readonly Profile[] = [
  {
    id: "flutter",
    match: /\bflutter\b|\bdart\b/,
    stack: fixed({
      id: "flutter",
      label: "Flutter (Dart)",
      runtime: "flutter",
      install: "flutter pub get",
      scaffold: "flutter create .",
      commands: cmds("flutter run", "flutter build apk", "flutter analyze", "dart format --set-exit-if-changed .", "flutter test")
    })
  },
  {
    id: "expo",
    match: /\bexpo\b|react[\s-]?native\b/,
    stack: fixed({
      id: "expo",
      label: "Expo (React Native)",
      runtime: "node",
      install: "npm ci",
      scaffold: "npx create-expo-app@latest . --template blank-typescript",
      commands: cmds("npx expo start", "npx expo export", "tsc --noEmit", "npx expo lint", "npm test")
    })
  },
  {
    id: "swift",
    match: /\bswift(ui)?\b|\bxcode\b/,
    stack: fixed({
      id: "swift",
      label: "Swift",
      // Swift needs Xcode, which the Linux runners the generated CI uses do not have. Saying
      // "other" keeps CI honest about that rather than shipping a job that cannot pass.
      runtime: "other",
      install: "swift package resolve",
      scaffold: "swift package init --type executable",
      commands: cmds("swift run", "swift build -c release", "swift build", "swiftlint", "swift test")
    })
  },
  {
    id: "android",
    match: /\bkotlin\b|jetpack\s*compose|android\s*studio|\bgradle\b/,
    stack: fixed({
      id: "android",
      label: "Kotlin on Android",
      runtime: "java",
      install: "./gradlew --version",
      commands: cmds("./gradlew installDebug", "./gradlew assembleRelease", "./gradlew compileDebugKotlin", "./gradlew lint", "./gradlew test")
    })
  },
  {
    id: "django",
    match: /\bdjango\b/,
    stack: fixed({
      id: "django",
      label: "Django",
      runtime: "python",
      install: "pip install -r requirements.txt",
      scaffold: "django-admin startproject config .",
      commands: cmds("python manage.py runserver", "python manage.py collectstatic --noinput", "mypy .", "ruff check .", "pytest")
    })
  },
  {
    id: "fastapi",
    match: /\bfastapi\b|\bflask\b|\buvicorn\b/,
    stack: fixed({
      id: "fastapi",
      label: "FastAPI",
      runtime: "python",
      install: "pip install -r requirements.txt",
      commands: cmds("uvicorn app.main:app --reload", "python -m compileall app", "mypy .", "ruff check .", "pytest")
    })
  },
  {
    id: "rails",
    match: /\brails\b|\bruby\b/,
    stack: fixed({
      id: "rails",
      label: "Ruby on Rails",
      runtime: "ruby",
      install: "bundle install",
      scaffold: "rails new . --database=postgresql",
      // `zeitwerk:check` loads every constant in the app — the closest Rails has to a type check,
      // and a different failure from what RuboCop catches.
      commands: cmds("bin/rails server", "bin/rails assets:precompile", "bin/rails zeitwerk:check", "bundle exec rubocop", "bin/rails test")
    })
  },
  {
    id: "laravel",
    match: /\blaravel\b|\bphp\b|\bsymfony\b/,
    stack: fixed({
      id: "laravel",
      label: "Laravel (PHP)",
      runtime: "php",
      install: "composer install --no-interaction --prefer-dist",
      scaffold: "composer create-project laravel/laravel .",
      commands: cmds("php artisan serve", "php artisan optimize", "./vendor/bin/phpstan analyse", "./vendor/bin/pint --test", "php artisan test")
    })
  },
  {
    id: "dotnet",
    match: /\.net\b|\bdotnet\b|\bc#|\bcsharp\b|\bblazor\b|entity\s*framework|\befcore\b/,
    stack: fixed({
      id: "dotnet",
      label: "ASP.NET Core (C#)",
      runtime: "dotnet",
      install: "dotnet restore",
      scaffold: "dotnet new webapi",
      commands: cmds("dotnet watch run", "dotnet publish -c Release", "dotnet build --no-restore", "dotnet format --verify-no-changes", "dotnet test")
    })
  },
  {
    id: "spring",
    match: /\bspring\b|\bjava\b|\bmaven\b/,
    stack: fixed({
      id: "spring",
      label: "Spring Boot (Java)",
      runtime: "java",
      install: "./mvnw -B dependency:go-offline",
      commands: cmds("./mvnw spring-boot:run", "./mvnw -B package -DskipTests", "./mvnw -B compile", "./mvnw -B checkstyle:check", "./mvnw -B test")
    })
  },
  {
    id: "rust",
    match: /\brust\b|\bcargo\b|\baxum\b|\bactix\b/,
    stack: fixed({
      id: "rust",
      label: "Rust",
      runtime: "rust",
      install: "cargo fetch",
      scaffold: "cargo init",
      commands: cmds("cargo run", "cargo build --release", "cargo check", "cargo clippy -- -D warnings", "cargo test")
    })
  },
  {
    id: "go",
    match: /\bgolang\b|\bgo\b|\bgin\b|\bfiber\b/,
    stack: fixed({
      id: "go",
      label: "Go",
      runtime: "go",
      install: "go mod download",
      scaffold: "go mod init",
      commands: cmds("go run ./...", "go build ./...", "go build ./...", "go vet ./...", "go test ./...")
    })
  },
  {
    id: "node",
    match: /\bnode\b|\btypescript\b|\bjavascript\b|sveltekit|\bsvelte\b|\bnuxt\b|\bvue\b|\bastro\b|\bremix\b|\bexpress\b|\bhono\b|\bnest(js)?\b|\bangular\b|\breact\b|\bdeno\b|\bbun\b|\bnpm\b|\bpnpm\b|\byarn\b/,
    stack: jsStack
  },
  {
    // Last, and the reason this table starts rather than ends with mobile: "stack for mobileapp
    // ios" names no framework at all, and the interview already says what a mobile app is normally
    // built in. Anyone who names Swift, Kotlin or Flutter has matched long before here.
    id: "mobile",
    match: /\bios\b|\bandroid\b|\bmobile\b/,
    stack: fixed({
      id: "mobile",
      label: "Expo (React Native)",
      runtime: "node",
      install: "npm ci",
      scaffold: "npx create-expo-app@latest . --template blank-typescript",
      commands: cmds("npx expo start", "npx expo export", "tsc --noEmit", "npx expo lint", "npm test")
    })
  }
];

/**
 * The stack a founder's description points at, or `null` when nothing here recognises it.
 *
 * `null` is a real answer, not a failure: it keeps the `[NEEDS CLARIFICATION]` marker for a stack
 * this table has never heard of, which is still better than a command that does not exist.
 */
export function inferStack(description: string): InferredStack | null {
  const text = description.toLowerCase();
  if (text.trim() === "") return null;
  for (const profile of PROFILES) {
    if (profile.match.test(text)) return profile.stack(text);
  }
  return null;
}
