# Coding Standards

## TypeScript

- `strict: true` everywhere. `any` is forbidden; use `unknown` + narrowing. `as` casts require a comment justifying them.
- Types live with their feature; shared types in `packages/schemas`. Zod schemas are the source of types (`z.infer`) wherever data crosses a boundary.
- Prefer discriminated unions over booleans-with-meaning. Prefer `Result`-style returns over thrown exceptions in the engine.

## Structure

- Feature-module organization (see UI_ARCHITECTURE.md). Routes are thin; logic lives in features; pure logic in packages.
- `packages/engine` and `packages/schemas` never import from `apps/*` or use runtime environment directly (config injected).
- One export per concern; no barrel files that hide dependency graphs; no circular imports (enforced by lint).

## React / Next.js

- Server Components by default; `"use client"` only with a reason. Mutations via Server Actions with Zod-validated inputs.
- No `useEffect` for data fetching. Loading/error/empty states are explicit components, not conditionals scattered in JSX.
- Component files: PascalCase; hooks `useX`; server actions in `actions.ts`; queries in `queries.ts`.

## Style

- Prettier + ESLint (typescript-eslint strict, import ordering) — CI-enforced; no debate in review about formatting.
- Naming: intention-revealing, no abbreviations (`generationJob`, not `genJob`). Constants in one place per feature.
- Functions small and single-purpose. Comments explain *why*, never *what*. Dead code is deleted, not commented out.

## Data access

- All Supabase access through the feature's `queries.ts`/`actions.ts` using typed clients. No queries in components.
- Every table has RLS; server code still scopes queries explicitly (defense in depth).
- Migrations are the only way schema changes happen; committed in `supabase/migrations`.

## AI-assisted work

- AI-generated code is held to the same standard and is reviewed against the spec like any code.
- When code and spec disagree, stop and fix the spec first (Engineering Constitution §2).
