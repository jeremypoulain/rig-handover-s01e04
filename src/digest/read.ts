import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightDigest, ReadNight, RunStatus } from './types.js';

type RunLine = {
  at: string;
  time: number;
  job: string;
  status: RunStatus;
  owner: string | null;
  error: string | null;
};

const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

function isStatus(value: unknown): value is RunStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Parse one log line at the edge. Returns null for anything that is not a valid run line.
function parseLine(line: string): RunLine | null {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;
  const { at, job, status, owner, error } = raw;
  if (typeof at !== 'string' || typeof job !== 'string' || job === '') return null;
  const time = Date.parse(at);
  if (Number.isNaN(time)) return null;
  if (!isStatus(status)) return null;
  if (owner !== undefined && owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && error !== null && typeof error !== 'string') return null;
  return { at, time, job, status, owner: owner ?? null, error: error ?? null };
}

function toRow(job: string, lines: RunLine[]): DigestRow {
  // Chronological order; ties keep file order (sort is stable).
  const sorted = [...lines].sort((a, b) => a.time - b.time);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const owner = [...sorted].reverse().find((l) => l.owner !== null)?.owner ?? null;
  return {
    job,
    owner,
    runs: lines.length,
    retries: lines.filter((l) => l.status === 'retry').length,
    lastStatus: last.status,
    lastError: last.error,
    firstAt: first.at,
    lastAt: last.at,
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  const file = join(runsDir, `${night}.jsonl`);
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8');

  const byJob = new Map<string, RunLine[]>();
  let badLines = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const parsed = parseLine(line);
    if (parsed === null) {
      badLines++;
      continue;
    }
    const list = byJob.get(parsed.job);
    if (list) list.push(parsed);
    else byJob.set(parsed.job, [parsed]);
  }

  const rows = [...byJob.entries()]
    .map(([job, lines]) => toRow(job, lines))
    .sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  const digest: NightDigest = { night, rows, badLines };
  return digest;
};
