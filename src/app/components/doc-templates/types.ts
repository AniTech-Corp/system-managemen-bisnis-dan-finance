import type { GenerationType } from '@/lib/generation-engine';
import type { DocTemplateSource } from '@/lib/doc-templates';

export type { DocTemplateSource };

export interface DocTemplate {
  id: string;
  sourceId: string;
  source: DocTemplateSource;
  label: string;
  outputType: GenerationType;
  description: string;
}

export type DocTemplateCategory = 'all' | 'excel' | 'word' | 'ppt' | 'pdf' | 'video-plan';

export interface DocTemplateGenerateRequest {
  templateId: string;
  brief: string;
  fileNameHint?: string;
  tone?: string;
  role?: string;
}

export interface DocTemplateGenerateResult {
  fileName: string;
  mimeType: string;
  fileBase64: string;
  summary: string;
  provider: string;
  modelUsed: string;
  latencyMs: number;
  note?: string;
  templateId: string;
  templateLabel: string;
}
