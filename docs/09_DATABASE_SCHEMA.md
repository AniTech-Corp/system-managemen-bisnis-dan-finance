# 🗄️ Spesifikasi Skema Basis Data KLIR OS (Neon Postgres & Prisma ORM)

Arsitektur data KLIR OS mengadopsi standar **Multi-Tenant Strict Isolation** menggunakan Neon Serverless Postgres dan Prisma ORM 6.3.1.

---

## 🔑 Aturan Kritis Basis Data
1. **Mandatory Tenant Key (`workspace_id`)**:
   * Setiap tabel transaksi, log, dan entitas data wajib menyertakan kolom `workspace_id`.
2. **Atomic SQL Transactions**:
   * Pemotongan kredit token dan pencatatan audit ledger wajib dieksekusi di dalam satu blok transaksi database untuk mencegah *race condition* dan *double-spending*.
3. **Dual Connection String**:
   * `DATABASE_URL`: Connection string dengan pooling (PgBouncer) untuk query cepat aplikasi.
   * `DIRECT_URL`: Connection string langsung ke instans Postgres untuk proses migrasi skema.

---

## 📊 Daftar Tabel Utama Berdasarkan Domain

### 1. Fondasi, Autentikasi & Multi-Tenancy
* **`User`**: Identitas akun pengguna (Email, Password Hash via Argon2, Full Name, Avatar).
* **`RefreshToken`**: Sesi token JWT untuk rotasi kredensial pengguna.
* **`Workspace`**: Tenant bisnis/perusahaan (Nama, Slug, Owner, Modul Aktif).
* **`WorkspaceMember`**: Keanggotaan tenant, peran izin (`Role`: OWNER, ADMIN, MANAGER, MEMBER, VIEWER), dan pembagian divisi (`DivisionRole`: CEO, FINANCE, MARKETING, SEKRETARIS, MANAGER_UMUM, MANAGER_OPERASIONAL).
* **`Subscription`**: Status langganan (Free, Started, Business) dengan akses `KLIR_ALL`.
* **`CreditAccount` & `CreditLedger`**: Saldo kredit mingguan/cadangan dan riwayat transaksi audit kredit.
* **`FeatureCost`**: Biaya kredit per fitur operasional.
* **`WorkspaceAIKey`**: Konfigurasi BYOK (Bring Your Own Key) untuk model AI pihak ketiga.
* **`ActivityEvent`**: Audit trail aktivitas sistem, keamanan, dan riwayat persetujuan guardrail.
* **`ResourceGrant`**: Delegasi izin akses sumber daya departemen.

### 2. Domain Finance (Keuangan & Perpajakan)
* **`CashTransaction`**: Pembukuan arus kas masuk/keluar harian.
* **`Invoice`**: Penerbitan invoice pembayaran QRIS / transfer beserta status pembayarannya.
* **`Customer`**: Data kontak pelanggan/klien untuk faktur dan penjualan.

### 3. Domain Marketing (Pemasaran & Konten)
* **`Campaign`**: Kampanye promosi dan pelacakan anggaran/performa.
* **`PromoCoupon`**: Kupon diskon dan promosi penjualan.
* **`ContentCalendar`**: Penjadwalan kalender konten mingguan/bulanan media sosial.

### 4. Domain Sekretaris & Memory
* **`WorkspaceFile`**: Berkas dokumen perusahaan, draf notulen, surat formal, dan lampiran.
* **`MemoryItem`**: Memori pengetahuan bisnis dan profil perusahaan (`[COMPANY_PROFILE]`, `[COMPANY_KNOWLEDGE]`).

### 5. Domain Manager Umum (Manajemen Tim & SDM)
* **`WorkTask`**: Papan tugas tim (Kanban) dan pelacakan status pekerjaan.
* **`AttendanceRecord`**: Presensi kehadiran karyawan (check-in, check-out, status).
* **`EmployeePayroll`**: Penggajian dan kompensasi karyawan.

### 6. Domain Manager Operasional & Inventory (Gudang & Rantai Pasok)
* **`Product`**: Katalog produk/barang gudang (SKU, nama, harga jual, stok minimum).
* **`ProductBatch`**: Nomor batch produksi, tanggal kedaluwarsa, dan nomor lot.
* **`StockMovement`**: Riwayat mutasi stok masuk, keluar, dan penyesuaian opname.
* **`PurchaseOrder`**: Surat pemesanan pembelian ke pemasok (supplier PO).
* **`StockReturn`**: Dokumen retur barang cacat/rusak ke vendor.
* **`SupplierScore`**: Penilaian kinerja dan rekam jejak keandalan pemasok.

### 7. Domain Operasional Pendukung & Jadwal
* **`BookingReservation` & `QueueTicket`**: Reservasi layanan dan sistem antrean pelanggan.
* **`ScheduledObligation`**: Jadwal kewajiban rutin (pajak, sewa, tagihan utilitas).
* **`VideoJob`**: Antrean pemrosesan media video promosi AI.
