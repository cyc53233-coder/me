# CLAUDE.md

## What this repository is

A personal agent-skills library. It ships **29 skills** as prose — no application code, no build, no tests, no dependencies, no runtime. Every file is a `SKILL.md` that an agent reads and follows; changing this repo means changing prose that changes agent behavior.

The skills are hygiene and judgment reflexes for agentic work: check the read before spending, attack a plan before building it, cold-read your own output, keep one truth in one place, restart from lessons rather than from code.

Two provenances live side by side:

- **28 skills** are the complete `LilMGenius/paperthin` catalog. They share one voice, one file shape, and a set of cross-skill contracts (below). Treat them as a single coherent suite.
- **`find-skills`** comes from the open skills ecosystem (`npx skills`). It follows different conventions and is the one intentional outlier — do not "fix" it into paperthin's shape.

## Layout

```text
.claude/skills/<skill-name>/SKILL.md    # 29 directories, one file each
CLAUDE.md                               # this file
```

That is the entire repository. There are no assets, scripts, subdirectories, or reference files under any skill. Claude Code discovers `.claude/skills/` automatically from the project root; the directory name is the skill's invocation name and must match its frontmatter `name`.

## How skills fire

Invocation mode is the single most important property of a skill, and it is set by one frontmatter key.

**Model-invoked (17)** — no `disable-model-invocation` key. The agent fires these on its own when the `description` matches the situation:

`aim`, `autobahn`, `catchup`, `detool`, `factchk`, `find-skills`, `mandela`, `modelchk`, `nba`, `re0`, `re0-loop`, `re0-memo`, `re0-work`, `readchk`, `shower`, `sip`, `ssotize`

**User-invoked (12)** — `disable-model-invocation: true`. Only a human fires these, deliberately:

`debloat`, `dedash`, `feynman`, `hate`, `macrothink`, `prism`, `re0-git`, `re0-merge`, `re0-plan`, `re0-release`, `re0-upgrade`, `reorder`

The split is a design decision, not an accident. The pattern: a reflex that would bias the agent if always in reach is gated behind a human. `hate` would bias toward demolition, `feynman` toward chronic self-doubt, `re0-git` toward committing when it shouldn't, `prism` and `macrothink` toward spending fan-out that must never masquerade as proof — each of those says so in its own text. The rest (`debloat`, `dedash`, `reorder`, `re0-upgrade`) are gated without stating why; they are narrow, scope-owned mutations a human should aim deliberately.

**Never auto-invoke a user-invoked skill.** `sip` and `nba` both say this outright: they name the skill for the human to fire instead of firing it themselves.

Because these 12 are hidden from model invocation, they do not appear in an agent's available-skills listing. Read the directory, not the listing, to know what this repo carries.

## SKILL.md anatomy

Every paperthin skill follows the same shape. Match it exactly when editing or adding one.

```markdown
---
name: <matches the directory name>
description: "<what it does> — <when to use it>"
disable-model-invocation: true   # only if user-invoked; omit entirely otherwise
---

<One-line imperative statement of the skill, directly under the frontmatter. No H1.>

## Goal
## Workflow
## Rules
## Verification
```

Conventions that hold across the suite:

