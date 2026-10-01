#!/usr/bin/env node
// collab-linear — teamlet v1: Linear is the control plane, git worktrees the execution plane.
// The orchestrating Claude session does its Linear I/O through its own Linear MCP; Codex
// reads and writes the board itself through the Linear MCP configured in ~/.codex/config.toml
// (MCP servers run in the codex host process, OUTSIDE the sandbox — verified working from a
// read-only `codex exec`). This wrapper therefore needs NO Linear credentials: it only
// manages worktrees and launches codex runs.
//
//   node collab-linear.mjs worktree <slug> [--base <ref>]          create worktree + branch codex/<slug>
//   node collab-linear.mjs run <slug> --issue <ID> [opts] <task>   run codex in the worktree on a Linear issue
//   node collab-linear.mjs merge <slug>                            merge codex/<slug> into the CURRENT branch, clean up
//   node collab-linear.mjs remove <slug>                           abandon: remove worktree + delete branch
//   node collab-linear.mjs list                                    show teamlet worktrees
//
// run opts: --model <m> (default gpt-6.1-sol), --effort <minimal|low|medium|high|xhigh>,
//           --read-only (default sandbox is workspace-write scoped to the worktree + main .git)
//
// The merge gate lives in Linear and is enforced by the ORCHESTRATOR, not here: merge only
// after the peer's review comment starting "approve" is on the issue (issue in In Review).
// debt: no path-claim conflict checks — single orchestrator assumed; add claims if two
// orchestrators ever drive the same repo concurrently.

import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, basename, dirname } from 'node:path';

const die = (msg) => { console.error(`[collab-linear] ${msg}`); process.exit(1); };
const sh = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (r.error) die(`${cmd} failed to start: ${r.error.message}`);
  return r;
};
const shOk = (cmd, args, opts = {}) => {
  const r = sh(cmd, args, opts);
  if (r.status !== 0) die(`${cmd} ${args.join(' ')} exited ${r.status}:\n${(r.stderr || r.stdout || '').trim()}`);
  return (r.stdout || '').trim();
};

const argv = process.argv.slice(2);
const cmd = argv[0];
const slug = argv[1];
const flag = (name) => argv.includes(name);
const flagVal = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };

// --repo <path> targets a repo explicitly (avoids cd-compound shell calls); default is cwd's repo.
const repoArg = flagVal('--repo');
const REPO = shOk('git', repoArg ? ['-C', repoArg, 'rev-parse', '--show-toplevel'] : ['rev-parse', '--show-toplevel']);
const wtPath = (s) => join(dirname(REPO), `${basename(REPO)}--codex-${s}`);
const branchOf = (s) => `codex/${s}`;

const validSlug = (s) => s && /^[a-z0-9][a-z0-9-]{1,60}$/.test(s);

switch (cmd) {
  case 'worktree': {
    if (!validSlug(slug)) die('usage: worktree <slug> [--base <ref>] (slug: kebab-case)');
    const base = flagVal('--base') || 'HEAD';
    shOk('git', ['-C', REPO, 'worktree', 'add', '-b', branchOf(slug), wtPath(slug), base]);
    console.log(JSON.stringify({ worktree: wtPath(slug), branch: branchOf(slug), base }));
    break;
  }

  case 'run': {
    if (!validSlug(slug)) die('usage: run <slug> --issue <ID> [--model m] [--effort e] [--read-only] <task>');
    const issue = flagVal('--issue');
    if (!issue) die('--issue <ID> is required (e.g. GIO-7)');
    const task = argv[argv.length - 1];
    if (!task || task.startsWith('--') || task === slug || task === issue) die('last argument must be the task text');
    const wt = wtPath(slug);
    const model = flagVal('--model') || 'gpt-6.1-sol';
    const effort = flagVal('--effort');
    const sandbox = flag('--read-only') ? 'read-only' : 'workspace-write';

    const prompt = [
      `You are Codex, one half of a two-agent teamlet (Codex implements, Claude reviews, and vice versa). Your assignment is Linear issue ${issue}.`,
      '',
      'Control plane — use your Linear MCP tools for ALL coordination:',
      `1) FIRST fetch issue ${issue} and read every comment on it. The thread may contain constraints or review feedback that supersede the task text below; the latest review comment wins.`,
      `2) Post a one-line comment on ${issue} when you start, saying what you are about to do.`,
      '3) Do the work INSIDE this worktree only. Commit as you go with clear messages.',
      `4) When done, post a final comment on ${issue}: what changed (files), how you verified it, and anything the reviewer should scrutinize. Then set the issue state to "In Review" if your Linear tools allow it; otherwise say so in the comment.`,
      `5) NEVER set the issue to Done — the reviewing peer does that after approving. Do not touch any Linear issue other than ${issue}.`,
      '6) Report faithfully: if something failed or was skipped, say so in the final comment — never claim completion without having observed it.',
      '7) Never run destructive commands (no rm -rf); never contact any external service other than Linear via MCP.',
      '',
      `Task: ${task}`,
    ].join('\n');

    const logDir = join(homedir(), '.claude', 'logs', 'teamlet');
    mkdirSync(logDir, { recursive: true });
    const logFile = join(logDir, `${slug}-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);

    const args = [
      'exec', '--skip-git-repo-check', '-C', wt, '-s', sandbox,
      '--add-dir', join(REPO, '.git'),
      // Linear WRITES (comments, state) need approval by default and are auto-rejected in
      // non-interactive exec — auto-approve them for teamlet runs only, never globally.
      '-c', 'mcp_servers.linear.default_tools_approval_mode="auto"',
      '-m', model, '-o', logFile,
    ];
    if (effort) args.push('-c', `model_reasoning_effort=${effort}`);
    args.push(prompt);

    const r = sh('codex', args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    // Final message is captured in logFile via -o; stdout carries the run transcript.
    writeFileSync(logFile.replace(/\.md$/, '.stdout.log'), (r.stdout || '') + '\n--- stderr ---\n' + (r.stderr || ''));
    console.log(JSON.stringify({ slug, issue, exit: r.status, final: logFile, log: logFile.replace(/\.md$/, '.stdout.log') }));
    break;
  }

  case 'merge': {
    if (!validSlug(slug)) die('usage: merge <slug>');
    shOk('git', ['-C', REPO, 'merge', '--no-ff', branchOf(slug), '-m', `Merge ${branchOf(slug)} (teamlet)`]);
    shOk('git', ['-C', REPO, 'worktree', 'remove', '--force', wtPath(slug)]);
    shOk('git', ['-C', REPO, 'branch', '-D', branchOf(slug)]);
    console.log(JSON.stringify({ merged: branchOf(slug), into: shOk('git', ['-C', REPO, 'branch', '--show-current']) }));
    break;
  }

  case 'remove': {
    if (!validSlug(slug)) die('usage: remove <slug>');
    shOk('git', ['-C', REPO, 'worktree', 'remove', '--force', wtPath(slug)]);
    shOk('git', ['-C', REPO, 'branch', '-D', branchOf(slug)]);
    console.log(JSON.stringify({ removed: branchOf(slug) }));
    break;
  }

  case 'list': {
    const out = shOk('git', ['-C', REPO, 'worktree', 'list', '--porcelain']);
    const rows = out.split('\n\n').filter((b) => b.includes('--codex-'));
    console.log(rows.length ? rows.join('\n\n') : '[collab-linear] no teamlet worktrees');
    break;
  }

  default:
    die('commands: worktree | run | merge | remove | list (see header comment)');
}
