---
name: codex-routing
description: Which Codex model and effort to use for a task, the client version each model needs, the per-run MCP switches and how the automatic plan second opinion works. Read before choosing a model for any Codex call (`codex exec`, the companion, a rescue or review) and before calling a Codex model unavailable.
---

# Codex routing

Choose model and effort explicitly on every call. Escalate when uncertainty or consequences warrant it; never silently downgrade. Higher effort does not replace verification.

## Models and effort

Flag: `-c model_reasoning_effort=<level>`. Sandbox `-s read-only` unless writes are the point.

| Model | Effort | Use |
|---|---|---|
| `gpt-6-luna` | `high` | Mechanical work |
| `gpt-6-luna` | `max` | Bounded, verifiable reasoning |
| `gpt-6-sol` | `xhigh` | Factual research, routine exploration |
| `gpt-6-sol` | `max` | Substantial implementation and test writing from an approved design |
| `gpt-6.2-sol` | `xhigh` | Every review (independent review, second opinion, plan and diagnosis reads), architecture, complex debugging |
| `gpt-6.2-sol` | `high` | Accuracy-critical factual synthesis |
| `gpt-6.2-sol` | `max` | Demanding end-to-end workflows, consequential long-horizon decisions |
| `gpt-6.1-sol` | as 6.2 | Fallback for the 6.2 roles when 6.2 is unavailable, or when a pinned workflow names it |
| `gpt-6.1-terra` | n/a | Desktop computer use, and nothing else |
| `gpt-6.2-astra`, `gpt-6-astra` | n/a | Only when Giordano asks for Astra by name for that task. It drains the Codex allowance, and a past request does not carry over |

- Nothing older than the GPT-6 family.
- **Computer use** (native app windows, Finder, system dialogs) runs only on `gpt-6.1-terra`, whatever the task. If Terra is unavailable, stop those steps and report it; no other model, Claude included, stands in.
- **Websites in Giordano's Chrome** go to Claude in Chrome, never Terra.
- Subagents consult `gpt-6-luna` only, with the command in the subagent guardrails. Sol stays with the main thread.

## Runtime

- The 6.2 family needs codex-cli 0.170 or later. An older client answers 400 "not supported when using Codex with a ChatGPT account": that is the client version, not the account. Before calling a model unavailable, compare `codex --version` with the `codex` bundled in the ChatGPT app and probe with the newer one.
- The plugin `codex@codex-fork` loads live from the working tree at `~/c/claude_setup/plugins/codex-plugin-cc`. The checked-out branch is the install, so checking out another branch there changes the available commands. The `1.0.6-fork.1` entry in `installed_plugins.json` is stale metadata.
- The `codex-guard` hook denies any `codex exec` without `-m` and `-c features.multi_agent_v2.max_concurrent_threads_per_session=1`.

## MCP servers, per run

`linear` and `gitnexus` are `enabled = false` in `~/.codex/config.toml`, as is the `cloudflare` plugin. Turn one on for the run that needs it and leave the file alone:

```bash
codex exec … -c mcp_servers.linear.enabled=true
```

Schemas cost no tokens on calls that never touch a tool; they stay off for startup time and a smaller tool surface.

## Second opinion on plans

- Automatic: every approved plan runs PostToolUse(ExitPlanMode) → `exit-plan-second-opinion-hook.mjs` → `codex-advisor.mjs` (`gpt-6.1-sol` at `high`) and arrives as additional context. Weigh it before executing.
- Off switch: `touch ~/.claude/cache/codex-advisor/plan-hook-off` (remove the file to turn it back on), or `CODEX_PLAN_OPINION_DISABLE=1`. Overrides: `CODEX_ADVISOR_MODEL`, `CODEX_ADVISOR_EFFORT`.
- Manual: `/codex:second-opinion [--force]` for a drafted plan not yet approved, or a fresh opinion past the one-per-subject dedup.
- If a built-in `advisor()` verdict appears, run `node ~/c/claude_setup/plugins/codex-plugin-cc/plugins/codex/scripts/codex-advisor.mjs` once before continuing (Bash timeout about 300000 ms). The Stop-hook backstop forces it if forgotten.
- `[codex-advisor] …skipping/unavailable`: ignore and proceed.
- `codex-advisor.mjs` is main-thread only: it needs the approved plan file or the main session's transcript, so a subagent running it gets nothing.
