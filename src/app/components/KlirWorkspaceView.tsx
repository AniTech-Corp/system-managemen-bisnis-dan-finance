'use client';

import { useEffect, useState } from 'react';
import {
  ClipboardList,
  UserCheck,
  Gauge,
  BookOpenCheck,
  Plus,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
} from 'lucide-react';
import {
  taskPriorityMeta,
  attendanceStatusMeta,
  kpiGradeColor,
  formatDueDateBadge,
  scoreSopQuiz,
  isValidTaskDraft,
  isValidAttendanceDraft,
  type SopQuizQuestion,
} from '@/lib/kerja-workspace-ui-helpers';

// KlirWorkspaceView -- tab "KLIR Kerja" (Kanban tugas tim, presensi, evaluasi KPI,
// generator SOP dibantu AI). SEMUA data datang dari endpoint yang SUDAH ADA (dibangun
// gelombang sebelumnya, bukan dibangun ulang di sini):
//   GET/POST/PUT /api/v1/kerja/tasks       -> papan Kanban
//   GET/POST     /api/v1/kerja/attendance  -> presensi
//   POST         /api/v1/kerja/kpi         -> evaluasi kinerja (stateless, tidak ada GET)
//   POST         /api/v1/kerja/sop         -> generator SOP + kuis pemahaman (pakai kredit AI)
// Ditempatkan sebagai SUB-SECTION zero-touch di src/app/page.tsx (gated modul 'workspace'),
// BUKAN portal baru terpisah -- pola sama seperti HRAdvisorPanel/CorPlanQuickTools yang
// nempel di dalam CompanyDataDashboard.tsx. Komponen ini sengaja TIDAK ditaruh di dalam
// CompanyDataDashboard.tsx supaya tidak menyentuh file yang jadi tanggung jawab agent lain
// (ceo-dashboard-gating, scope-nya cuma 2 baris gate di file itu) -- makanya section ini
// bawa background/padding sendiri (mirror gaya CompanyDataDashboard) supaya tetap terasa
// menyatu walau dirender sebagai section terpisah di page.tsx, bukan JSX di dalam file itu.

interface KlirWorkspaceViewProps {
  workspaceId?: string;
  workspaceName?: string;
}

type WorkspaceTab = 'kanban' | 'presensi' | 'kpi' | 'sop';

interface WorkTaskRow {
  id: string;
  title: string;
  description?: string | null;
  assigneeName: string;
  priority: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  dueDate?: string | null;
}

interface AttendanceRow {
  id: string;
  employeeName: string;
  shift: string;
  status: string;
  location: string;
  notes?: string | null;
  checkInTime: string;
}

interface KpiResult {
  employeeName: string;
  evaluatedBy: string;
  totalScore: number;
  grade: string;
  gradeLabel: string;
  recommendation: string;
  notes: string;
  breakdown: { indicator: string; score: number; max: number }[];
}

interface SopResult {
  sopTitle: string;
  tujuan: string;
  penanggungJawab: string;
  langkahKerja: { step: number; action: string; standard: string }[];
  kuisPemahaman: SopQuizQuestion[];
}

const TAB_BTN = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '7px',
  padding: '8px 13px',
  borderRadius: '9px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  border: 0,
  background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
  color: active ? '#F5F7FA' : '#98A2B3',
});

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  height: '36px',
  padding: '0 12px',
  background: '#10141C',
  border: 0,
  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)',
  borderRadius: '9px',
  color: '#F5F7FA',
  fontSize: '12.5px',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 500,
  color: '#98A2B3',
  marginBottom: '5px',
};

const BADGE_STYLE = (color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 9px',
  borderRadius: '999px',
  fontSize: '10.5px',
  fontWeight: 600,
  color,
  background: `${color}1F`,
});

const CARD_BTN: React.CSSProperties = {
  height: '28px',
  padding: '0 10px',
  borderRadius: '7px',
  border: 0,
  background: 'rgba(255,255,255,0.06)',
  color: '#CBD3DF',
  fontFamily: 'inherit',
  fontSize: '10.5px',
  fontWeight: 600,
  cursor: 'pointer',
};

