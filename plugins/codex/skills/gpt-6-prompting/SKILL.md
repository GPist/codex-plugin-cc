---
name: gpt-6-prompting
description: Internal guidance for composing Codex and GPT-6 prompts (Sol 6.2, Sol 6.1, Sol, Luna, Astra) for coding, review, diagnosis, and research tasks inside the Codex Claude Code plugin. Read before writing any Codex prompt.
user-invocable: false
---

# GPT-6 Prompting

Use this skill before composing any prompt for Codex or another GPT-6 workflow: a rescue, a review, a diagnosis, a research run or a direct Codex CLI call.

Model and effort: the `codex-routing` skill holds the table (which model for which task, the client version each needs, the Astra and Terra rules). Read it first. What matters for the prompt itself:
- Reasoning effort runs `low`/`medium`/`high`/`xhigh`/`max` and is always passed explicitly with `-c model_reasoning_effort="<level>"`: the CLI's own default for `gpt-6.1-sol` is `low`. Sol and Astra reject `none` and `minimal`, though the companion's `--effort` flag still lists them. The companion caps at `xhigh`; `max` needs the direct `-c` config.
- `ultra` (Sol and Astra) lets Codex bring in sub-agents on its own and multiplies usage. Never select it unless the user asks for it.
- Tighten the prompt contract before raising model tier or effort. Higher effort mainly buys persistence through the final checks of a long task.

Prompt Codex like an operator, not a collaborator. Keep prompts lean: OpenAI measured ~10-15% better evals and 41-66% fewer tokens from leaner system prompts on GPT-5.6. State each instruction exactly once — OpenAI describes GPT-6 as more sensitive to its instructions than GPT-5.6, so a repeated or conflicting rule costs reasoning tokens and can change behaviour. Use XML-tagged blocks only where they add a real contract.

Behaviour to prompt around. OpenAI writes its guidance for Astra and states that the 6.2 guidance applies to Sol 6.2 too; it publishes none for Luna.

GPT-6.2 (`gpt-6.2-sol`, `gpt-6.2-astra`), from OpenAI's "Prompting GPT-6.2 in Codex" and "Using GPT-6.2" (read 24 Nov 2026):
- It is more concise and direct by default. Drop inherited "be concise" lines; ask for length or detail only where the output needs it.
- When intent is unclear it may propose a next step and wait for confirmation. For a run that should finish unattended, say which assumptions it may make on its own and tell it to complete the work already authorized before asking anything. `default_follow_through_policy` is the block for this.
- Say what the reviewer will look for when judging the result, what counts as finished, and where it should be exhaustive.
- It can carry shorthand from its reasoning into the final answer. Where a person reads the output, ask for terms to be written out.
- Describe the project's conventions. For interface work, name the imagery and typography wanted.
- For a small change, name the checks that are required, and say to skip new tests unless the repo requires them or they catch a regression the existing tests miss.

GPT-6 and 6.1 (`gpt-6-sol`, `gpt-6.1-sol`), from the GPT-6 Astra guide:
- It stops to ask more readily than GPT-5.6; the same follow-through block applies.
- It leans toward detailed, formatted answers: lists, tables, headers. Where the caller needs prose, ask for short paragraphs with lists only for parallel or sequential items.
- It leans toward thorough testing. Name the required checks so it does not write tests that mirror the implementation.

Every model: do not tell it to use sub-agents. OpenAI's 6.2 guide suggests "use subagents as needed", but here the `codex-guard` hook caps every run at one thread, and delegation multiplies usage.


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
