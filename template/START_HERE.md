# Start here — {{PROJECT_NAME}}

**{{PROJECT_TAGLINE}}**

This foundation ships the rules, workflow and documentation for {{PROJECT_NAME}}. It does not ship the
application — you write that, with an AI assistant, one spec at a time. The steps below are in the
order that works: get something running, then connect the accounts, then start building.

---

## 1. Get it running

Open your AI assistant in this repository and run:

```
/start
```

It scaffolds the stack, wires the toolchain, initialises git locally, and leaves you the smallest
version of {{PROJECT_NAME}} that actually runs — enough to open, change and continue from, and no
more. It touches nothing outside this directory: no accounts, no services, no secrets. It is safe to
run again.

When it finishes, these are real commands:

```bash
{{CMD_DEV}}        # start the dev server
{{CMD_TYPECHECK}}  # type check
{{CMD_LINT}}       # linter
{{CMD_TEST}}       # tests
```

If all four are clean, the foundation is working. This is the **verification bar** — every change you
make from here has to pass it before it merges.

## 2. Connect what needs an account

These need a human and, usually, a credit card. `/start` deliberately does none of them.

{{SETUP_STEPS}}

Branch direction is strict and never skipped —
[docs/architecture/BRANCHING.md](docs/architecture/BRANCHING.md) has the full model.

## 3. Read these four files, in this order

| #   | File                                                                         | Why                                                 |
| --- | ---------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | [CLAUDE.md](CLAUDE.md)                                                       | What your AI assistant reads first, every session   |
| 2   | [.claude/spec-kit/constitution.md](.claude/spec-kit/constitution.md)         | The rules. When anything disagrees with it, it wins |
| 3   | [docs/VISION.md](docs/VISION.md)                                             | What you're building and where it goes              |
| 4   | [docs/architecture/SYSTEM_OVERVIEW.md](docs/architecture/SYSTEM_OVERVIEW.md) | How the system is shaped                            |

Read them yourself — they are short. Your assistant reads them too, which is why keeping them current
matters more than keeping them long.

## 4. Write your first spec

### What a spec is, and when you write one

**A spec is a thing you want to add to {{PROJECT_NAME}}, written down before it is built.** Not a
document you write once — one spec per change, forever. `/start` left you the smallest thing that runs;
_everything_ after it arrives this way.

That means every one of these:

| You want to…                                       | Yes, that is a spec |
| -------------------------------------------------- | ------------------- |
| Add a screen, a page, a form                       | ✅                  |
| Change how something already looks or behaves      | ✅                  |
| Add a feature — sign-in, search, uploads, payments | ✅                  |
| Add or change a table, a field, an API endpoint    | ✅                  |
| Wire up a third-party service                      | ✅                  |
| Fix a bug that is more than a typo                 | ✅                  |

UI and functionality alike. There is no "too small to spec".

**Why bother.** An assistant with no spec optimises for looking finished. It invents requirements you
never gave it, quietly changes decisions you made last week, and produces something plausible that
nobody can review — because there is nothing to review it _against_. A spec is what turns "does this
look right?" into "does this match what we agreed?". It is also what your assistant reads in three
months when neither of you remembers why the thing works the way it does.

**No spec, no code.** That single rule is what keeps an AI assistant from wandering, and it is the
reason this foundation exists at all.

### Writing one

{{FIRST_SPEC_HINT}}

Run:

```
/createspec "<the first thing you're building>"
```

It scaffolds `specs/NNN-kort.md` and sets up the branch. You answer the questions; it writes the spec.
Anything you have not decided is left as a `[NEEDS CLARIFICATION]` marker rather than guessed — then
`/clarify` walks you through them, one question at a time, before a line of code exists.

## 5. The loop you repeat from now on

| Step | Command                                 | What happens                                                            |
| ---- | --------------------------------------- | ----------------------------------------------------------------------- |
| 1    | `/createspec <issue# \| "description">` | Scaffold the spec, create the issue branch                              |
| 2    | `/clarify`                              | Resolve every `[NEEDS CLARIFICATION]` marker before code exists         |
| 3    | `/implement`                            | Plan the exact changes, write them, add tests, run the verification bar |
| 4    | `/analyze`                              | Cross-check spec ↔ code ↔ constitution, then close the spec             |
| 5    | `/push`                                 | Commit and push the issue branch                                        |
| 6    | `/pr-check`                             | Merge-safety check, then open the PR into your `feature/<name>`         |

That is the whole workflow, and it is the same six steps whether you are adding a button or a billing
system. Repeat it per change and the documentation stays true as the codebase grows — which is the
only reason an assistant is still useful to you in month six.

## 6. When something is unclear

Anything the interview could not answer is marked `[NEEDS CLARIFICATION: …]` in these files. Nothing
was invented to fill a gap. Search for that marker, decide, and replace it — that is your first
five minutes of work.