- **No H1 heading.** The line under the frontmatter is a bare imperative sentence. (`find-skills` uses an H1 — it is the outlier.)
- **`description` is the trigger.** For model-invoked skills it is the only thing that decides whether the skill fires, so it states the behavior *and* the conditions, usually with an explicit "Use when…". Some go further and name the felt signal — `autobahn` fires on "the moment you notice yourself about to hedge", `factchk` on "metacognitive doubt". Write descriptions for recall, not for elegance.
- **Four sections, in order.** Extra sections are earned, not default: `mandela` adds "The 8 leakage patterns", `modelchk` adds "Output", `re0-upgrade` adds "Deprecations" and "Current catalog". Do not add sections a skill has not earned.
- **`Verification` is a self-check the agent runs before finishing**, not a test suite. It is written as numbered conditions to confirm, and it is where each skill's failure mode is named.
- **Voice**: imperative, second person, terse. Skill names and paths in backticks. Terms of art bolded on definition. Rules are one-line assertions, not paragraphs.
- **Self-contained by default.** A skill should work when installed alone, so it avoids naming siblings as dependencies. `re0-plan` is the deliberate exception and says so in its Rules.
- **One source line per paragraph and per list item.** 28 of the 29 files are unwrapped — no hard line breaks mid-sentence, however long the line gets (`re0-git`'s longest runs 973 characters). `catchup` is the lone hard-wrapped file. `re0`'s workflow calls unwrapping "source noise" cleanup and says to match how sibling artifacts format theirs, so match the majority. This file follows the same rule.

## Cross-skill contracts

These named conventions recur verbatim across skills. When you edit one copy, check the others — they are shared vocabulary, and drift between them is a real defect (`ssotize` exists for exactly this, and `re0-release` lists coherence across copies as a ship gate).

- **edit-safety** (`re0`, `ssotize`, `detool`, `debloat`, `dedash`, `reorder`, `re0-release`) — the mutation contract: assert each target exists and **report a MISS rather than silently no-op**; edit unicode-safe (`PYTHONUTF8=1`); replace **per occurrence, never by blanket sweep**; script large structural moves instead of sweeping by hand.
- **negatives-as-corpus** (`autobahn`, `re0-plan`, `re0-merge`, `re0-release`, and as "negative corpus" in `re0-loop`, `re0-memo`, `re0-work`) — failed paths, declined contributions, and descoped material are archived with their cause of death and safe replacement. Nothing is deleted; a later cycle mines them to prove the anti-pattern is gone.
- **commit-economy** (`re0-git`, `re0-release`) — one bullet per real, durable change, supporting edits folded in, nothing the diff or version already proves, matched to the local log's shape.
- **A pass that finds nothing changes nothing** (`re0`, `ssotize`, `detool`, `debloat`, `factchk`, each phrasing it for its own target) — an empty finding is a valid result. Never invent drift to justify a mutation.
- **Fresh-context isolation** (`shower`, `feynman`, `macrothink`, `prism`, `autobahn`, optionally `mandela`) — the judging mind must never be the one that made the thing. These skills hand an artifact's *contents* to a context-free subagent and withhold the author's intent, because a session cannot un-see what it built. Self-assessing in-session defeats the skill entirely.
- **Roots over instances** (`macrothink`, `hate`, `prism`, `mandela`, `re0-memo`, `nba`) — collapse many findings into the one load-bearing root and return that. A checklist is the failure mode; several of these skills return exactly one item by design.
- **Approval gates** (`ssotize`, `autobahn`, `re0-upgrade`, `re0-release`) — audit read-only, report the plan, mutate only after explicit confirmation. `re0-release` stakes two separate confirmations because commit is local and reversible while tag-and-push is public.
- **Read-only means read-only** — `catchup`, `nba`, `mandela`, `modelchk`, and `macrothink` declare it in so many words; `shower` ("it diagnoses, it does not fix"), `hate` ("attack, don't improve"), and `prism` hold the same line without the label. All eight brief, diagnose, or recommend, and hand the fixing back to the calling session. They do not edit, execute, or decide.

## The catalog by function

**Before spending work** — `readchk` (did I understand the instruction?), `aim` (propose the intent behind thin data), `modelchk` (size the capability tier and reasoning effort).

**Pressure-testing** — `hate` (one load-bearing objection plus the cheapest falsification), `macrothink` (strip the session's bait, fan out fresh reads, report divergence first), `feynman` (press a just-made decision until you can explain it), `prism` (2–5 independent lenses, return where they disagree), `mandela` (8-pattern leakage audit on any eval or metric), `factchk` (verify reality-grounded claims in both directions).

**Cleaning artifacts** — `re0` (refresh into a clean v0), `debloat` (compress to load-bearing density), `dedash` (remove em-dashes per grammatical role), `detool` (strip incidental stack coupling), `reorder` (realign a listing under one principle), `ssotize` (one fact, one home). These are deliberately narrow, non-overlapping reflexes — `debloat` spells the boundaries out, disclaiming `re0`'s rewrite, `ssotize`'s dedup, and `dedash`/`detool`'s tell-removal. Route a task to the narrowest one that fits rather than blending them.

**Self-check** — `shower` (cold-read from a context-free subagent), `sip` (after you make anything, run this repo's own skills on it before serving it — the recursive loop, and the closest thing to a default quality gate here).

**The long cycle** — `re0-plan` opens an iteration, `re0-loop` runs `FRAME → BUILD → DRIVE → RE0-MEMO → HATE → RE0-WORK → BUILD AGAIN`, `re0-memo` extracts lessons, `re0-work` restarts from what was proven, `nba` returns the single next action when the cycle stalls, `catchup` rebuilds a returning human's context from live state.

**Shipping and collaboration** — `re0-git` (rewrite a finished commit message), `re0-release` (the full ship checklist, tag, publish), `re0-merge` (land an external contribution with credit intact), `re0-upgrade` (converge an install on the current catalog).

**Scope safety** — `autobahn` (carve guardrail-adjacent items out with safe alternatives, then run the safe remainder at full strength in a subagent that never sees the risky input).

**Ecosystem** — `find-skills` (search and install from `npx skills`).

## Working in this repo

**Editing a skill.** Read the whole `SKILL.md` first — they are 28–141 lines, so there is no excuse for a partial read. Keep the four-section shape and the voice. If your edit touches a cross-skill contract, grep for the term and update every copy in the same change. Prefer editing an existing Rule over appending a new one; `re0`'s own guidance applies to this repo's files.

**Adding a skill.** Create `.claude/skills/<name>/SKILL.md` with `name` matching the directory. Decide invocation mode explicitly and justify a `disable-model-invocation: true` in the skill's own text. Write the `description` as behavior plus trigger. Check the new skill does not duplicate an existing one — the suite's own bar (`re0-merge`) is that an addition must show the set is worse without it.

**Verifying a change.** There is nothing to run — no linter, no test, no build. Verification is reading. The house method is `sip`: cold-read it (`shower`), check truth claims (`factchk` / `mandela`) if it makes any, check consistency across copies (`ssotize`, audit first), tidy (`re0`). Since a skill's real behavior is "does the agent fire it at the right moment and follow it", the meaningful check is whether a fresh agent reading the file alone would do the right thing.

**Git.** Branch work off `main`. Commit subjects are short and imperative (`Add paperthin skill pack (29 skills)`). Apply commit-economy: one bullet per durable change, nothing the diff already proves. Note that `re0-git`'s commit-economy rules out co-author trailers while this harness mandates one — the harness trailer wins for commits made here; do not treat the existing trailer in history as a violation to clean up.

## What is not here, on purpose

Four skills — `re0-plan`, `re0-release`, `re0-merge`, `re0-upgrade` — are written for the *upstream paperthin maintainer repository* and reference infrastructure this repository does not have: `package.json`, `plugin.json`, `scripts/catalog.cjs`, a README plus localized copies under `docs/readme/`, `.re0/iteration/` cycle folders, signed release tags, and a release workflow.

**Do not create any of that to satisfy them, and do not run `re0-release` against this repository.** Those skills are installed here as reflexes to use on *other* projects, not as a description of this one. When `re0-plan` and `re0-release` cite "CLAUDE.md's Shipping checklist" or "CLAUDE.md's docs-role split", they mean upstream paperthin's CLAUDE.md — not this file. This repository has no README and no shipping process; CLAUDE.md is its only documentation surface.

Likewise, `re0-upgrade`'s "Current catalog" and "Deprecations" tables are the upstream rename SSOT. This repo's 28 paperthin directories match that catalog exactly, with `find-skills` as the 29th. If you add or rename a skill here, that alignment is yours to track — nothing in this repo enforces it.
