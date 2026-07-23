# ADR-0001: Next.js App Router for Arrow's application

> Status: Accepted · Date: 2026-07-23

## Context

Arrow needs marketing pages, an authenticated app, server-side generation orchestration, and API surface — and dogfoods the golden path it recommends to customers. Candidates: Next.js (App Router) vs Vite + React SPA.

## Options Considered

1. **Next.js App Router** — one codebase for marketing (static/SSR), app (RSC), and server logic (Server Actions/Route Handlers). Vercel-native. Heavier mental model.
2. **Vite + React** — faster dev loop, simpler model; but requires a separate backend for generation jobs and SSR-less marketing pages; splits the stack.

## Decision

Next.js App Router. It serves all three surfaces in one deployable, is Vercel-native, and is the stack we recommend hardest to customers — Arrow must run on it to keep its opinions honest. (Founder decision, 2026-07-23.)

## Consequences

Server-first component discipline required (see CODING_STANDARDS). Generated projects default to Next.js with Vite offered where a SPA genuinely fits. Engine remains framework-agnostic in `packages/engine`.
