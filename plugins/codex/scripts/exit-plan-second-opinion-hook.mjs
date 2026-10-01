#!/usr/bin/env node
// PostToolUse(ExitPlanMode) hook — decoupled second-opinion trigger (fork addition).
// The built-in advisor never fires on Fable 5 mains (Fable-as-advisor is server-gated),
// so plan approval is the moment that gets an independent GPT review: feed the approved
// plan to codex-advisor.mjs and return its opinion as additionalContext. Non-fatal
// everywhere — a broken or slow codex must never block the plan flow (always exit 0).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ADVISOR = join(dirname(fileURLToPath(import.meta.url)), 'codex-advisor.mjs');
// Trace: one line per invocation so a silent quit is diagnosable after the fact.
const TRACE = join(homedir(), '.claude', 'logs', 'codex-advisor', 'plan-hook.log');
const trace = (what) => { try { mkdirSync(dirname(TRACE), { recursive: true }); writeFileSync(TRACE, `${new Date().toISOString()} ${process.env.CLAUDE_CODE_SESSION_ID || '-'} ${what}\n`, { flag: 'a' }); } catch {} };
const quit = (why) => { if (why) trace(`quit: ${why}`); process.exit(0); };

// Kill switch — either works, no restart needed:
//   off: touch ~/.claude/cache/codex-advisor/plan-hook-off   (or CODEX_PLAN_OPINION_DISABLE=1)
//   on:  rm    ~/.claude/cache/codex-advisor/plan-hook-off
if (process.env.CODEX_PLAN_OPINION_DISABLE === '1') quit();
if (existsSync(join(homedir(), '.claude', 'cache', 'codex-advisor', 'plan-hook-off'))) quit();

let input;
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { quit('bad stdin json'); }
const plan = input?.tool_input?.plan;
if (!plan || typeof plan !== 'string' || !plan.trim()) quit('no tool_input.plan');
// A rejected plan means Claude keeps planning — don't spend a codex run on it. Decide by the
// response SHAPE: approval returns an object ({plan, filePath, …}); rejection returns the
// "The user doesn't want to proceed…" string. Never regex the plan text itself — it is
// embedded in tool_response.plan and routinely contains "rejected"/"denied".
if (!input.tool_response || typeof input.tool_response !== 'object') quit('plan rejected');
trace(`dispatch session=${input.session_id || '-'} planlen=${plan.length}`);

const PLAN_DIR = join(homedir(), '.claude', 'cache', 'codex-advisor', 'plans');
const planPath = join(PLAN_DIR, `${createHash('sha1').update(plan).digest('hex').slice(0, 16)}.md`);
try { mkdirSync(PLAN_DIR, { recursive: true }); writeFileSync(planPath, plan); } catch { quit(); }

const args = [ADVISOR, '--plan-file', planPath];
if (input.transcript_path) args.push('--transcript', input.transcript_path);
const r = spawnSync('node', args, {
  cwd: input.cwd || process.cwd(),
  encoding: 'utf8',
  timeout: 450_000,
  env: { ...process.env, CLAUDE_CODE_SESSION_ID: input.session_id || process.env.CLAUDE_CODE_SESSION_ID || '' },
  maxBuffer: 16 * 1024 * 1024,
});
const out = (r.stdout || '').trim();
// Dedup/skip paths ("[codex-advisor] … skipping.") add nothing — stay silent.
if (!out || out.includes('skipping.')) quit(`advisor gave no opinion: ${(out || '(empty)').split('\n')[0].slice(0, 120)}`);
trace('opinion delivered');
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext: `Codex (GPT) second opinion on the approved plan — weigh it before executing:\n\n${out}`,
  },
}));
quit();