function AIDisclaimer({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '11px 13px', borderRadius: '9px', background: 'rgba(239,68,68,0.12)', border: 0, boxShadow: '0 4px 18px -2px rgba(0,0,0,0.4)' }}>
      <AlertTriangle size={14} color="#EF4444" style={{ flexShrink: 0, marginTop: '1px' }} />
      <span style={{ fontSize: '11px', lineHeight: 1.5, color: '#F5B8B8' }}>{text}</span>
    </div>
  );
}

export default function KlirWorkspaceView({
  workspaceId = 'f451b290-1fc6-474d-8787-b8f1121c798b',
  workspaceName = 'Anitech Workspace',
}: KlirWorkspaceViewProps) {
  const [tab, setTab] = useState<WorkspaceTab>('kanban');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string, ms = 4000) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), ms);
  };

  // ============================================================
  // TAB 1: KANBAN TUGAS
  // ============================================================
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskColumns, setTaskColumns] = useState<{ TODO: WorkTaskRow[]; IN_PROGRESS: WorkTaskRow[]; DONE: WorkTaskRow[] }>({ TODO: [], IN_PROGRESS: [], DONE: [] });
  const [taskSummary, setTaskSummary] = useState({ totalTasks: 0, todoCount: 0, inProgressCount: 0, doneCount: 0 });
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftAssignee, setDraftAssignee] = useState('Tim Operasional');
  const [draftPriority, setDraftPriority] = useState('MEDIUM');
  const [draftDueDate, setDraftDueDate] = useState('');

  const loadTasks = async () => {
    setTaskLoading(true);
    try {
      const res = await fetch('/api/v1/kerja/tasks', { credentials: 'include' });
      if (!res.ok) throw new Error('Gagal memuat papan tugas.');
      const data = await res.json();
      setTaskColumns(data.columns || { TODO: [], IN_PROGRESS: [], DONE: [] });
      setTaskSummary(data.summary || { totalTasks: 0, todoCount: 0, inProgressCount: 0, doneCount: 0 });
    } catch (err) {
      console.warn('[KlirWorkspaceView] loadTasks gagal:', err);
    } finally {
      setTaskLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidTaskDraft(draftTitle)) return;
    setTaskSubmitting(true);
    try {
      const res = await fetch('/api/v1/kerja/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: draftTitle,
          description: draftDesc || undefined,
          assigneeName: draftAssignee || 'Tim Operasional',
          priority: draftPriority,
          dueDate: draftDueDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Gagal menambah tugas.');
      showToast(data.message || 'Tugas baru berhasil ditambahkan.');
      setDraftTitle('');
      setDraftDesc('');
      setDraftAssignee('Tim Operasional');
      setDraftPriority('MEDIUM');
      setDraftDueDate('');
      setTaskFormOpen(false);
      await loadTasks();
    } catch (err: any) {
      showToast(err?.message || 'Gagal menambah tugas, coba lagi.');
    } finally {
      setTaskSubmitting(false);
    }
  };

  const handleMoveTask = async (taskId: string, status: 'TODO' | 'IN_PROGRESS' | 'DONE') => {
    setMovingTaskId(taskId);
    try {
      const res = await fetch('/api/v1/kerja/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ taskId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Gagal memindahkan tugas.');
      await loadTasks();
    } catch (err: any) {
      showToast(err?.message || 'Gagal memindahkan tugas, coba lagi.');
    } finally {
      setMovingTaskId(null);
    }
  };

  // ============================================================
  // TAB 2: PRESENSI
  // ============================================================
  const [attLoading, setAttLoading] = useState(false);
  const [attRecords, setAttRecords] = useState<AttendanceRow[]>([]);
  const [attSummary, setAttSummary] = useState({ totalAttendance: 0, onTimeCount: 0, lateCount: 0, leaveCount: 0, punctualityRate: '100%' });
  const [attFormOpen, setAttFormOpen] = useState(false);
  const [attSubmitting, setAttSubmitting] = useState(false);
  const [attName, setAttName] = useState('');
  const [attShift, setAttShift] = useState('PAGI');
  const [attStatus, setAttStatus] = useState('HADIR_TEPAT_WAKTU');
  const [attNotes, setAttNotes] = useState('');

  const loadAttendance = async () => {
    setAttLoading(true);
    try {
      const res = await fetch('/api/v1/kerja/attendance', { credentials: 'include' });
      if (!res.ok) throw new Error('Gagal memuat presensi.');
      const data = await res.json();
      setAttRecords(data.records || []);
      setAttSummary(data.summary || { totalAttendance: 0, onTimeCount: 0, lateCount: 0, leaveCount: 0, punctualityRate: '100%' });
    } catch (err) {
      console.warn('[KlirWorkspaceView] loadAttendance gagal:', err);
    } finally {
      setAttLoading(false);
    }
  };

  const handleCreateAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAttendanceDraft(attName)) return;
    setAttSubmitting(true);
    try {
      const res = await fetch('/api/v1/kerja/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ employeeName: attName, shift: attShift, status: attStatus, notes: attNotes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Gagal mencatat presensi.');
      showToast(data.message || 'Presensi berhasil dicatat.');
      setAttName('');
      setAttNotes('');
      setAttFormOpen(false);
      await loadAttendance();
    } catch (err: any) {
      showToast(err?.message || 'Gagal mencatat presensi, coba lagi.');
    } finally {
      setAttSubmitting(false);
    }
  };

  // ============================================================
  // TAB 3: KPI
  // ============================================================
  const [kpiName, setKpiName] = useState('');
  const [kpiPunctuality, setKpiPunctuality] = useState(25);
  const [kpiTaskCompletion, setKpiTaskCompletion] = useState(30);
  const [kpiQuality, setKpiQuality] = useState(25);
  const [kpiTeamwork, setKpiTeamwork] = useState(20);
  const [kpiNotes, setKpiNotes] = useState('');
  const [kpiSubmitting, setKpiSubmitting] = useState(false);
  const [kpiResult, setKpiResult] = useState<KpiResult | null>(null);

  const handleRunKpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kpiName.trim()) return;
    setKpiSubmitting(true);
    try {
      const res = await fetch('/api/v1/kerja/kpi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          employeeName: kpiName,
          punctualityScore: kpiPunctuality,
          taskCompletionScore: kpiTaskCompletion,
          qualityScore: kpiQuality,
          teamworkScore: kpiTeamwork,
          notes: kpiNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Gagal menjalankan evaluasi KPI.');
      setKpiResult(data.kpiEvaluation);
    } catch (err: any) {
      showToast(err?.message || 'Gagal menjalankan evaluasi KPI, coba lagi.');
    } finally {
      setKpiSubmitting(false);
    }
  };

  // ============================================================
  // TAB 4: SOP-AI
  // ============================================================
  const [sopTitleInput, setSopTitleInput] = useState('');
  const [sopInstructions, setSopInstructions] = useState('');
  const [sopSubmitting, setSopSubmitting] = useState(false);
  const [sopResult, setSopResult] = useState<SopResult | null>(null);
  const [sopAnswers, setSopAnswers] = useState<(string | null)[]>([]);
  const [sopChecked, setSopChecked] = useState(false);

  const handleGenerateSop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sopTitleInput.trim() || !sopInstructions.trim()) return;
    setSopSubmitting(true);
    setSopChecked(false);
    try {
      const res = await fetch('/api/v1/kerja/sop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sopTitle: sopTitleInput, rawInstructions: sopInstructions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Gagal membuat SOP. Kredit AI mungkin tidak cukup.');
      setSopResult(data.sop);
      setSopAnswers(new Array((data.sop?.kuisPemahaman || []).length).fill(null));
    } catch (err: any) {
      showToast(err?.message || 'Gagal membuat SOP, coba lagi.');
    } finally {
      setSopSubmitting(false);
    }
  };

  const sopScore = sopResult ? scoreSopQuiz(sopResult.kuisPemahaman, sopAnswers) : null;

  // ============================================================
  // LOAD + REFRESH
  // ============================================================
  useEffect(() => {
    loadTasks();
    loadAttendance();
    // Reuse event-bus generik yang sudah dipakai Finance/Marketing untuk sinyal
    // "ada perubahan dari AI Assistant, refresh data" -- bukan mekanisme baru.
    const handleSync = () => {
      loadTasks();
      loadAttendance();
    };
    window.addEventListener('klir-ai-state-updated', handleSync);
    return () => window.removeEventListener('klir-ai-state-updated', handleSync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderTaskCard = (t: WorkTaskRow) => {
    const pMeta = taskPriorityMeta(t.priority);
    const dueBadge = formatDueDateBadge(t.dueDate);
    const isMoving = movingTaskId === t.id;
    return (
      <div key={t.id} style={{ padding: '11px 12px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', gap: '7px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#F5F7FA', lineHeight: 1.4 }}>{t.title}</span>
          <span style={BADGE_STYLE(pMeta.color)}>{pMeta.label}</span>
        </div>
        {t.description && <span style={{ fontSize: '11px', color: '#8A93A3', lineHeight: 1.45 }}>{t.description}</span>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ fontSize: '10.5px', color: '#7C8698' }}>{t.assigneeName}</span>
          {dueBadge && <span style={{ fontSize: '10px', fontWeight: 600, color: dueBadge.color }}>{dueBadge.label}</span>}
        </div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
          {t.status === 'TODO' && (
            <button type="button" style={CARD_BTN} disabled={isMoving} onClick={() => handleMoveTask(t.id, 'IN_PROGRESS')}>
              {isMoving ? 'Memindah...' : 'Mulai kerjakan'}
            </button>
          )}
          {t.status === 'IN_PROGRESS' && (
            <>
              <button type="button" style={{ ...CARD_BTN, background: 'rgba(63,191,143,0.14)', color: '#3FBF8F' }} disabled={isMoving} onClick={() => handleMoveTask(t.id, 'DONE')}>
                {isMoving ? 'Memindah...' : 'Tandai selesai'}
              </button>
              <button type="button" style={CARD_BTN} disabled={isMoving} onClick={() => handleMoveTask(t.id, 'TODO')}>
                Kembalikan
              </button>
            </>
          )}
          {t.status === 'DONE' && (
            <button type="button" style={CARD_BTN} disabled={isMoving} onClick={() => handleMoveTask(t.id, 'IN_PROGRESS')}>
              {isMoving ? 'Memindah...' : 'Buka lagi'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: '#06080C', color: '#F5F7FA', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 40px 60px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ borderTop: 0, paddingTop: '24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', color: '#F5F7FA' }}>
              Operasional tim
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '12.5px', lineHeight: 1.5, color: '#98A2B3' }}>
              Papan tugas tim, presensi, evaluasi KPI, dan generator SOP dibantu AI -- {workspaceName}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setTab('kanban')} style={TAB_BTN(tab === 'kanban')}>
              <ClipboardList size={13} /> Kanban tugas
            </button>
            <button type="button" onClick={() => setTab('presensi')} style={TAB_BTN(tab === 'presensi')}>
              <UserCheck size={13} /> Presensi
            </button>
            <button type="button" onClick={() => setTab('kpi')} style={TAB_BTN(tab === 'kpi')}>
              <Gauge size={13} /> Evaluasi KPI
            </button>
            <button type="button" onClick={() => setTab('sop')} style={TAB_BTN(tab === 'sop')}>
              <BookOpenCheck size={13} /> SOP-AI
            </button>
          </div>
        </div>

        {toastMsg && (
          <div style={{ padding: '11px 14px', borderRadius: '10px', background: 'rgba(16,185,129,0.12)', border: 0, boxShadow: '0 4px 18px -2px rgba(0,0,0,0.4)', color: '#D1FAE5', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={14} /> {toastMsg}
            </span>
            <button type="button" onClick={() => setToastMsg(null)} style={{ background: 'transparent', border: 0, color: '#8A93A3', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: KANBAN TUGAS */}
        {/* ============================================================ */}
        {tab === 'kanban' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>{taskSummary.totalTasks} total tugas</span>
                <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>{taskSummary.todoCount} belum dikerjakan</span>
                <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>{taskSummary.inProgressCount} sedang berjalan</span>
                <span style={{ fontSize: '11.5px', color: '#3FBF8F' }}>{taskSummary.doneCount} selesai</span>
              </div>
              <button type="button" onClick={() => setTaskFormOpen((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 13px', background: 'rgba(78,155,255,0.14)', border: 0, borderRadius: '8px', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 600, color: '#4E9BFF', cursor: 'pointer' }}>
                <Plus size={13} /> Tugas baru
              </button>
            </div>

            {taskFormOpen && (
              <form onSubmit={handleCreateTask} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: '10px', padding: '14px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.28)' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={LABEL_STYLE}>Judul tugas</label>
                  <input style={INPUT_STYLE} type="text" required value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="mis. Rekap kas harian toko" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={LABEL_STYLE}>Deskripsi (opsional)</label>
                  <input style={INPUT_STYLE} type="text" value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} placeholder="Detail tambahan tugas" />
                </div>
                <div>
                  <label style={LABEL_STYLE}>Penanggung jawab</label>
                  <input style={INPUT_STYLE} type="text" value={draftAssignee} onChange={(e) => setDraftAssignee(e.target.value)} placeholder="Tim Operasional" />
                </div>
                <div>
                  <label style={LABEL_STYLE}>Prioritas</label>
                  <select style={INPUT_STYLE} value={draftPriority} onChange={(e) => setDraftPriority(e.target.value)}>
                    <option value="LOW">Rendah</option>
                    <option value="MEDIUM">Sedang</option>
                    <option value="HIGH">Tinggi</option>
                    <option value="URGENT">Mendesak</option>
                  </select>
                </div>
                <div>
                  <label style={LABEL_STYLE}>Jatuh tempo (opsional)</label>
                  <input style={INPUT_STYLE} type="date" value={draftDueDate} onChange={(e) => setDraftDueDate(e.target.value)} />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px' }}>
                  <button type="submit" disabled={taskSubmitting || !isValidTaskDraft(draftTitle)} style={{ height: '34px', padding: '0 16px', borderRadius: '9px', background: '#3FBF8F', border: 0, color: '#06080C', fontFamily: 'inherit', fontSize: '12px', fontWeight: 700, cursor: taskSubmitting ? 'default' : 'pointer', opacity: taskSubmitting || !isValidTaskDraft(draftTitle) ? 0.6 : 1 }}>
                    {taskSubmitting ? 'Menyimpan...' : 'Tambah ke papan'}
                  </button>
                  <button type="button" onClick={() => setTaskFormOpen(false)} style={{ height: '34px', padding: '0 14px', borderRadius: '9px', background: 'rgba(255,255,255,0.06)', border: 0, color: '#98A2B3', fontFamily: 'inherit', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    Batal
                  </button>
                </div>
              </form>
            )}

            {taskLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '24px', justifyContent: 'center', color: '#7C8698', fontSize: '12px' }}>
                <Loader2 size={14} className="animate-spin" /> Memuat papan tugas...
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: '14px' }}>
                {([
                  { key: 'TODO' as const, label: 'Belum dikerjakan', rows: taskColumns.TODO },
                  { key: 'IN_PROGRESS' as const, label: 'Sedang berjalan', rows: taskColumns.IN_PROGRESS },
                  { key: 'DONE' as const, label: 'Selesai', rows: taskColumns.DONE },
                ]).map((col) => (
                  <div key={col.key} style={{ display: 'flex', flexDirection: 'column', gap: '9px', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.015)', border: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.28)', minHeight: '120px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#98A2B3' }}>{col.label} ({col.rows.length})</span>
                    {col.rows.length === 0 ? (
                      <span style={{ fontSize: '11px', color: '#5C6474', padding: '10px 0' }}>Belum ada tugas di sini.</span>
                    ) : (
                      col.rows.map(renderTaskCard)
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: PRESENSI */}
        {/* ============================================================ */}
        {tab === 'presensi' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>{attSummary.totalAttendance} catatan (30 terakhir)</span>
                <span style={{ fontSize: '11.5px', color: '#3FBF8F' }}>{attSummary.onTimeCount} tepat waktu</span>
                <span style={{ fontSize: '11.5px', color: '#D8A33C' }}>{attSummary.lateCount} terlambat</span>
                <span style={{ fontSize: '11.5px', color: '#4E9BFF' }}>Kedisiplinan {attSummary.punctualityRate}</span>
              </div>
              <button type="button" onClick={() => setAttFormOpen((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 13px', background: 'rgba(78,155,255,0.14)', border: 0, borderRadius: '8px', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 600, color: '#4E9BFF', cursor: 'pointer' }}>
                <Plus size={13} /> Catat presensi
              </button>
            </div>

            {attFormOpen && (
              <form onSubmit={handleCreateAttendance} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: '10px', padding: '14px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.28)' }}>
                <div>
                  <label style={LABEL_STYLE}>Nama staf</label>
                  <input style={INPUT_STYLE} type="text" required value={attName} onChange={(e) => setAttName(e.target.value)} placeholder="mis. Budi Santoso" />
                </div>
                <div>
                  <label style={LABEL_STYLE}>Shift</label>
                  <select style={INPUT_STYLE} value={attShift} onChange={(e) => setAttShift(e.target.value)}>
                    <option value="PAGI">Pagi</option>
                    <option value="SIANG">Siang</option>
                    <option value="MALAM">Malam</option>
                  </select>
                </div>
                <div>
                  <label style={LABEL_STYLE}>Status</label>
                  <select style={INPUT_STYLE} value={attStatus} onChange={(e) => setAttStatus(e.target.value)}>
                    <option value="HADIR_TEPAT_WAKTU">Hadir tepat waktu</option>
                    <option value="TERLAMBAT">Terlambat</option>
                    <option value="IZIN">Izin</option>
                    <option value="CUTI">Cuti</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={LABEL_STYLE}>Catatan (opsional)</label>
                  <input style={INPUT_STYLE} type="text" value={attNotes} onChange={(e) => setAttNotes(e.target.value)} placeholder="Keterangan tambahan" />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px' }}>
                  <button type="submit" disabled={attSubmitting || !isValidAttendanceDraft(attName)} style={{ height: '34px', padding: '0 16px', borderRadius: '9px', background: '#3FBF8F', border: 0, color: '#06080C', fontFamily: 'inherit', fontSize: '12px', fontWeight: 700, cursor: attSubmitting ? 'default' : 'pointer', opacity: attSubmitting || !isValidAttendanceDraft(attName) ? 0.6 : 1 }}>
                    {attSubmitting ? 'Menyimpan...' : 'Simpan presensi'}
                  </button>
                  <button type="button" onClick={() => setAttFormOpen(false)} style={{ height: '34px', padding: '0 14px', borderRadius: '9px', background: 'rgba(255,255,255,0.06)', border: 0, color: '#98A2B3', fontFamily: 'inherit', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    Batal
                  </button>
                </div>
              </form>
            )}

            <div style={{ borderRadius: '12px', background: 'rgba(255,255,255,0.015)', border: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.28)', overflow: 'hidden' }}>
              {attLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '24px', justifyContent: 'center', color: '#7C8698', fontSize: '12px' }}>
                  <Loader2 size={14} className="animate-spin" /> Memuat presensi...
                </div>
              ) : attRecords.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#7C8698', fontSize: '12px' }}>Belum ada catatan presensi.</div>
              ) : (
                attRecords.map((r) => {
                  const sMeta = attendanceStatusMeta(r.status);
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '11px 14px', borderBottom: 0 }}>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#F5F7FA' }}>{r.employeeName}</span>
                        <span style={{ fontSize: '10.5px', color: '#7C8698' }}>Shift {r.shift.toLowerCase()} &middot; {r.location}</span>
                      </span>
                      <span style={BADGE_STYLE(sMeta.color)}>{sMeta.label}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: EVALUASI KPI */}
        {/* ============================================================ */}
        {tab === 'kpi' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '16px' }}>
            <form onSubmit={handleRunKpi} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={LABEL_STYLE}>Nama karyawan</label>
                <input style={INPUT_STYLE} type="text" required value={kpiName} onChange={(e) => setKpiName(e.target.value)} placeholder="mis. Siti Aminah" />
              </div>
              <div>
                <label style={LABEL_STYLE}>Disiplin kehadiran &amp; jam kerja (maks 25)</label>
                <input style={INPUT_STYLE} type="number" min={0} max={25} value={kpiPunctuality} onChange={(e) => setKpiPunctuality(Math.min(25, Math.max(0, Number(e.target.value) || 0)))} />
              </div>
              <div>
                <label style={LABEL_STYLE}>Ketepatan waktu penyelesaian tugas (maks 30)</label>
                <input style={INPUT_STYLE} type="number" min={0} max={30} value={kpiTaskCompletion} onChange={(e) => setKpiTaskCompletion(Math.min(30, Math.max(0, Number(e.target.value) || 0)))} />
              </div>
              <div>
                <label style={LABEL_STYLE}>Kualitas &amp; ketelitian hasil kerja (maks 25)</label>
                <input style={INPUT_STYLE} type="number" min={0} max={25} value={kpiQuality} onChange={(e) => setKpiQuality(Math.min(25, Math.max(0, Number(e.target.value) || 0)))} />
              </div>
              <div>
                <label style={LABEL_STYLE}>Inisiatif &amp; kerjasama antar tim (maks 20)</label>
                <input style={INPUT_STYLE} type="number" min={0} max={20} value={kpiTeamwork} onChange={(e) => setKpiTeamwork(Math.min(20, Math.max(0, Number(e.target.value) || 0)))} />
              </div>
              <div>
                <label style={LABEL_STYLE}>Catatan (opsional)</label>
                <input style={INPUT_STYLE} type="text" value={kpiNotes} onChange={(e) => setKpiNotes(e.target.value)} placeholder="Konteks tambahan evaluasi" />
              </div>
              <button type="submit" disabled={kpiSubmitting || !kpiName.trim()} style={{ marginTop: '2px', height: '36px', borderRadius: '9px', background: '#3FBF8F', border: 0, color: '#06080C', fontFamily: 'inherit', fontSize: '12px', fontWeight: 700, cursor: kpiSubmitting ? 'default' : 'pointer', opacity: kpiSubmitting || !kpiName.trim() ? 0.6 : 1 }}>
                {kpiSubmitting ? 'Menghitung...' : 'Jalankan evaluasi'}
              </button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {kpiResult ? (
                <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>{kpiResult.employeeName}</span>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: kpiGradeColor(kpiResult.grade), fontFamily: "'JetBrains Mono', monospace" }}>{kpiResult.totalScore}/100</span>
                  </div>
                  <span style={{ display: 'inline-flex', alignSelf: 'flex-start', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: `${kpiGradeColor(kpiResult.grade)}1F`, color: kpiGradeColor(kpiResult.grade) }}>
                    Grade {kpiResult.grade} &middot; {kpiResult.gradeLabel}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
                    {kpiResult.breakdown.map((b) => (
                      <div key={b.indicator}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#98A2B3', marginBottom: '3px' }}>
                          <span>{b.indicator}</span>
                          <span>{b.score}/{b.max}</span>
                        </div>
                        <div style={{ height: '4px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{ width: `${(b.score / b.max) * 100}%`, height: '100%', background: '#4E9BFF' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '11.5px', lineHeight: 1.55, color: '#CBD3DF' }}>{kpiResult.recommendation}</p>
                </div>
              ) : (
                <div style={{ flex: 1, minHeight: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.015)' }}>
                  <span style={{ fontSize: '11.5px', color: '#7C8698', textAlign: 'center' }}>Isi form di kiri untuk lihat hasil evaluasi KPI</span>
                </div>
              )}
              <AIDisclaimer text="Ini alat bantu evaluasi berdasarkan skor yang diinput manual, bukan keputusan final. Hasil belum tersimpan sebagai riwayat -- catat/arsipkan sendiri kalau perlu dipakai lagi nanti." />
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: SOP-AI */}
        {/* ============================================================ */}
        {tab === 'sop' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '16px' }}>
            <form onSubmit={handleGenerateSop} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={LABEL_STYLE}>Judul SOP</label>
                <input style={INPUT_STYLE} type="text" required value={sopTitleInput} onChange={(e) => setSopTitleInput(e.target.value)} placeholder="mis. Prosedur Tutup Kasir Harian" />
              </div>
              <div>
                <label style={LABEL_STYLE}>Instruksi kerja mentah (boleh dari hasil ngomong/STT)</label>
                <textarea
                  required
                  rows={6}
                  value={sopInstructions}
                  onChange={(e) => setSopInstructions(e.target.value)}
                  placeholder="Jelaskan langkah kerjanya apa adanya, AI akan merapikan jadi SOP resmi + kuis pemahaman 3 soal..."
                  style={{ ...INPUT_STYLE, height: 'auto', padding: '9px 12px', resize: 'none', fontFamily: 'inherit' }}
                />
              </div>
              <button type="submit" disabled={sopSubmitting || !sopTitleInput.trim() || !sopInstructions.trim()} style={{ height: '36px', borderRadius: '9px', background: '#3FBF8F', border: 0, color: '#06080C', fontFamily: 'inherit', fontSize: '12px', fontWeight: 700, cursor: sopSubmitting ? 'default' : 'pointer', opacity: sopSubmitting || !sopTitleInput.trim() || !sopInstructions.trim() ? 0.6 : 1 }}>
                {sopSubmitting ? 'AI sedang menyusun SOP...' : 'Buat SOP + kuis (20 kredit AI)'}
              </button>
              <AIDisclaimer text="Dibuat AI dari instruksi yang kamu tulis -- WAJIB direview manusia sebelum dipakai resmi ke karyawan. Setiap generate memakai kredit AI workspace (20 kredit)." />
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sopResult ? (
                <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '520px', overflowY: 'auto' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>{sopResult.sopTitle}</span>
                  <span style={{ fontSize: '11px', color: '#8A93A3', lineHeight: 1.5 }}>{sopResult.tujuan}</span>
                  <span style={{ fontSize: '10.5px', color: '#7C8698' }}>Penanggung jawab: {sopResult.penanggungJawab}</span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '4px' }}>
                    {sopResult.langkahKerja.map((l) => (
                      <div key={l.step} style={{ padding: '9px 11px', borderRadius: '9px', background: 'rgba(255,255,255,0.02)' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#4E9BFF' }}>Langkah {l.step}</span>
                        <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: '#F5F7FA', lineHeight: 1.5 }}>{l.action}</p>
                        <p style={{ margin: '3px 0 0', fontSize: '10.5px', color: '#8A93A3', lineHeight: 1.5 }}>Standar: {l.standard}</p>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: 0, paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#F5F7FA' }}>Kuis pemahaman ({sopResult.kuisPemahaman.length} soal)</span>
                    {sopResult.kuisPemahaman.map((q, qi) => (
                      <div key={qi} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <span style={{ fontSize: '11px', color: '#CBD3DF' }}>{qi + 1}. {q.pertanyaan}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {q.pilihan.map((opt) => {
                            const letter = opt.trim().charAt(0).toUpperCase();
                            const picked = sopAnswers[qi] === letter;
                            const showResult = sopChecked;
                            const isCorrectOpt = letter === q.jawabanBenar.trim().charAt(0).toUpperCase();
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  const next = [...sopAnswers];
                                  next[qi] = letter;
                                  setSopAnswers(next);
                                  setSopChecked(false);
                                }}
                                style={{
                                  textAlign: 'left',
                                  padding: '7px 10px',
                                  borderRadius: '7px',
                                  fontSize: '10.5px',
                                  fontFamily: 'inherit',
                                  cursor: 'pointer',
                                  border: '1px solid ' + (picked ? 'rgba(78,155,255,0.4)' : 'rgba(255,255,255,0.08)'),
                                  background: showResult && isCorrectOpt ? 'rgba(63,191,143,0.14)' : picked ? 'rgba(78,155,255,0.1)' : 'transparent',
                                  color: showResult && isCorrectOpt ? '#3FBF8F' : picked ? '#F5F7FA' : '#98A2B3',
                                }}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setSopChecked(true)}
                        disabled={sopAnswers.some((a) => !a)}
                        style={{ height: '32px', padding: '0 14px', borderRadius: '8px', background: 'rgba(78,155,255,0.14)', border: 0, color: '#4E9BFF', fontFamily: 'inherit', fontSize: '11px', fontWeight: 600, cursor: sopAnswers.some((a) => !a) ? 'default' : 'pointer', opacity: sopAnswers.some((a) => !a) ? 0.5 : 1 }}
                      >
                        Cek jawaban
                      </button>
                      {sopChecked && sopScore && (
                        <span style={{ fontSize: '11.5px', fontWeight: 600, color: sopScore.passed ? '#3FBF8F' : '#EF4444' }}>
                          {sopScore.correct}/{sopScore.total} benar {sopScore.passed ? '-- lulus' : '-- ulangi baca SOP dulu'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.015)' }}>
                  <span style={{ fontSize: '11.5px', color: '#7C8698', textAlign: 'center' }}>Isi form di kiri untuk buat SOP + kuis pemahaman</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
