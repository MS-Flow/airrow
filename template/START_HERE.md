# Start here — {{PROJECT_NAME}}

**{{PROJECT_TAGLINE}}**

This foundation ships the rules, workflow and documentation for {{PROJECT_NAME}}. It does not ship the
application — that part is yours. You stay in control of the code: what gets built from here is
decided one spec at a time, by you, with an AI assistant doing the typing. The steps below are in the
order that works: get the foundation working, then connect the accounts, then start building.

### How the commands work

Everything written as `/something` in this guide — `{{FIRST_COMMAND}}`, `/createspec`, `/clarify`,
`/implement`, `/analyze`, `/push`, `/pr-check`, `/security` — is a file in
[`.claude/commands/`](.claude/commands), not a program on your machine.
Claude Code is what this foundation is built for.

- Type the command as an ordinary message, e.g. `/createspec "add sign-in"`.
- The assistant reads the matching file and follows it — asking you questions where it needs to,
  running `git`, your package manager, and everything else itself, inside the conversation.

---

## 1. Get it running

{{FIRST_STEP}}

```bash
{{CMD_DEV}}        # start the dev server
{{CMD_TYPECHECK}}  # type check
{{CMD_LINT}}       # linter
{{CMD_TEST}}       # tests
```

If all four are clean, the foundation is working. This is the **verification bar** — every change you
make from here has to pass it before it merges.

## 2. Connect what needs an account

The full walkthrough — every key, every screen, and how to verify it worked — is
[docs/guides/DEVELOPER_GUIDE.md § Getting to a deployed product](docs/guides/DEVELOPER_GUIDE.md#getting-to-a-deployed-product);
the steps below are the short version.

{{SETUP_STEPS}}

Branch direction is strict and never skipped —
[docs/architecture/BRANCHING.md](docs/architecture/BRANCHING.md) has the full model.

## 3. Read these five files, in this order

| #   | File                                                                         | Why                                                   |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | [CLAUDE.md](CLAUDE.md)                                                       | What your AI assistant reads first, every session     |
| 2   | [.claude/spec-kit/constitution.md](.claude/spec-kit/constitution.md)         | The rules. When anything disagrees with it, it wins   |
| 3   | [docs/VISION.md](docs/VISION.md)                                             | What you're building and where it goes                |
| 4   | [docs/architecture/SYSTEM_OVERVIEW.md](docs/architecture/SYSTEM_OVERVIEW.md) | How the system is shaped                              |
| 5   | [docs/architecture/UI_ARCHITECTURE.md](docs/architecture/UI_ARCHITECTURE.md) | What it looks like, and how someone moves through it  |

Read them yourself - Your assistant reads them and updates them too, which is why keeping them current
matters more than keeping them long.

## 4. Write your first spec

### What a spec is, and when you write one

**A spec is a thing you want to add to {{PROJECT_NAME}}, written down before it is built.** Not a
document you write once — one spec per change, forever. Step 1 got you to a starting point;
_everything_ you add after it arrives this way.

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

**Outside the loop: `/security`.** It reads the whole project, fixes the security holes that can be
closed without changing anything you would notice, asks before anything that would, and writes
`SECURITY_AUDIT.md` — what it fixed, what it found, and what is still open. That file is gitignored on
purpose: it is a list of the ways in that are still there, and it belongs on your machine, not in your
repository. Run it whenever something new is exposed to the internet — and before you launch.

## 6. When something is unclear

Anything the interview could not answer is marked `[NEEDS CLARIFICATION: …]` in these files. Nothing
was invented to fill a gap. Search for that marker, decide, and replace it — that is your first
five minutes of work.
