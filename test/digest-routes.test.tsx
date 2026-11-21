import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

type Json = { night: string; rows: { job: string }[]; badLines: number };

const line = (at: string, job: string, status = 'ok') => JSON.stringify({ at, job, status, owner: 'rook' });

describe('digest routes', () => {
  let dir: string;
  const app = () =>
    createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
    writeFileSync(
      join(dir, '2026-02-01.jsonl'),
      [
        line('2026-02-01T23:00:00+01:00', 'zeta/job'),
        line('2026-02-01T23:05:00+01:00', 'alpha/job'),
        line('2026-02-01T23:10:00+01:00', 'mid/job', 'fail'),
      ].join('\n') + '\n',
    );
    writeFileSync(join(dir, '2026-02-02.jsonl'), '');
    writeFileSync(
      join(dir, '2026-02-03.jsonl'),
      [line('2026-02-03T23:00:00+01:00', 'alpha/job'), 'not json at all'].join('\n') + '\n',
    );
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns 200 for a normal night, page and JSON', async () => {
    const page = await app().request('/digest/2026-02-01');
    const api = await app().request('/api/digest/2026-02-01');
    expect(page.status).toBe(200);
    expect(api.status).toBe(200);
    expect(((await api.json()) as Json).badLines).toBe(0);
  });

  it('returns 404 for a night with no file', async () => {
    expect((await app().request('/digest/2026-03-01')).status).toBe(404);
    expect((await app().request('/api/digest/2026-03-01')).status).toBe(404);
  });

  it('returns 404 for a malformed night', async () => {
    expect((await app().request('/digest/nope')).status).toBe(404);
    expect((await app().request('/api/digest/nope')).status).toBe(404);
    expect((await app().request('/digest/2026-2-1')).status).toBe(404);
  });

  it('handles the empty night', async () => {
    const page = await app().request('/digest/2026-02-02');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    const api = await app().request('/api/digest/2026-02-02');
    expect(api.status).toBe(200);
    const body = (await api.json()) as Json;
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('reports a bad line on the page and in the JSON', async () => {
    const html = await (await app().request('/digest/2026-02-03')).text();
    expect(html).toContain('1 bad line(s) skipped');
    const body = (await (await app().request('/api/digest/2026-02-03')).json()) as Json;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/job']);
  });

  it('lists the same jobs in the same order on page and JSON', async () => {
    const html = await (await app().request('/digest/2026-02-01')).text();
    const body = (await (await app().request('/api/digest/2026-02-01')).json()) as Json;
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual(['alpha/job', 'mid/job', 'zeta/job']);
    const inPage = [...html.matchAll(/<td>([a-z]+\/job)<\/td>/g)].map((m) => m[1]);
    expect(inPage).toEqual(jobs);
  });
});
