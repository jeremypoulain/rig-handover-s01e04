import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  it('gives 5 jobs sorted by job and 1 bad line', () => {
    const digest = readNight('runs', '2026-10-28');
    expect(digest).not.toBeNull();
    expect(digest!.night).toBe('2026-10-28');
    expect(digest!.badLines).toBe(1);
    expect(digest!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts runs and retries and keeps the last status and offsets', () => {
    const rows = readNight('runs', '2026-10-28')!.rows;
    const refresh = rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(refresh).toMatchObject({
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    const backup = rows.find((r) => r.job === 'notes/backup')!;
    expect(backup).toMatchObject({ runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps a row whose owner is null', () => {
    const render = readNight('runs', '2026-10-28')!.rows.find((r) => r.job === 'digest/render');
    expect(render).toBeDefined();
    expect(render!.owner).toBeNull();
  });
});

describe('readNight on synthetic logs', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null for a missing night', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('gives no rows and no bad lines for an empty file', () => {
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('keeps null and missing owners, counts invalid lines, uses the chronologically last line', () => {
    const lines = [
      '{"at":"2026-01-03T02:00:00+01:00","job":"a","status":"fail","owner":null,"error":"boom"}',
      '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"retry","owner":null,"error":"slow"}',
      '{"at":"2026-01-03T01:00:00+01:00","job":"b","status":"ok"}',
      '{"at":"2026-01-03T01:00:00+01:00","job":"c","status":"weird","owner":"x"}',
      '{"job":"c","status":"ok"}',
      '[1,2]',
      'not json',
    ];
    writeFileSync(join(dir, '2026-01-03.jsonl'), lines.join('\n') + '\n');
    const digest = readNight(dir, '2026-01-03')!;
    expect(digest.badLines).toBe(4);
    expect(digest.rows).toEqual([
      {
        job: 'a',
        owner: null,
        runs: 2,
        retries: 1,
        lastStatus: 'fail',
        lastError: 'boom',
        firstAt: '2026-01-03T01:00:00+01:00',
        lastAt: '2026-01-03T02:00:00+01:00',
      },
      {
        job: 'b',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-01-03T01:00:00+01:00',
        lastAt: '2026-01-03T01:00:00+01:00',
      },
    ]);
  });
});
