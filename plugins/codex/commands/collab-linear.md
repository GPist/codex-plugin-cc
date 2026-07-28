---
description: Run the Claude⇄Codex teamlet — Linear as the control plane, git worktrees as the execution plane
argument-hint: "[GIO-n | sweep | task description]"
allowed-tools: Bash(node:*), Bash(git:*), Read, Grep, Glob
---

Orchestrate the two-agent teamlet. Linear (team "Giordano") is the single source of truth: issues are assignments, comments are the mailbox, workflow states are the lifecycle. The wrapper is `node "${CLAUDE_PLUGIN_ROOT}/scripts/collab-linear.mjs"` — run it from inside the target repo.

**1. Determine the work**
- `$ARGUMENTS` names an issue (e.g. `GIO-7`): work that issue.
- `sweep`: list Todo issues labeled `agent:codex` (Linear MCP) and work them oldest-first.
- Otherwise treat `$ARGUMENTS` as a new task: create the issue first (label `agent:codex`, state Todo, project "Teamlet"). The description MUST contain: absolute repo path, the task, and concrete acceptance criteria — Codex sees the issue thread, not this conversation.

**2. Launch (per issue)**
- Slug = kebab-case from the issue title (≤5 words).
- `collab-linear.mjs worktree <slug>` → move the issue to In Progress (Linear MCP).
- `collab-linear.mjs run <slug> --issue <ID> "<task text from the issue>"` — Bash timeout 600000ms; use `run_in_background` for long tasks. Codex fetches the issue thread itself via its Linear MCP, posts start/final comments, and sets In Review.

**3. Review (the gate — never skip)**
- Read Codex's final comment (Linear MCP) and the `final`/`log` files the wrapper printed.
- Review the actual diff yourself: `git -C <worktree> log --oneline`, `git -C <worktree> diff <base>...HEAD`, Read the changed files. A comment claiming success is not evidence.
- Post a review comment on the issue starting exactly `approve` or `request-changes:` followed by specifics.

**4. Close or iterate**
- `request-changes` → `collab-linear.mjs run <slug> --issue <ID> "Address the review feedback in the latest issue comments."` and re-review.
- `approve` → `collab-linear.mjs merge <slug>` (merges into the repo's CURRENT branch — check it first; never merge to main unless the user's workflow for that repo allows it), move the issue to Done, comment `merged <sha>`.

**Reversed roles** (issues labeled `agent:claude`): you implement in a worktree yourself, then get the review from Codex (`/codex:review` against the worktree, or a read-only `run` with a review task). The gate is unchanged: merge only on the peer's `approve` comment.

**Rules**
- Never merge without the peer's `approve` comment on the issue; never set Done before merge.
- All coordination happens on the issue thread — no side channels; the board must tell the whole story.
- One issue = one worktree = one branch (`codex/<slug>`). Abandon with `collab-linear.mjs remove <slug>` + a comment explaining why.
