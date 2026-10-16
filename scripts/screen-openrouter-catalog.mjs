// Screening katalog OpenRouter lintas modalitas (read-only, 11 Sep 2026).
// Pakai: OPENROUTER_API_KEY (dari env, JANGAN ditulis di command line) lalu
//   node scripts/screen-openrouter-catalog.mjs docs/<nama-output>.md
// Key TIDAK PERNAH dicetak. Hasil = markdown snapshot untuk memilih tier model
// (lihat src/lib/model-tiers.ts). Skrip ini tidak dipakai runtime aplikasi.
import fs from 'node:fs';

const key = (process.env.OPENROUTER_API_KEY || '').trim();
if (!key) {
  console.error('OPENROUTER_API_KEY kosong di env');
  process.exit(1);
}
const out = process.argv[2] || 'docs/openrouter-catalog-screening.md';
const scheme = 'Bearer';
const H = { Authorization: scheme + ' ' + key };
const M = (n) => (+n * 1e6).toFixed(3);
const get = (u) =>
  fetch('https://openrouter.ai/api/v1' + u, { headers: H })
    .then((r) => r.json())
    .catch((e) => ({ data: [], err: String(e) }));

const [models, images, videos] = await Promise.all([get('/models'), get('/images/models'), get('/videos/models')]);
const all = models.data || [];
const L = [];
const p = (s) => L.push(s);
const isReason = (m) => !!(m.reasoning || (m.supported_parameters || []).includes('reasoning'));
const hasJson = (m) => (m.supported_parameters || []).includes('response_format');

p('# Screening katalog OpenRouter -- 11 Sep 2026 (live, read-only)');
p('');
p(`Sumber: /models (${all.length}), /images/models (${(images.data || []).length}), /videos/models (${(videos.data || []).length}). Harga USD per 1 juta token (prompt/completion). Varian :free dan :batch dikeluarkan dari kandidat chat (free = rate-limit/tidak stabil; batch = asinkron). Kualitas TIDAK terbaca dari katalog -- tier akhir dipilih komando [PERKIRAAN].`);
p('');
const txt = all.filter((m) => (m.architecture?.output_modalities || []).includes('text') && !/:free$|:batch$/.test(m.id) && +m.pricing.prompt > 0);
const rows = (arr, cap) => {
  p('| Model | in $/M | out $/M | ctx | JSON | reasoning | in-modalities |');
  p('|---|---|---|---|---|---|---|');
  for (const m of arr.slice(0, cap)) p(`| ${m.id} | ${M(m.pricing.prompt)} | ${M(m.pricing.completion)} | ${m.context_length} | ${hasJson(m) ? 'ya' : '-'} | ${isReason(m) ? 'ya' : '-'} | ${(m.architecture?.input_modalities || []).join(',')} |`);
  p('');
};
p('## 1. TEKS -- 40 termurah, ctx >= 64k');
rows(txt.filter((m) => m.context_length >= 64000).sort((a, b) => +a.pricing.prompt - +b.pricing.prompt), 40);
p('## 2. TEKS -- kandidat SANTAI (prompt <= $0.10/M, ctx >= 128k, JSON)');
rows(txt.filter((m) => +m.pricing.prompt * 1e6 <= 0.1 && m.context_length >= 128000 && hasJson(m)).sort((a, b) => +a.pricing.prompt - +b.pricing.prompt), 30);
p('## 3. TEKS -- kandidat SERIUS ($0.5-$2/M, reasoning, ctx >= 128k)');
rows(
  txt
    .filter((m) => {
      const x = +m.pricing.prompt * 1e6;
      return x >= 0.5 && x <= 2 && isReason(m) && m.context_length >= 128000;
    })
    .sort((a, b) => +a.pricing.prompt - +b.pricing.prompt),
  30
);
p('## 4. VISION (input image) termurah, ctx >= 64k');
rows(txt.filter((m) => (m.architecture?.input_modalities || []).includes('image') && m.context_length >= 64000).sort((a, b) => +a.pricing.prompt - +b.pricing.prompt), 20);
p('## 5. EMBEDDINGS');
const emb = all.filter((m) => (m.architecture?.output_modalities || []).includes('embeddings') || /embed/i.test(m.id)).sort((a, b) => +a.pricing.prompt - +b.pricing.prompt);
p('| Model | in $/M | ctx |');
p('|---|---|---|');
for (const m of emb.slice(0, 15)) p(`| ${m.id} | ${M(m.pricing.prompt)} | ${m.context_length} |`);
p('');
p('## 6. SPEECH (TTS)');
const tts = all.filter((m) => (m.architecture?.output_modalities || []).includes('speech'));
p('| Model | in $/M | out $/M | pricing mentah |');
p('|---|---|---|---|');
for (const m of tts) p(`| ${m.id} | ${M(m.pricing.prompt)} | ${M(m.pricing.completion)} | ${JSON.stringify(m.pricing).slice(0, 140)} |`);
p('');
p('## 7. TRANSCRIPTION / input audio');
const stt = all
  .filter((m) => (m.architecture?.output_modalities || []).includes('transcription') || ((m.architecture?.input_modalities || []).includes('audio') && !/:free$/.test(m.id)))
  .sort((a, b) => +a.pricing.prompt - +b.pricing.prompt);
