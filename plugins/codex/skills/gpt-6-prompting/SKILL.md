---
name: gpt-6-prompting
description: Internal guidance for composing Codex and GPT-6 prompts (Sol 6.1, Sol, Luna, Astra) for coding, review, diagnosis, and research tasks inside the Codex Claude Code plugin
user-invocable: false
---

# GPT-6 Prompting

Use this skill when `codex:codex-rescue` needs to ask Codex or another GPT-6-based workflow for help.

Model selection (GPT-6 family; `gpt-6.1-sol` requires codex-cli >= 0.159):
- `gpt-6.1-sol` — current workhorse, near-Astra quality at lower cost. Default for delegated coding, review, diagnosis, and research tasks.
- `gpt-6-sol` — previous-generation Sol. Use it where the caller's routing names it.
- `gpt-6-luna` — fast tier. Focused, high-volume tasks where you know what a good result looks like: mechanical transforms, quick lookups, prescribed checks.
- `gpt-6-astra` — frontier tier and the heaviest on the Codex allowance. Use it only when the user asks for Astra by name for that task.
- Reasoning effort: the GPT-6 scale is `low`/`medium`/`high`/`xhigh`/`max`. Default `high` for Sol, always passed explicitly via `-c model_reasoning_effort="high"` — the CLI's own default for `gpt-6.1-sol` is `low`. `none` and `minimal` are rejected by `gpt-6.1-sol` and `gpt-6-astra`; do not pass them even though the companion's `--effort` flag still lists them. The companion caps at `xhigh`; `max` requires a direct `-c model_reasoning_effort` config.
- `ultra` (Sol and Astra) adds automatic task delegation on top of maximum reasoning and multiplies usage. Never select it unless the user asks for it.
- Prefer tightening the prompt contract before raising model tier or effort.

Prompt Codex like an operator, not a collaborator. Keep prompts lean: OpenAI measured ~10-15% better evals and 41-66% fewer tokens from leaner system prompts on GPT-5.6. State each instruction exactly once — OpenAI describes GPT-6 as more sensitive to its instructions than GPT-5.6, so a repeated or conflicting rule costs reasoning tokens and can change behaviour. Use XML-tagged blocks only where they add a real contract.

GPT-6 behaviour to prompt around (from OpenAI's GPT-6 Astra guide; OpenAI publishes no separate prompting guidance for Sol or Luna):
- It stops to ask more readily than GPT-5.6. For a run that should finish unattended, say which assumptions it may make on its own and tell it to complete the work already authorized before asking anything. `default_follow_through_policy` is the block for this.
- It leans toward detailed, formatted answers: lists, tables, headers. Where the caller needs prose, ask for short paragraphs with lists only for parallel or sequential items.
- It leans toward thorough testing. For a small change, name the checks that are required so it does not write tests that mirror the implementation.
- Do not tell it to delegate to other agents unless the user wants that; delegation multiplies usage.


Core rules:
- Start every prompt with one plain-text title line (≤50 chars, e.g. `Fix flaky auth test retry logic`) before any XML block. The companion names the persistent Codex thread from the prompt's first characters, and that name is what appears in the `codex resume` picker and the Codex desktop app — a leading `<task>` tag turns every thread name into identical noise.
- Prefer one clear task per Codex run. Split unrelated asks into separate runs.
- Tell Codex what done looks like. Do not assume it will infer the desired end state.
- State what the run is authorized to do. Review, diagnosis, explanation, and planning requests mean inspect and report — say no changes are authorized. Write-capable runs get the inverse: name the authorized change scope.
- Add explicit grounding and verification rules for any task where unsupported guesses would hurt quality.
- Do not add blanket brevity orders; constrain length only where a specific output shape requires it.
- Prefer better prompt contracts over raising reasoning or adding long natural-language explanations.

Default prompt recipe:
- `<task>`: the concrete job and the relevant repository or failure context.
- `<structured_output_contract>` or `<compact_output_contract>`: exact shape, ordering, and brevity requirements.
- `<default_follow_through_policy>`: what Codex should do by default instead of asking routine questions.
- `<verification_loop>` or `<completeness_contract>`: required for debugging, implementation, or risky fixes.
- `<grounding_rules>` or `<citation_rules>`: required for review, research, or anything that could drift into unsupported claims.

When to add blocks — pick at most one block per concern; overlapping blocks (`completeness_contract` vs `verification_loop`, a brevity line repeated across contracts) cost tokens and can conflict:
- Coding or debugging: add `verification_loop`; add `missing_context_gating` only when guessing is a real risk.
- Review or adversarial review: add `grounding_rules` and `structured_output_contract`; add `dig_deeper_nudge` only for adversarial passes.
- Research or recommendation tasks: add `research_mode` and `citation_rules`.
- Write-capable tasks: add `action_safety` so Codex stays narrow and avoids unrelated refactors.
- Every run: state the authorization boundary — inline in `<task>` or via the `authorization_boundary` block.

How to choose prompt shape:
- Use built-in `review` or `adversarial-review` commands when the job is reviewing local git changes. Those prompts already carry the review contract.
- Use `task` when the task is diagnosis, planning, research, or implementation and you need to control the prompt more directly.
- Use `task --resume-last` for follow-up instructions on the same Codex thread. Send only the delta instruction instead of restating the whole prompt unless the direction changed materially.

Working rules:
- Prefer explicit prompt contracts over vague nudges.
- Use stable XML tag names that match the block names from the reference file.
- Do not raise reasoning or complexity first. Tighten the prompt and verification rules before escalating.
- Ask Codex for brief, outcome-based progress updates only when the task is long-running or tool-heavy.
- Keep claims anchored to observed evidence. If something is a hypothesis, say so.

Prompt assembly checklist:
1. Define the exact task and scope in `<task>`.
2. Choose the smallest output contract that still makes the answer easy to use.
3. Decide whether Codex should keep going by default or stop for missing high-risk details.
4. Add verification, grounding, and safety tags only where the task needs them.
5. Remove redundant instructions before sending the prompt.

Reusable blocks live in [references/prompt-blocks.md](references/prompt-blocks.md).
Concrete end-to-end templates live in [references/codex-prompt-recipes.md](references/codex-prompt-recipes.md).
Common failure modes to avoid live in [references/codex-prompt-antipatterns.md](references/codex-prompt-antipatterns.md).
