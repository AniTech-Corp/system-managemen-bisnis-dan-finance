/**
 * Pembaca pengaturan "AI Brain" dari modal Pengaturan CEO (localStorage
 * `klir_settings_ceo_<workspaceId>`) untuk dikirim sebagai `model` + `tone` ke
 * POST /api/v1/brain/chat. 8 Sep 2026 (temuan verifikator): pilihan model/tone
 * tadinya HANYA berlaku di portal Executive; Finance kirim model:'opencode' dan
 * Marketing kirim model:'fast' hardcode -- jadi ganti pengaturan CEO lalu tanya AI
 * di portal lain tidak berubah apa pun. Mapping DISAMAKAN persis dengan
 * resolveChatModelParam/resolveChatToneParam di ExecutiveAIAssistantView.tsx.
 * Client-only (localStorage); di server / gagal parse -> default aman.
 */
export interface CeoAiChatParams { model: string; tone: string; }

export function resolveCeoChatModel(aiModel: string | undefined): string {
  if (aiModel === 'deepseek') return 'deep';
  if (aiModel === 'gemini') return 'gemini';
  return 'fast';
}
export function resolveCeoChatTone(aiTone: string | undefined): string {
  if (aiTone === 'consultant') return 'professional-warm';
  if (aiTone === 'concise') return 'clean-formal-ascii';
  return 'gen-z-casual'; // 'partner'
}

export function readCeoAiChatParams(workspaceId: string | undefined, fallbackModel = 'opencode'): CeoAiChatParams {
  try {
    if (typeof window === 'undefined') return { model: fallbackModel, tone: 'professional-warm' };
    const raw = window.localStorage.getItem(`klir_settings_ceo_${workspaceId || 'default'}`);
    if (!raw) return { model: fallbackModel, tone: 'professional-warm' };
    const parsed = JSON.parse(raw) as { aiModel?: string; aiTone?: string };
    return { model: resolveCeoChatModel(parsed.aiModel), tone: resolveCeoChatTone(parsed.aiTone) };
  } catch {
    return { model: fallbackModel, tone: 'professional-warm' };
  }
}