p('| Model | in $/M | out $/M | in | out |');
p('|---|---|---|---|---|');
for (const m of stt.slice(0, 20)) p(`| ${m.id} | ${M(m.pricing.prompt)} | ${M(m.pricing.completion)} | ${(m.architecture?.input_modalities || []).join(',')} | ${(m.architecture?.output_modalities || []).join(',')} |`);
p('');
p('## 8. IMAGE GENERATION (/images/models) -- harga per gambar hanya di /endpoints per model');
p('| Model | aspect ratios | resolutions | qualities | ref-image |');
p('|---|---|---|---|---|');
for (const m of (images.data || []).slice(0, 40)) {
  const sp = m.supported_parameters || {};
  p(`| ${m.id} | ${(sp.aspect_ratio?.values || []).length} | ${(sp.resolution?.values || []).join('/')} | ${(sp.quality?.values || []).join('/')} | ${sp.input_references ? 'ya' : '-'} |`);
}
p('');
p('## 9. VIDEO GENERATION (/videos/models)');
p('| Model | durasi | resolusi | sku pertama | USD |');
p('|---|---|---|---|---|');
for (const m of videos.data || []) {
  const sk = Object.entries(m.pricing_skus || {});
  const [u, c] = sk[0] || ['-', '-'];
  p(`| ${m.id} | ${(m.supported_durations || []).join('/')} | ${(m.supported_resolutions || []).join('/')} | ${u} | ${c} |`);
}
p('');
p('## 10. Diskon / varian');
p('- :batch = lebih murah tetapi asinkron (job), bukan untuk chat; kandidat kerja latar (brief/insight) di masa depan.');
p('- :free = gratis, rate-limit ketat, bisa hilang. Tidak untuk produk.');
p(`- Varian :free: ${all.filter((m) => /:free$/.test(m.id)).length}, :batch: ${all.filter((m) => /:batch$/.test(m.id)).length}`);
fs.writeFileSync(out, L.join('\n'));
console.log('written', out, L.length, 'lines');

const pick = (id) => {
  const m = all.find((x) => x.id === id);
  return m ? `${id} ${M(m.pricing.prompt)}/${M(m.pricing.completion)} ctx${m.context_length} json=${hasJson(m)} reas=${isReason(m)}` : id + ' NOT FOUND';
};
for (const id of [
  'qwen/qwen3.7-flash', 'deepseek/deepseek-v4-flash-0731', 'google/gemma-4-26b-a4b-it', 'openai/gpt-5-nano', 'openai/gpt-oss-120b',
  'inclusionai/ling-3.0-flash', 'google/gemini-3.1-flash-lite', 'google/gemini-3.5-flash-lite', 'deepseek/deepseek-v4-pro', 'z-ai/glm-5.2',
  'google/gemini-3.5-flash', 'x-ai/grok-4.20-fast', 'openai/gpt-5.4-mini', 'moonshotai/kimi-k2.5', 'qwen/qwen3.6-flash', 'mistralai/mistral-medium-3.5',
]) console.log(pick(id));
console.log('VIDEO:', (videos.data || []).map((m) => m.id + '=' + JSON.stringify(Object.entries(m.pricing_skus || {})[0])).join(' | '));
console.log('IMG count', (images.data || []).length, (images.data || []).slice(0, 15).map((m) => m.id).join(', '));
console.log('TTS:', tts.map((m) => m.id).join(', '));
console.log('EMB top:', emb.slice(0, 5).map((m) => m.id + ' ' + M(m.pricing.prompt)).join(' | '));
