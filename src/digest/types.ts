export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job for one night. Missing data stays visible: owner and lastError are null, never dropped.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  // ISO 8601 strings exactly as in the log (offset kept, never converted to UTC).
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  night: string;
  rows: DigestRow[];
  // Lines that did not parse. Counted, never thrown.
  badLines: number;
};

// Signature of readNight(runsDir, night), implemented in src/digest/read.ts (issue #2). Returns null when the night has no file.
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
