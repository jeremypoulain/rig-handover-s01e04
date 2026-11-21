import type { DigestRow, NightDigest } from '../digest/types.js';

const dash = '—';

function marks(row: DigestRow): string[] {
  const out: string[] = [];
  if (row.retries >= 3) out.push('retries 3+');
  if (row.lastStatus === 'fail') out.push('fail');
  return out;
}

export function DigestPage({ digest }: { digest: NightDigest }) {
  return (
    <>
      <h1>digest</h1>
      <p class="mute">{digest.night}</p>
      {digest.badLines > 0 ? <p class="warn">{digest.badLines} bad line(s) skipped</p> : null}
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
              <th>flags</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => {
              const flags = marks(row);
              return (
                <tr class={flags.length > 0 ? 'flagged' : undefined}>
                  <td>{row.job}</td>
                  <td>{row.owner ?? dash}</td>
                  <td>{row.runs}</td>
                  <td class={row.retries >= 3 ? 'retries-high' : undefined}>{row.retries}</td>
                  <td class={row.lastStatus === 'fail' ? 'fail' : undefined}>{row.lastStatus}</td>
                  <td>{row.lastError ?? dash}</td>
                  <td>{row.firstAt}</td>
                  <td>{row.lastAt}</td>
                  <td class="warn">{flags.length > 0 ? flags.join(', ') : dash}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
