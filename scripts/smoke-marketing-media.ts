/** Explicit paid smoke only: one small image, one short voiceover, its transcription.
 * Run: node --env-file=.env --import tsx scripts/smoke-marketing-media.ts --live
 * Artifacts stay in ignored build/media-smoke, never contain keys.
 * Flags: --audio-only (skip image stage), --run-id=<id> (else SMOKE_RUN_ID env, else generated).
 * Each run writes a fresh report; the prior report is kept only under "previousRun".
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { generateImageMedia, generateSpeech, transcribeAudio } from '../src/lib/media-provider';
import { configuredModel, discoverMediaModels } from '../src/lib/media-catalog';

async function main() {
  if (!process.argv.includes('--live')) throw new Error('Requires explicit --live; this command incurs provider charges.');
  // Conservative local reservation, not actual billing. Repeated smoke runs consume
  // this allowance even when a provider fails; no automatic reset or retry loop.
  const budget = 3; const reservation = 1;
  await mkdir('build/media-smoke', { recursive: true });
  const ledgerPath = 'build/media-smoke/budget-reservations.json';
  let reservations: Array<{ at: string; reservedUsd: number }> = [];
  try { reservations = JSON.parse(await readFile(ledgerPath, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (!Array.isArray(reservations) || reservations.some(item => !Number.isFinite(item.reservedUsd) || item.reservedUsd < 0)) throw new Error('Invalid smoke budget ledger.');
  const reserved = reservations.reduce((sum, item) => sum + item.reservedUsd, 0);
  if (reserved + reservation >= budget) throw new Error('Smoke allowance approaches USD3; no further provider calls.');
  reservations.push({ at: new Date().toISOString(), reservedUsd: reservation });
  await writeFile(ledgerPath, JSON.stringify(reservations, null, 2));
  const audioOnly = process.argv.includes('--audio-only');
  // Every run gets its own id; stage results are never inherited from an earlier report.
  const runIdArg = process.argv.find(a => a.startsWith('--run-id='))?.slice('--run-id='.length);
  const runId = runIdArg || process.env.SMOKE_RUN_ID || `${Date.now()}-${process.pid}-${process.hrtime.bigint()}`;
  const reportPath = 'build/media-smoke/report.json';
  // The previous report is kept only as a reference in its own field, never merged into this run.
  let previousRun: unknown = null;
  try { previousRun = JSON.parse(await readFile(reportPath, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const report: Record<string, unknown> = { runId, at: new Date().toISOString(), mode: audioOnly ? 'audio-only' : 'full', budgetCeilingUsd: budget, reservedEstimateUsd: reservation, actualCostStatus: 'Only reported provider usage; TTS billing not returned in raw audio response.', previousRun };
  for (const kind of ['image','audio','transcription'] as const) {
    const list = await discoverMediaModels(kind);
    report[kind+'Discovery'] = { count: list.length, configuredAvailable: list.some(x => x.id === configuredModel(kind)) };
  }
  async function stage(name: string, fn: () => Promise<Record<string, unknown>>) {
    const startedAt = new Date().toISOString();
    try { report[name] = { ...(await fn()), startedAt, finishedAt: new Date().toISOString() }; console.log(name, JSON.stringify(report[name])); }
    catch (e) { process.exitCode = 1; report[name] = { status: 'failed', code: (e as {code?:string}).code, message: e instanceof Error ? e.message : 'Unknown', startedAt, finishedAt: new Date().toISOString() }; console.log(name, JSON.stringify(report[name])); }
    await writeFile(reportPath, JSON.stringify(report, null, 2));
  }
  async function skip(name: string, reason: string) {
    report[name] = { status: 'skipped', reason, at: new Date().toISOString() };
    console.log(name, JSON.stringify(report[name]));
    await writeFile(reportPath, JSON.stringify(report, null, 2));
  }
  if (audioOnly) await skip('image', '--audio-only flag'); else await stage('image', async () => {
    const r = await generateImageMedia('Minimal studio photograph of a plain blue ceramic coffee cup on a warm cream background. No text, no logo, no people.', { aspectRatio:'1:1', resolution:'512' });
    await writeFile('build/media-smoke/image.' + r.mimeType.split('/')[1], Buffer.from(r.base64!, 'base64'));
    return { status:'ready', provider:r.provider, model:r.modelUsed, mime:r.mimeType, latencyMs:r.latencyMs, usage:r.usage, note:r.note };
  });
  let audio: Awaited<ReturnType<typeof generateSpeech>> | undefined;
  await stage('speech', async () => {
    audio = await generateSpeech('Ini adalah pengujian suara KLIR. Selamat pagi, mari membuat konten yang bermanfaat.');
    const bytes = Buffer.from(audio.dataUrl!.split(',')[1], 'base64');
    await writeFile('build/media-smoke/' + audio.fileName, bytes);
    return { status:audio.status, provider:audio.provider, model:audio.modelUsed, mime:audio.mimeType, bytes:bytes.length, latencyMs:audio.latencyMs, note:audio.note };
  });
  if (!audio) await skip('transcription', 'speech stage produced no audio'); else await stage('transcription', async () => {
    const r = await transcribeAudio(Buffer.from(audio!.dataUrl!.split(',')[1], 'base64'), audio!.mimeType!, audio!.fileName!, 'id');
    return { status:'ready', ...r };
  });
}
main().catch(e => { console.error(e instanceof Error ? e.message : 'Smoke failed'); process.exitCode = 1; });
