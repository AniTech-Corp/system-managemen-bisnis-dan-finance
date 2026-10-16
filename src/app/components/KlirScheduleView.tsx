'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Users, Star, Send, RefreshCw, PhoneCall, CheckCircle2, XCircle, SkipForward, Plus } from 'lucide-react';

// KlirScheduleView -- sub-section modul "schedule" (Reservasi + Antrean + Loyalitas +
// Pengingat). Backend 4 endpoint booking/* SUDAH ADA & live sejak sesi sebelumnya
// (reservations, queue, loyalty, reminder) -- file ini MURNI UI penyambung, tidak ada
// logic bisnis baru di server. Tab "Pengingat" cabang tampilannya sesuai channel yang
// dikirim backend: tier Public (PUBLIC_SAAS) = badge "Terkirim in-app", tier Private
// (PRIVATE_ENTERPRISE) = tombol buka WhatsApp seperti sebelumnya (sesi ini). Pola
// styling & fetch disamakan persis dengan
// HRAdvisorPanel.tsx / CorPlanQuickTools.tsx (tab lokal + INPUT_STYLE/TAB_BTN sendiri,
// karena project ini tidak punya modul style bersama -- dicek, tiap panel duplikat
// constants-nya sendiri) dan WorkspaceDataHub.tsx untuk pola fetch+event bus
// (credentials:'include', dispatch 'klir-ai-state-updated' + 'klir-kas-updated' cuma
// pada mutasi yang match transaksi Kas asli -- deposit/pelunasan booking, BUKAN
// transaksi baru yang ditulis dari sini; endpoint reservations/route.ts sendiri yang
// menulis CashTransaction, komponen ini cuma memicu refresh tampilan Kas di tempat lain).

type ScheduleTab = 'reservasi' | 'antrean' | 'loyalitas' | 'reminder';

type BookingStatusValue = 'CONFIRMED' | 'PENDING_DEPOSIT' | 'COMPLETED' | 'CANCELLED';
type QueueStatusValue = 'WAITING' | 'SERVING' | 'COMPLETED' | 'SKIPPED';

interface BookingReservationRow {
  id: string;
  bookingCode: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  durationMinutes: number;
  totalPrice: number;
  depositAmount: number;
  isDepositPaid: boolean;
  status: BookingStatusValue;
  notes?: string | null;
}

interface ReservationSummary {
  totalBookings: number;
  confirmedCount: number;
  completedCount: number;
  totalRevenueBooked: number;
}

interface QueueTicketRow {
  id: string;
  queueNumber: string;
  customerName: string;
  serviceType: string;
  status: QueueStatusValue;
  estimatedWaitMinutes: number;
  createdAt: string;
}

interface QueueSummary {
  totalTicketsToday: number;
  waitingCount: number;
  currentlyServingNumber: string;
  currentlyServingName: string;
  completedCount: number;
}

interface LoyaltyEvaluation {
  customerName: string;
  rating: number;
  stars: string;
  pointsEarned: number;
  totalLoyaltyPoints: number;
  alertStatus: string;
  managementAction: string;
  feedbackText: string;
  evaluatedAt: string;
}

// Channel/status baru (sesi ini, permintaan Mecca sesi205 23 Agu): tier Public
// (PUBLIC_SAAS) dikirim notifikasi in-app satu-arah oleh backend, TIDAK dapat
// link WhatsApp -- tier Private (PRIVATE_ENTERPRISE) tetap dapat link wa.me
// seperti sebelumnya. Field opsional supaya tidak breaking kalau backend lama
// (cache/rollback) belum kirim field ini.
type ReminderChannel = 'whatsapp' | 'in_app';

interface ReminderResult {
  customerName: string;
  customerPhone: string;
  reminderMessage: string;
  directWaUrl: string | null;
  channel?: ReminderChannel;
  status?: string;
  sentBy: string;
}

// ---------------------------------------------------------------------------
// Pure helpers -- diexport supaya bisa ditest via node:test tanpa render React
// (pola sama seperti ComposerToolbar.tsx: named export fungsi murni, tidak ada
// jsdom/testing-library terpasang di project ini, jadi yang ditest logic-nya).
// ---------------------------------------------------------------------------

export function formatRupiah(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return `Rp ${Math.round(v).toLocaleString('id-ID')}`;
}

/** Mirror PERSIS logic normalisasi nomor di booking/reminder/route.ts (awalan 0 -> 62)
 *  supaya preview nomor tujuan di UI selalu sama dengan yang dipakai backend. */
export function normalizeWaPhone(phoneRaw: string): string {
  let clean = (phoneRaw || '').replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) clean = '62' + clean.slice(1);
  return clean;
}

/** Label badge untuk hasil pengingat -- tier Public (channel 'in_app') dapat badge
 *  "Terkirim in-app" (bukan tombol WhatsApp), tier Private/default dapat label untuk
 *  tombol WA manual. channel undefined (mis. respons lama) dianggap 'whatsapp' supaya
 *  perilaku sebelum perubahan ini tidak berubah. */
export function reminderDeliveryLabel(channel: ReminderChannel | undefined | null): string {
  return channel === 'in_app' ? 'Terkirim in-app' : 'Siap dikirim manual via WhatsApp';
}

export function ratingToStars(rating: number): string {
  const r = Math.max(0, Math.min(5, Math.round(rating) || 0));
  return '⭐'.repeat(r);
}

