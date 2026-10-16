/** Serializable notebook contracts shared with role-specific clients. */
export type NotebookDifficulty = 'easy' | 'medium' | 'hard';
export type NotebookKind =
  | 'quiz'
  | 'flashcard'
  | 'summary-report'
  | 'mindmap'
  | 'table'
  | 'infographic'
  | 'deck'
  | 'audio-overview-script'
  | 'video-storyboard';

export interface NotebookRequest {
  kind: NotebookKind;
  sourceText: string;
  count?: number;
  difficulty?: NotebookDifficulty;
  role?: 'marketing' | 'executive' | 'finance';
}

export interface QuizPayload {
  title: string;
  instructions: string;
  questions: Array<{
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>;
}

export interface FlashcardPayload {
  title: string;
  cards: Array<{ id: string; front: string; back: string; hint?: string }>;
}

export interface SummaryReportPayload {
  title: string;
  summary: string;
  sections: Array<{ id: string; heading: string; body: string }>;
}

export interface MindmapNode {
  id: string;
  label: string;
  children?: Array<{ id: string; label: string }>;
}

export interface MindmapPayload {
  title: string;
  root: { id: string; label: string };
  children: MindmapNode[];
}

export interface TablePayload {
  title: string;
  columns: string[];
  rows: string[][];
}

export interface InfographicPayload {
  title: string;
  caption: string;
  stats: Array<{ id: string; label: string; value: string; note?: string }>;
}

export interface DeckPayload {
  title: string;
  slides: Array<{ id: string; heading: string; bullets: string[] }>;
}

export interface AudioOverviewScriptPayload {
  title: string;
  speakers: [string, string];
  lines: Array<{ id: string; speaker: 'A' | 'B'; text: string }>;
}

export interface VideoStoryboardPayload {
  title: string;
  scenes: Array<{ id: string; sceneNumber: number; description: string; onScreenText?: string }>;
}

interface NotebookMetadata {
  title: string;
  provider: string;
  modelUsed: string;
  latencyMs: number;
}

export type NotebookResult = NotebookMetadata & (
  | { kind: 'quiz'; payload: QuizPayload }
  | { kind: 'flashcard'; payload: FlashcardPayload }
  | { kind: 'summary-report'; payload: SummaryReportPayload }
  | { kind: 'mindmap'; payload: MindmapPayload }
  | { kind: 'table'; payload: TablePayload }
  | { kind: 'infographic'; payload: InfographicPayload }
  | { kind: 'deck'; payload: DeckPayload }
  | { kind: 'audio-overview-script'; payload: AudioOverviewScriptPayload }
  | { kind: 'video-storyboard'; payload: VideoStoryboardPayload }
);
