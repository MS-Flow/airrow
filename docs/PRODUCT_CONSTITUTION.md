# Airrow — Product Constitution

Non-negotiable product principles. Every feature, screen, and generated file is judged against these. Amendments require an ADR.

## 1. Preparation, not implementation

Airrow generates everything required *before* serious implementation begins — never the implementation itself. If a feature drifts toward being an app builder, it is out of scope.

## 2. The output is the product

Users judge Airrow by the repository it produces. Generated output must read like it was written by a senior CTO for this specific project — never like a filled-in template. Generic output is a bug of the highest severity.

## 3. Specifications are the source of truth

In every Airrow-generated project (and Airrow itself): specs drive code, code implements specs, docs explain specs. Nothing ships without a spec.

## 4. Never make the AI guess

Every generated repo must let an AI assistant instantly understand the business, architecture, progress, standards, and constraints from files in the repo. Context lives in the repository, not in anyone's head.

## 5. Adaptive, never bureaucratic

The interview asks only questions whose answers change the output. Every answer must improve the generated foundation. If removing a question doesn't change the result, remove the question.

## 6. Opinionated defaults, deliberate escape hatches

Airrow recommends a golden path (Next.js, TypeScript, Tailwind, shadcn/ui, Supabase, Vercel, GitHub, Claude Code) with confidence. Choices exist only where they genuinely matter (framework, repo provider). We do not offer options to seem flexible.

## 7. Premium in every pixel

Design bar: Linear, Vercel, Stripe. Dark mode first. Fast, minimal, elegant. If a screen wouldn't look at home in those products, it isn't done.

## 8. The founder must succeed after Airrow

Airrow's job isn't finished at download. Generated projects include the onboarding, guides, and workflow that carry a founder through months of AI-assisted development. We optimize for the user's month two, not their minute ten.

## 9. Airrow is built with Airrow

Airrow is the reference implementation of its own methodology. If a practice is too heavy for us, we don't generate it for customers. If we discover a better practice, both Airrow and its output adopt it.

## 10. Trust through transparency

Users can preview everything before download. No lock-in: output is plain files in an open structure that works with any AI assistant, even though Claude Code is the primary target.