export function formatWaitLabel(minutes: number): string {
  const m = Math.max(0, Math.round(minutes) || 0);
  if (m < 60) return `${m} menit`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} jam` : `${h} jam ${rest} menit`;
}

export function formatDateID(iso: string): string {
  try {
    const d = new Date(iso);
    // new Date(garbage) tidak throw -- hasilnya Invalid Date, dan
    // toLocaleDateString() pada Invalid Date juga tidak throw (cuma balikin
    // literal string "Invalid Date"). Cek eksplisit di sini supaya UI
    // menampilkan input asli, bukan teks "Invalid Date" yang membingungkan.
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export const BOOKING_STATUS_META: Record<BookingStatusValue, { label: string; color: string }> = {
  CONFIRMED: { label: 'Terkonfirmasi', color: '#4E9BFF' },
  PENDING_DEPOSIT: { label: 'Menunggu DP', color: '#D8A33C' },
  COMPLETED: { label: 'Selesai', color: '#3FBF8F' },
  CANCELLED: { label: 'Dibatalkan', color: '#EF4444' },
};

export const QUEUE_STATUS_META: Record<QueueStatusValue, { label: string; color: string }> = {
  WAITING: { label: 'Menunggu', color: '#D8A33C' },
  SERVING: { label: 'Sedang Dilayani', color: '#3FBF8F' },
  COMPLETED: { label: 'Selesai', color: '#7C8698' },
  SKIPPED: { label: 'Dilewati', color: '#EF4444' },
};

export interface ReservationFormInput {
  customerName: string;
  customerPhone: string;
  serviceName: string;
  bookingDate: string;
  totalPrice: number | '';
}

/** Validasi client-side, WAJIB persis sinkron dengan pengecekan 400 di
 *  booking/reservations/route.ts POST (baris 44-46) -- supaya user dapat pesan
 *  error yang sama sebelum request dikirim, bukan bola panas gagal API. */
export function validateReservationForm(input: ReservationFormInput): string[] {
  const errors: string[] = [];
  if (!input.customerName || !input.customerName.trim()) errors.push('Nama pelanggan wajib diisi.');
  if (!input.customerPhone || !input.customerPhone.trim()) errors.push('No WhatsApp wajib diisi.');
  if (!input.serviceName || !input.serviceName.trim()) errors.push('Nama layanan wajib diisi.');
  if (!input.bookingDate) errors.push('Tanggal booking wajib diisi.');
  if (input.totalPrice === '' || Number(input.totalPrice) <= 0) errors.push('Total harga wajib diisi dan lebih dari 0.');
  return errors;
}

export interface QueueFormInput {
  customerName: string;
}

export function validateQueueForm(input: QueueFormInput): string[] {
  const errors: string[] = [];
  if (!input.customerName || !input.customerName.trim()) errors.push('Nama pelanggan wajib diisi.');
  return errors;
}

export interface LoyaltyFormInput {
  customerName: string;
}

export function validateLoyaltyForm(input: LoyaltyFormInput): string[] {
  const errors: string[] = [];
  if (!input.customerName || !input.customerName.trim()) errors.push('Nama pelanggan wajib diisi.');
  return errors;
}

export interface ReminderFormInput {
  customerName: string;
  customerPhone: string;
  serviceName: string;
  bookingDate: string;
}

export function validateReminderForm(input: ReminderFormInput): string[] {
  const errors: string[] = [];
  if (!input.customerName || !input.customerName.trim()) errors.push('Nama pelanggan wajib diisi.');
  if (!input.customerPhone || !input.customerPhone.trim()) errors.push('No WhatsApp wajib diisi.');
  if (!input.serviceName || !input.serviceName.trim()) errors.push('Nama layanan wajib diisi.');
  if (!input.bookingDate) errors.push('Tanggal booking wajib diisi.');
  return errors;
}

/** Kandidat "panggil antrean berikutnya" -- tiket WAITING paling awal (FIFO by
 *  createdAt). Pure & testable; komponen yang pakai fungsi ini yang bertanggung
 *  jawab benar-benar memanggil PUT ke endpoint (fungsi ini tidak fetch apapun). */
export function pickNextWaitingTicket(tickets: QueueTicketRow[]): QueueTicketRow | null {
  const waiting = tickets.filter((t) => t.status === 'WAITING');
  if (waiting.length === 0) return null;
  return waiting.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
}

// ---------------------------------------------------------------------------
// Styling constants (duplikat sengaja -- lihat catatan di atas)
// ---------------------------------------------------------------------------

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

const CARD_STYLE: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: '12px',
  background: '#10141C',
  border: 0,
  boxShadow: '0 4px 16px rgba(0,0,0,0.28)',
  display: 'flex',
  flexDirection: 'column',
  gap: '9px',
};

const SUBMIT_BTN = (bg: string): React.CSSProperties => ({
  marginTop: '2px',
  height: '36px',
  borderRadius: '9px',
  background: bg,
  border: 0,
  color: '#06080C',
  fontFamily: 'inherit',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
});

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 600, background: `${color}1F`, color }}>
      {label}
    </span>
  );
}

function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div style={{ padding: '9px 12px', borderRadius: '9px', background: 'rgba(239,68,68,0.12)', border: 0, boxShadow: '0 4px 18px -2px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
      {errors.map((e, i) => (
        <span key={i} style={{ fontSize: '11px', color: '#F5B8B8' }}>{e}</span>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ minHeight: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.015)' }}>
      <span style={{ fontSize: '11.5px', color: '#7C8698', textAlign: 'center' }}>{text}</span>
    </div>
  );
}

export default function KlirScheduleView() {
  const [tab, setTab] = useState<ScheduleTab>('reservasi');

  // --- Reservasi ---
  const [reservations, setReservations] = useState<BookingReservationRow[]>([]);
  const [reservationSummary, setReservationSummary] = useState<ReservationSummary | null>(null);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [reservationLoadError, setReservationLoadError] = useState<string | null>(null);
  const [busyReservationIds, setBusyReservationIds] = useState<Set<string>>(new Set());

  const [resName, setResName] = useState('');
  const [resPhone, setResPhone] = useState('');
  const [resEmail, setResEmail] = useState('');
  const [resService, setResService] = useState('');
  const [resDate, setResDate] = useState('');
  const [resTime, setResTime] = useState('14:00');
  const [resDuration, setResDuration] = useState<number | ''>(60);
  const [resPrice, setResPrice] = useState<number | ''>('');
  const [resDeposit, setResDeposit] = useState<number | ''>('');
  const [resDepositPaid, setResDepositPaid] = useState(false);
  const [resNotes, setResNotes] = useState('');
  const [resFormErrors, setResFormErrors] = useState<string[]>([]);
  const [resSubmitting, setResSubmitting] = useState(false);
  const [resSubmitMsg, setResSubmitMsg] = useState<string | null>(null);

  // --- Antrean ---
  const [waitingTickets, setWaitingTickets] = useState<QueueTicketRow[]>([]);
  const [currentlyServing, setCurrentlyServing] = useState<QueueTicketRow | null>(null);
  const [queueSummary, setQueueSummary] = useState<QueueSummary | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueLoadError, setQueueLoadError] = useState<string | null>(null);
  const [busyTicketIds, setBusyTicketIds] = useState<Set<string>>(new Set());

  const [queueName, setQueueName] = useState('');
  const [queueService, setQueueService] = useState('');
  const [queueFormErrors, setQueueFormErrors] = useState<string[]>([]);
  const [queueSubmitting, setQueueSubmitting] = useState(false);
  const [queueSubmitMsg, setQueueSubmitMsg] = useState<string | null>(null);

  // --- Loyalitas (stateless, hasil per-submit) ---
  const [loyName, setLoyName] = useState('');
  const [loyPhone, setLoyPhone] = useState('');
  const [loyRating, setLoyRating] = useState(5);
  const [loyFeedback, setLoyFeedback] = useState('');
  const [loySpending, setLoySpending] = useState<number | ''>(150000);
  const [loyFormErrors, setLoyFormErrors] = useState<string[]>([]);
  const [loySubmitting, setLoySubmitting] = useState(false);
  const [loyResult, setLoyResult] = useState<LoyaltyEvaluation | null>(null);
  const [loyError, setLoyError] = useState<string | null>(null);

  // --- Pengingat WA ---
  const [remName, setRemName] = useState('');
  const [remPhone, setRemPhone] = useState('');
  const [remService, setRemService] = useState('');
  const [remDate, setRemDate] = useState('');
  const [remTime, setRemTime] = useState('');
  const [remCode, setRemCode] = useState('');
  const [remLocation, setRemLocation] = useState('Kantor / Studio Pusat');
  const [remFormErrors, setRemFormErrors] = useState<string[]>([]);
  const [remSubmitting, setRemSubmitting] = useState(false);
  const [remResult, setRemResult] = useState<ReminderResult | null>(null);
  const [remError, setRemError] = useState<string | null>(null);

  // --- Fetch reservasi & antrean ---
  const fetchReservations = useCallback(async () => {
    setLoadingReservations(true);
    setReservationLoadError(null);
    try {
      const res = await fetch('/api/v1/booking/reservations', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal memuat data reservasi.');
      setReservations(data.reservations || []);
      setReservationSummary(data.summary || null);
    } catch (err: any) {
      setReservationLoadError(err.message || 'Gagal memuat data reservasi.');
    } finally {
      setLoadingReservations(false);
    }
  }, []);

  const fetchQueue = useCallback(async () => {
    setLoadingQueue(true);
    setQueueLoadError(null);
    try {
      const res = await fetch('/api/v1/booking/queue', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal memuat data antrean.');
      setWaitingTickets(data.waitingTickets || []);
      setCurrentlyServing(data.currentlyServing || null);
      setQueueSummary(data.summary || null);
    } catch (err: any) {
      setQueueLoadError(err.message || 'Gagal memuat data antrean.');
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
    fetchQueue();
  }, [fetchReservations, fetchQueue]);

  // Refresh kalau ada perubahan data dari tempat lain (pola sama WorkspaceDataHub.tsx)
  useEffect(() => {
    const handler = () => {
      fetchReservations();
      fetchQueue();
    };
    window.addEventListener('klir-ai-state-updated', handler);
    return () => window.removeEventListener('klir-ai-state-updated', handler);
  }, [fetchReservations, fetchQueue]);

  // --- Submit reservasi baru ---
  const submitReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateReservationForm({ customerName: resName, customerPhone: resPhone, serviceName: resService, bookingDate: resDate, totalPrice: resPrice });
    setResFormErrors(errors);
    setResSubmitMsg(null);
    if (errors.length > 0) return;

    setResSubmitting(true);
    try {
      const res = await fetch('/api/v1/booking/reservations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: resName,
          customerPhone: resPhone,
          customerEmail: resEmail || undefined,
          serviceName: resService,
          bookingDate: resDate,
          bookingTime: resTime || '14:00',
          durationMinutes: resDuration === '' ? 60 : Number(resDuration),
          totalPrice: Number(resPrice),
          depositAmount: resDeposit === '' ? 0 : Number(resDeposit),
          isDepositPaid: resDepositPaid,
          notes: resNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal membuat reservasi.');

      setResSubmitMsg(data.message || 'Reservasi berhasil dibuat.');
      setResName(''); setResPhone(''); setResEmail(''); setResService(''); setResDate('');
      setResTime('14:00'); setResDuration(60); setResPrice(''); setResDeposit(''); setResDepositPaid(false); setResNotes('');
      await fetchReservations();
      window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
      if (resDepositPaid && Number(resDeposit) > 0) {
        window.dispatchEvent(new CustomEvent('klir-kas-updated'));
      }
    } catch (err: any) {
      setResFormErrors([err.message || 'Gagal membuat reservasi.']);
    } finally {
      setResSubmitting(false);
    }
  };

  // --- Ubah status reservasi ---
  const updateReservationStatus = async (reservationId: string, status: BookingStatusValue, markDepositPaid = false) => {
    setBusyReservationIds((prev) => new Set(prev).add(reservationId));
    try {
      const res = await fetch('/api/v1/booking/reservations', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId, status, markDepositPaid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal memperbarui status reservasi.');
      await fetchReservations();
      window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
      // PUT reservations/route.ts hanya menulis CashTransaction saat transisi ke
      // COMPLETED (pelunasan) -- refresh Kas hanya untuk kasus itu, bukan tiap PUT.
      if (status === 'COMPLETED') {
        window.dispatchEvent(new CustomEvent('klir-kas-updated'));
      }
    } catch (err: any) {
      setReservationLoadError(err.message || 'Gagal memperbarui status reservasi.');
    } finally {
      setBusyReservationIds((prev) => {
        const next = new Set(prev);
        next.delete(reservationId);
        return next;
      });
    }
  };

  // --- Submit tiket antrean baru ---
  const submitQueueTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateQueueForm({ customerName: queueName });
    setQueueFormErrors(errors);
    setQueueSubmitMsg(null);
    if (errors.length > 0) return;

    setQueueSubmitting(true);
    try {
      const res = await fetch('/api/v1/booking/queue', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: queueName, serviceType: queueService || 'Layanan Umum' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal mengambil nomor antrean.');
      setQueueSubmitMsg(data.message || 'Nomor antrean berhasil dibuat.');
      setQueueName(''); setQueueService('');
      await fetchQueue();
      window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
    } catch (err: any) {
      setQueueFormErrors([err.message || 'Gagal mengambil nomor antrean.']);
    } finally {
      setQueueSubmitting(false);
    }
  };

  // --- Ubah status tiket antrean ---
  const updateTicketStatus = async (ticketId: string, status: QueueStatusValue) => {
    setBusyTicketIds((prev) => new Set(prev).add(ticketId));
    try {
      const res = await fetch('/api/v1/booking/queue', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal memperbarui status tiket.');
      await fetchQueue();
      window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
    } catch (err: any) {
      setQueueLoadError(err.message || 'Gagal memperbarui status tiket.');
    } finally {
      setBusyTicketIds((prev) => {
        const next = new Set(prev);
        next.delete(ticketId);
        return next;
      });
    }
  };

  // "Panggil antrean berikutnya": kalau ada yang SERVING sekarang, selesaikan dulu,
  // baru set tiket WAITING paling awal (FIFO, pakai pickNextWaitingTicket) jadi SERVING.
  const callNextTicket = async () => {
    if (currentlyServing) {
      await updateTicketStatus(currentlyServing.id, 'COMPLETED');
    }
    const next = pickNextWaitingTicket(waitingTickets);
    if (next) {
      await updateTicketStatus(next.id, 'SERVING');
    }
  };

  // --- Submit evaluasi loyalitas ---
  const submitLoyalty = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateLoyaltyForm({ customerName: loyName });
    setLoyFormErrors(errors);
    setLoyError(null);
    if (errors.length > 0) return;

    setLoySubmitting(true);
    try {
      const res = await fetch('/api/v1/booking/loyalty', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: loyName,
          customerPhone: loyPhone || undefined,
          rating: loyRating,
          feedback: loyFeedback || undefined,
          spendingAmount: loySpending === '' ? 0 : Number(loySpending),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal mengevaluasi poin loyalitas.');
      setLoyResult(data.loyaltyEvaluation);
    } catch (err: any) {
      setLoyError(err.message || 'Gagal mengevaluasi poin loyalitas.');
    } finally {
      setLoySubmitting(false);
    }
  };

  // --- Isi form pengingat dari 1 baris reservasi ---
  const fillReminderFromReservation = (r: BookingReservationRow) => {
    setRemName(r.customerName);
    setRemPhone(r.customerPhone);
    setRemService(r.serviceName);
    setRemDate(r.bookingDate.slice(0, 10));
    setRemTime(r.bookingTime);
    setRemCode(r.bookingCode);
    setRemResult(null);
    setRemError(null);
    setTab('reminder');
  };

  // --- Submit generate pengingat WA ---
  const submitReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateReminderForm({ customerName: remName, customerPhone: remPhone, serviceName: remService, bookingDate: remDate });
    setRemFormErrors(errors);
    setRemError(null);
    if (errors.length > 0) return;

    setRemSubmitting(true);
    try {
      const res = await fetch('/api/v1/booking/reminder', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingCode: remCode || undefined,
          customerName: remName,
          customerPhone: remPhone,
          serviceName: remService,
          bookingDate: remDate,
          bookingTime: remTime || undefined,
          location: remLocation || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal membuat pesan pengingat.');
      setRemResult(data.reminder);
    } catch (err: any) {
      setRemError(err.message || 'Gagal membuat pesan pengingat.');
    } finally {
      setRemSubmitting(false);
    }
  };

  return (
    <div style={{ gridColumn: '1 / -1', marginTop: '18px', borderTop: 0, paddingTop: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div>
          <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>
            Reservasi & Antrean
          </h4>
          <span style={{ fontSize: '11px', color: '#7C8698' }}>Jadwal booking, antrean layanan, poin loyalitas pelanggan, dan pengingat ke pelanggan</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setTab('reservasi')} style={TAB_BTN(tab === 'reservasi')}>
            <CalendarClock size={13} /> Reservasi
          </button>
          <button type="button" onClick={() => setTab('antrean')} style={TAB_BTN(tab === 'antrean')}>
            <Users size={13} /> Antrean
          </button>
          <button type="button" onClick={() => setTab('loyalitas')} style={TAB_BTN(tab === 'loyalitas')}>
            <Star size={13} /> Loyalitas
          </button>
          <button type="button" onClick={() => setTab('reminder')} style={TAB_BTN(tab === 'reminder')}>
            <Send size={13} /> Pengingat
          </button>
        </div>
      </div>

      {/* ---------------- TAB: RESERVASI ---------------- */}
      {tab === 'reservasi' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {reservationSummary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '10px' }}>
              <div style={CARD_STYLE}>
                <span style={{ fontSize: '10.5px', color: '#98A2B3' }}>Total booking</span>
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#F5F7FA' }}>{reservationSummary.totalBookings}</span>
              </div>
              <div style={CARD_STYLE}>
                <span style={{ fontSize: '10.5px', color: '#98A2B3' }}>Terkonfirmasi</span>
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#4E9BFF' }}>{reservationSummary.confirmedCount}</span>
              </div>
              <div style={CARD_STYLE}>
                <span style={{ fontSize: '10.5px', color: '#98A2B3' }}>Selesai</span>
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#3FBF8F' }}>{reservationSummary.completedCount}</span>
              </div>
              <div style={CARD_STYLE}>
                <span style={{ fontSize: '10.5px', color: '#98A2B3' }}>Omzet terjadwal</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#F5F7FA', fontFamily: "'JetBrains Mono', monospace" }}>{formatRupiah(reservationSummary.totalRevenueBooked)}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)', gap: '16px' }}>
            <form onSubmit={submitReservation} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={LABEL_STYLE}>Nama pelanggan</label>
                <input style={INPUT_STYLE} type="text" value={resName} onChange={(e) => setResName(e.target.value)} placeholder="mis. Rina Wulandari" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={LABEL_STYLE}>No WhatsApp</label>
                  <input style={INPUT_STYLE} type="text" value={resPhone} onChange={(e) => setResPhone(e.target.value)} placeholder="0812-3456-7890" />
                </div>
                <div>
                  <label style={LABEL_STYLE}>Email (opsional)</label>
                  <input style={INPUT_STYLE} type="email" value={resEmail} onChange={(e) => setResEmail(e.target.value)} placeholder="email pelanggan" />
                </div>
              </div>
              <div>
                <label style={LABEL_STYLE}>Nama layanan</label>
                <input style={INPUT_STYLE} type="text" value={resService} onChange={(e) => setResService(e.target.value)} placeholder="mis. Potong Rambut + Creambath" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={LABEL_STYLE}>Tanggal</label>
                  <input style={INPUT_STYLE} type="date" value={resDate} onChange={(e) => setResDate(e.target.value)} />
                </div>
                <div>
                  <label style={LABEL_STYLE}>Jam</label>
                  <input style={INPUT_STYLE} type="time" value={resTime} onChange={(e) => setResTime(e.target.value)} />
                </div>
                <div>
                  <label style={LABEL_STYLE}>Durasi (menit)</label>
                  <input style={INPUT_STYLE} type="number" min={1} value={resDuration} onChange={(e) => setResDuration(e.target.value === '' ? '' : Number(e.target.value))} placeholder="60" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={LABEL_STYLE}>Total harga (Rp)</label>
                  <input style={INPUT_STYLE} type="number" min={0} value={resPrice} onChange={(e) => setResPrice(e.target.value === '' ? '' : Number(e.target.value))} placeholder="150000" />
                </div>
                <div>
                  <label style={LABEL_STYLE}>Uang muka / DP (Rp)</label>
                  <input style={INPUT_STYLE} type="number" min={0} value={resDeposit} onChange={(e) => setResDeposit(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: '#98A2B3', cursor: 'pointer' }}>
                <input type="checkbox" checked={resDepositPaid} onChange={(e) => setResDepositPaid(e.target.checked)} />
                DP sudah dibayar (otomatis tercatat sebagai pemasukan di KLIR Kas)
              </label>
              <div>
                <label style={LABEL_STYLE}>Catatan (opsional)</label>
                <textarea rows={2} value={resNotes} onChange={(e) => setResNotes(e.target.value)} placeholder="Catatan tambahan..." style={{ ...INPUT_STYLE, height: 'auto', padding: '9px 12px', resize: 'none', fontFamily: 'inherit' }} />
              </div>
              <ErrorList errors={resFormErrors} />
              {resSubmitMsg && <span style={{ fontSize: '11px', color: '#3FBF8F' }}>{resSubmitMsg}</span>}
              <button type="submit" disabled={resSubmitting} style={{ ...SUBMIT_BTN('#3FBF8F'), opacity: resSubmitting ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Plus size={14} /> {resSubmitting ? 'Menyimpan...' : 'Buat reservasi'}
              </button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '480px', overflowY: 'auto' }}>
              {loadingReservations && <EmptyState text="Memuat data reservasi..." />}
              {!loadingReservations && reservationLoadError && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <ErrorList errors={[reservationLoadError]} />
                  <button type="button" onClick={fetchReservations} style={{ ...TAB_BTN(false), alignSelf: 'flex-start' }}><RefreshCw size={12} /> Coba lagi</button>
                </div>
              )}
              {!loadingReservations && !reservationLoadError && reservations.length === 0 && <EmptyState text="Belum ada reservasi. Isi form di kiri untuk buat yang pertama." />}
              {!loadingReservations && reservations.map((r) => {
                const meta = BOOKING_STATUS_META[r.status];
                const busy = busyReservationIds.has(r.id);
                return (
                  <div key={r.id} style={{ padding: '11px 13px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#F5F7FA' }}>{r.customerName}</span>
                        <span style={{ fontSize: '10.5px', color: '#7C8698' }}>{r.serviceName} &middot; #{r.bookingCode}</span>
                      </div>
                      <StatusBadge label={meta.label} color={meta.color} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#98A2B3' }}>
                      <span>{formatDateID(r.bookingDate)} &middot; {r.bookingTime}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#F5F7FA' }}>{formatRupiah(r.totalPrice)}</span>
                    </div>
                    {r.depositAmount > 0 && (
                      <span style={{ fontSize: '10.5px', color: r.isDepositPaid ? '#3FBF8F' : '#D8A33C' }}>
                        DP {formatRupiah(r.depositAmount)} &middot; {r.isDepositPaid ? 'sudah dibayar' : 'belum dibayar'}
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                      {r.status === 'PENDING_DEPOSIT' && (
                        <button type="button" disabled={busy} onClick={() => updateReservationStatus(r.id, 'CONFIRMED', true)} style={{ ...TAB_BTN(false), padding: '5px 10px', fontSize: '10.5px' }}>
                          <CheckCircle2 size={11} /> Konfirmasi + DP lunas
                        </button>
                      )}
                      {(r.status === 'CONFIRMED' || r.status === 'PENDING_DEPOSIT') && (
                        <>
                          <button type="button" disabled={busy} onClick={() => updateReservationStatus(r.id, 'COMPLETED')} style={{ ...TAB_BTN(false), padding: '5px 10px', fontSize: '10.5px', color: '#3FBF8F' }}>
                            <CheckCircle2 size={11} /> Tandai selesai
                          </button>
                          <button type="button" disabled={busy} onClick={() => updateReservationStatus(r.id, 'CANCELLED')} style={{ ...TAB_BTN(false), padding: '5px 10px', fontSize: '10.5px', color: '#EF4444' }}>
                            <XCircle size={11} /> Batalkan
                          </button>
                        </>
                      )}
                      <button type="button" onClick={() => fillReminderFromReservation(r)} style={{ ...TAB_BTN(false), padding: '5px 10px', fontSize: '10.5px', color: '#4E9BFF' }}>
                        <Send size={11} /> Kirim pengingat
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB: ANTREAN ---------------- */}
      {tab === 'antrean' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {queueSummary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '10px' }}>
              <div style={CARD_STYLE}>
                <span style={{ fontSize: '10.5px', color: '#98A2B3' }}>Sedang dilayani</span>
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#3FBF8F' }}>{queueSummary.currentlyServingNumber}</span>
                <span style={{ fontSize: '10px', color: '#7C8698' }}>{queueSummary.currentlyServingName}</span>
              </div>
              <div style={CARD_STYLE}>
                <span style={{ fontSize: '10.5px', color: '#98A2B3' }}>Menunggu</span>
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#D8A33C' }}>{queueSummary.waitingCount}</span>
              </div>
              <div style={CARD_STYLE}>
                <span style={{ fontSize: '10.5px', color: '#98A2B3' }}>Selesai hari ini</span>
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#F5F7FA' }}>{queueSummary.completedCount}</span>
              </div>
              <div style={CARD_STYLE}>
                <span style={{ fontSize: '10.5px', color: '#98A2B3' }}>Total tiket hari ini</span>
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#F5F7FA' }}>{queueSummary.totalTicketsToday}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <form onSubmit={submitQueueTicket} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={LABEL_STYLE}>Nama pelanggan</label>
                  <input style={INPUT_STYLE} type="text" value={queueName} onChange={(e) => setQueueName(e.target.value)} placeholder="mis. Budi Hartono" />
                </div>
                <div>
                  <label style={LABEL_STYLE}>Jenis layanan</label>
                  <input style={INPUT_STYLE} type="text" value={queueService} onChange={(e) => setQueueService(e.target.value)} placeholder="Layanan Umum" />
                </div>
                <ErrorList errors={queueFormErrors} />
                {queueSubmitMsg && <span style={{ fontSize: '11px', color: '#3FBF8F' }}>{queueSubmitMsg}</span>}
                <button type="submit" disabled={queueSubmitting} style={{ ...SUBMIT_BTN('#4E9BFF'), opacity: queueSubmitting ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Plus size={14} /> {queueSubmitting ? 'Mengambil nomor...' : 'Ambil nomor antrean'}
                </button>
              </form>

              <button
                type="button"
                onClick={callNextTicket}
                disabled={!currentlyServing && waitingTickets.length === 0}
                style={{ ...SUBMIT_BTN('#D8A33C'), opacity: (!currentlyServing && waitingTickets.length === 0) ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <PhoneCall size={14} /> Panggil antrean berikutnya
              </button>

              {queueLoadError && <ErrorList errors={[queueLoadError]} />}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
              {currentlyServing && (
                <div style={{ padding: '11px 13px', borderRadius: '10px', background: 'rgba(63,191,143,0.12)', border: 0, boxShadow: '0 4px 18px -2px rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#3FBF8F' }}>{currentlyServing.queueNumber}</span>
                    <span style={{ fontSize: '11px', color: '#F5F7FA' }}>{currentlyServing.customerName} &middot; {currentlyServing.serviceType}</span>
                  </div>
                  <button type="button" disabled={busyTicketIds.has(currentlyServing.id)} onClick={() => updateTicketStatus(currentlyServing.id, 'COMPLETED')} style={{ ...TAB_BTN(false), padding: '5px 10px', fontSize: '10.5px', color: '#3FBF8F' }}>
                    <CheckCircle2 size={11} /> Selesai
                  </button>
                </div>
              )}
              {loadingQueue && <EmptyState text="Memuat data antrean..." />}
              {!loadingQueue && waitingTickets.length === 0 && !currentlyServing && <EmptyState text="Belum ada antrean. Isi form di kiri untuk ambil nomor pertama." />}
              {!loadingQueue && waitingTickets.map((t) => {
                const busy = busyTicketIds.has(t.id);
                return (
                  <div key={t.id} style={{ padding: '10px 13px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.28)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#F5F7FA' }}>{t.queueNumber} &middot; {t.customerName}</span>
                      <span style={{ fontSize: '10.5px', color: '#7C8698' }}>{t.serviceType} &middot; estimasi {formatWaitLabel(t.estimatedWaitMinutes)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button type="button" disabled={busy} onClick={() => updateTicketStatus(t.id, 'SERVING')} style={{ ...TAB_BTN(false), padding: '5px 9px', fontSize: '10px' }}>
                        <PhoneCall size={10} /> Panggil
                      </button>
                      <button type="button" disabled={busy} onClick={() => updateTicketStatus(t.id, 'SKIPPED')} style={{ ...TAB_BTN(false), padding: '5px 9px', fontSize: '10px', color: '#EF4444' }}>
                        <SkipForward size={10} /> Lewati
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB: LOYALITAS ---------------- */}
      {tab === 'loyalitas' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '16px' }}>
          <form onSubmit={submitLoyalty} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={LABEL_STYLE}>Nama pelanggan</label>
              <input style={INPUT_STYLE} type="text" value={loyName} onChange={(e) => setLoyName(e.target.value)} placeholder="mis. Dewi Anggraini" />
            </div>
            <div>
              <label style={LABEL_STYLE}>No WhatsApp (opsional)</label>
              <input style={INPUT_STYLE} type="text" value={loyPhone} onChange={(e) => setLoyPhone(e.target.value)} placeholder="0812-3456-7890" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={LABEL_STYLE}>Rating kepuasan (1-5)</label>
                <input style={INPUT_STYLE} type="number" min={1} max={5} value={loyRating} onChange={(e) => setLoyRating(Math.max(1, Math.min(5, Number(e.target.value) || 1)))} />
                <span style={{ fontSize: '13px', marginTop: '4px', display: 'inline-block' }}>{ratingToStars(loyRating)}</span>
              </div>
              <div>
                <label style={LABEL_STYLE}>Nilai transaksi (Rp)</label>
                <input style={INPUT_STYLE} type="number" min={0} value={loySpending} onChange={(e) => setLoySpending(e.target.value === '' ? '' : Number(e.target.value))} placeholder="150000" />
              </div>
            </div>
            <div>
              <label style={LABEL_STYLE}>Feedback pelanggan (opsional)</label>
              <textarea rows={2} value={loyFeedback} onChange={(e) => setLoyFeedback(e.target.value)} placeholder="Pelayanan sangat memuaskan..." style={{ ...INPUT_STYLE, height: 'auto', padding: '9px 12px', resize: 'none', fontFamily: 'inherit' }} />
            </div>
            <ErrorList errors={loyFormErrors} />
            <button type="submit" disabled={loySubmitting} style={{ ...SUBMIT_BTN('#D8A33C'), opacity: loySubmitting ? 0.6 : 1 }}>
              {loySubmitting ? 'Menghitung...' : 'Evaluasi poin loyalitas'}
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {loyError && <ErrorList errors={[loyError]} />}
            {loyResult ? (
              <div style={CARD_STYLE}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: 0 }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>{loyResult.customerName}</span>
                  <span style={{ fontSize: '14px' }}>{loyResult.stars}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                  <span style={{ fontSize: '11.5px', color: '#98A2B3' }}>Poin didapat transaksi ini</span>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: '#D8A33C', fontFamily: "'JetBrains Mono', monospace" }}>+{loyResult.pointsEarned}</span>
                </div>
                <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.55, color: '#CBD3DF' }}>"{loyResult.feedbackText}"</p>
                {loyResult.alertStatus === 'EARLY_COMPLAINT_ALERT' && (
                  <div style={{ padding: '9px 12px', borderRadius: '9px', background: 'rgba(239,68,68,0.12)', border: 0, boxShadow: '0 4px 18px -2px rgba(0,0,0,0.4)' }}>
                    <span style={{ fontSize: '11px', lineHeight: 1.5, color: '#F5B8B8' }}>{loyResult.managementAction}</span>
                  </div>
                )}
                {loyResult.alertStatus !== 'EARLY_COMPLAINT_ALERT' && (
                  <span style={{ fontSize: '10.5px', color: '#7C8698' }}>{loyResult.managementAction}</span>
                )}
              </div>
            ) : (
              <EmptyState text="Isi form di kiri untuk lihat evaluasi poin loyalitas" />
            )}
            <span style={{ fontSize: '10px', color: '#7C8698', lineHeight: 1.5 }}>
              Catatan: poin dihitung per transaksi ini saja (1 poin per Rp 10.000) -- belum ada tabel profil loyalitas yang mengakumulasi poin lintas kunjungan pelanggan.
            </span>
          </div>
        </div>
      )}

      {/* ---------------- TAB: PENGINGAT WA ---------------- */}
      {tab === 'reminder' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '16px' }}>
          <form onSubmit={submitReminder} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={LABEL_STYLE}>Nama pelanggan</label>
              <input style={INPUT_STYLE} type="text" value={remName} onChange={(e) => setRemName(e.target.value)} placeholder="mis. Rina Wulandari" />
            </div>
            <div>
              <label style={LABEL_STYLE}>No WhatsApp</label>
              <input style={INPUT_STYLE} type="text" value={remPhone} onChange={(e) => setRemPhone(e.target.value)} placeholder="0812-3456-7890" />
              {remPhone && <span style={{ fontSize: '10px', color: '#7C8698', marginTop: '4px', display: 'inline-block' }}>Target wa.me: {normalizeWaPhone(remPhone) || '-'}</span>}
            </div>
            <div>
              <label style={LABEL_STYLE}>Nama layanan</label>
              <input style={INPUT_STYLE} type="text" value={remService} onChange={(e) => setRemService(e.target.value)} placeholder="mis. Potong Rambut" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={LABEL_STYLE}>Tanggal</label>
                <input style={INPUT_STYLE} type="date" value={remDate} onChange={(e) => setRemDate(e.target.value)} />
              </div>
              <div>
                <label style={LABEL_STYLE}>Jam</label>
                <input style={INPUT_STYLE} type="time" value={remTime} onChange={(e) => setRemTime(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={LABEL_STYLE}>Kode booking (opsional)</label>
                <input style={INPUT_STYLE} type="text" value={remCode} onChange={(e) => setRemCode(e.target.value)} placeholder="Kode dari daftar reservasi" />
              </div>
              <div>
                <label style={LABEL_STYLE}>Lokasi</label>
                <input style={INPUT_STYLE} type="text" value={remLocation} onChange={(e) => setRemLocation(e.target.value)} placeholder="Kantor / Studio Pusat" />
              </div>
            </div>
            <ErrorList errors={remFormErrors} />
            <button type="submit" disabled={remSubmitting} style={{ ...SUBMIT_BTN('#4E9BFF'), opacity: remSubmitting ? 0.6 : 1 }}>
              {remSubmitting ? 'Membuat pesan...' : 'Buat pesan pengingat'}
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {remError && <ErrorList errors={[remError]} />}
            {remResult ? (
              <div style={CARD_STYLE}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#F5F7FA' }}>Preview pesan untuk {remResult.customerName}</span>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '11.5px', lineHeight: 1.6, color: '#CBD3DF', background: '#06080C', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {remResult.reminderMessage}
                </pre>
                {remResult.channel === 'in_app' ? (
                  <>
                    <StatusBadge label={reminderDeliveryLabel(remResult.channel)} color="#3FBF8F" />
                    <span style={{ fontSize: '10px', color: '#7C8698' }}>Paket workspace ini pakai notifikasi in-app, bukan WhatsApp manual -- pelanggan menerima pesan pengingat ini otomatis lewat sistem KLIR.</span>
                  </>
                ) : remResult.directWaUrl ? (
                  <>
                    <a
                      href={remResult.directWaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ...SUBMIT_BTN('#25D366'), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', textDecoration: 'none' }}
                    >
                      <Send size={14} /> Buka WhatsApp & kirim manual
                    </a>
                    <span style={{ fontSize: '10px', color: '#7C8698' }}>Link membuka WhatsApp Web/app dengan pesan siap kirim -- staf tetap yang menekan tombol Kirim di WhatsApp.</span>
                  </>
                ) : (
                  <span style={{ fontSize: '10px', color: '#7C8698' }}>Link WhatsApp tidak tersedia untuk pesan ini.</span>
                )}
              </div>
            ) : (
              <EmptyState text="Isi form di kiri (atau klik 'Kirim pengingat' dari daftar reservasi) untuk buat pesan" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
