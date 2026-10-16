// SUMBER ASLI: src/app/page.tsx (repo KLIR-main, snapshot 23 Agustus 2026)
// RENTANG BARIS ASLI: baris 4375 - 4923 (kondisional render: {activeView === 'booking' \&\& (...)})
// KONTEKS: Modul KLIR Booking -- Scheduling, Queue, Reminders, Loyalty Engine
// CATATAN: ini POTONGAN KODE ASLI dari aplikasi fungsional yang sudah dibangun Tim Pengembang,
// DISERTAKAN sebagai referensi fitur/copy/struktur data -- BUKAN untuk ditiru 1:1 sebagai layout visual.
// Bahasa visual/DNA WAJIB ikut SISTEM-DESAIN-BERSAMA.md + CorPlan v5 / AniVirtual v5, bukan struktur div/class Tailwind di bawah ini.

          {/* VIEW 6: KLIR BOOKING (RESERVATIONS, QUEUE, REMINDERS, & LOYALTY) */}
          {activeView === 'booking' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <div>
                  <h1 className="font-heading font-bold text-xl text-white">KLIR Booking — Scheduling & Loyalty Engine</h1>
                  <p className="text-xs text-[#8a8f98]">Reservasi jadwal mandiri, antrean tiket digital, pengingat WhatsApp, & reward poin loyalitas.</p>
                </div>

                <div className="flex bg-[#15161c] p-1 rounded-xl border border-white/10 text-xs flex-wrap gap-1">
                  <button
                    onClick={() => {
                      setBookingSubTab('reservations');
                      fetchBookingData();
                    }}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${bookingSubTab === 'reservations' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    1. Jadwal Reservasi
                  </button>
                  <button
                    onClick={() => {
                      setBookingSubTab('queue');
                      fetchBookingData();
                    }}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${bookingSubTab === 'queue' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    2. Antrean Tiket Digital
                  </button>
                  <button
                    onClick={() => setBookingSubTab('reminder')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${bookingSubTab === 'reminder' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    3. Pengingat WhatsApp
                  </button>
                  <button
                    onClick={() => setBookingSubTab('loyalty')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${bookingSubTab === 'loyalty' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    4. Poin Loyalitas & Ulasan
                  </button>
                </div>
              </div>

              {/* Subtab 1: Jadwal Reservasi */}
              {bookingSubTab === 'reservations' && (
                <div className="space-y-6">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="linear-card p-4 rounded-xl space-y-1">
                      <span className="text-[11px] text-[#8a8f98] font-medium">Total Reservasi Masuk</span>
                      <div className="text-xl font-bold text-white">{bookingSummary.totalBookings} Booking</div>
                      <span className="text-[10px] text-[#8a8f98]">Jadwal Terdaftar</span>
                    </div>
                    <div className="linear-card p-4 rounded-xl space-y-1">
                      <span className="text-[11px] text-[#8a8f98] font-medium">Terkonfirmasi (DP Masuk)</span>
                      <div className="text-xl font-bold text-[#00e676]">{bookingSummary.confirmedCount} Slot</div>
                      <span className="text-[10px] text-[#00e676]">Siap Dilayani</span>
                    </div>
                    <div className="linear-card p-4 rounded-xl space-y-1">
                      <span className="text-[11px] text-[#8a8f98] font-medium">Layanan Selesai</span>
                      <div className="text-xl font-bold text-[#00d2ff]">{bookingSummary.completedCount} Selesai</div>
                      <span className="text-[10px] text-[#00d2ff]">Tuntas Dilayani</span>
                    </div>
                    <div className="linear-card p-4 rounded-xl space-y-1">
                      <span className="text-[11px] text-[#8a8f98] font-medium">Nilai Transaksi Reservasi</span>
                      <div className="text-xl font-bold text-[#8d55e8]">Rp {bookingSummary.totalRevenueBooked.toLocaleString()}</div>
                      <span className="text-[10px] text-[#8d55e8]">Gross Booking Value</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6 text-xs">
                    {/* Form Buat Reservasi */}
                    <div className="linear-card-glow p-6 rounded-2xl space-y-4 col-span-1">
                      <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[#00d2ff]" /> Buat Reservasi Jadwal Baru
                      </h3>
                      <form onSubmit={handleCreateReservation} className="space-y-3">
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Nama Klien / Pelanggan</label>
                          <input
                            type="text"
                            value={newBkgCustName}
                            onChange={(e) => setNewBkgCustName(e.target.value)}
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[#8a8f98] block mb-1">No. WhatsApp</label>
                            <input
                              type="text"
                              value={newBkgPhone}
                              onChange={(e) => setNewBkgPhone(e.target.value)}
                              required
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Email (Opsional)</label>
                            <input
                              type="email"
                              value={newBkgEmail}
                              onChange={(e) => setNewBkgEmail(e.target.value)}
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Jenis Layanan / Jasa</label>
                          <input
                            type="text"
                            value={newBkgService}
                            onChange={(e) => setNewBkgService(e.target.value)}
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Tanggal</label>
                            <input
                              type="date"
                              value={newBkgDate}
                              onChange={(e) => setNewBkgDate(e.target.value)}
                              required
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Jam Booking</label>
                            <input
                              type="text"
                              value={newBkgTime}
                              onChange={(e) => setNewBkgTime(e.target.value)}
                              placeholder="14:00"
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Total Biaya (Rp)</label>
                            <input
                              type="number"
                              value={newBkgPrice}
                              onChange={(e) => setNewBkgPrice(e.target.value)}
                              required
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Deposit / DP (Rp)</label>
                            <input
                              type="number"
                              value={newBkgDeposit}
                              onChange={(e) => setNewBkgDeposit(e.target.value)}
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            id="isDepositPaidCheck"
                            checked={newBkgIsPaid}
                            onChange={(e) => setNewBkgIsPaid(e.target.checked)}
                            className="rounded bg-[#15161c] border-white/10 text-[#0058be]"
                          />
                          <label htmlFor="isDepositPaidCheck" className="text-white text-[11px] cursor-pointer">
                            DP Sudah Diterima (Catat otomatis ke Kas)
                          </label>
                        </div>
                        <button type="submit" disabled={bkgLoading} className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2">
                          {bkgLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : '🗓️ Jadwalkan Reservasi'}
                        </button>
                      </form>
                    </div>

                    {/* Daftar Reservasi */}
                    <div className="linear-card p-6 rounded-2xl col-span-2 space-y-4">
                      <div className="flex justify-between items-center border-b border-white/10 pb-3">
                        <h3 className="font-semibold text-sm text-white">Daftar Jadwal Reservasi Pelanggan</h3>
                        <button onClick={fetchBookingData} className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded text-[11px] text-[#8a8f98] flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" /> Refresh
                        </button>
                      </div>
                      <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                        {reservationsList.length > 0 ? (
                          reservationsList.map((r: any) => (
                            <div key={r.id} className="p-4 bg-[#15161c] border border-white/10 rounded-xl space-y-3 hover:border-white/20 transition-all">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-sm">{r.customerName}</span>
                                    <span className="text-[10px] text-[#00d2ff] bg-[#00d2ff]/10 px-2 py-0.5 rounded font-mono">#{r.bookingCode}</span>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${r.status === 'CONFIRMED' ? 'bg-[#00e676]/15 text-[#00e676]' : r.status === 'COMPLETED' ? 'bg-[#8d55e8]/15 text-[#8d55e8]' : 'bg-[#ffab00]/15 text-[#ffab00]'}`}>
                                      {r.status}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-[#8a8f98] mt-1">
                                    💅 {r.serviceName} • 📅 {new Date(r.bookingDate).toLocaleDateString('id-ID')} ({r.bookingTime} WIB)
                                  </div>
                                  <div className="text-[10px] text-[#8a8f98]">
                                    📱 {r.customerPhone} {r.customerEmail ? `• ✉️ ${r.customerEmail}` : ''}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[10px] text-[#8a8f98]">Total Biaya</div>
                                  <div className="font-bold text-base text-[#00d2ff]">Rp {r.totalPrice.toLocaleString()}</div>
                                  {r.depositAmount > 0 && (
                                    <div className="text-[10px] text-[#00e676]">DP: Rp {r.depositAmount.toLocaleString()} (Lunas)</div>
                                  )}
                                </div>
                              </div>

                              <div className="p-2.5 bg-[#121318] border border-white/10 rounded-lg flex items-center justify-between text-[11px]">
                                <div className="text-[#8a8f98] text-[10px]">
                                  {r.status === 'CONFIRMED' ? 'Slot waktu terisi. Siap melayani pada jam reservasi.' : r.status === 'COMPLETED' ? '✓ Layanan telah selesai & tercatat di Buku Kas.' : 'Menunggu pembayaran deposit.'}
                                </div>
                                <div className="flex items-center gap-2">
                                  {r.status !== 'COMPLETED' && (
                                    <button
                                      onClick={() => handleUpdateReservationStatus(r.id, 'COMPLETED')}
                                      className="px-3 py-1 bg-[#00e676]/15 hover:bg-[#00e676]/25 text-[#00e676] border border-[#00e676]/30 font-bold rounded-lg text-[10px] transition-all"
                                    >
                                      ✓ Selesai & Lunasi ke Kas
                                    </button>
                                  )}
                                  {r.status !== 'CANCELLED' && r.status !== 'COMPLETED' && (
                                    <button
                                      onClick={() => handleUpdateReservationStatus(r.id, 'CANCELLED')}
                                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[#ff5252] rounded-lg text-[10px]"
                                    >
                                      Batalkan
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-[#8a8f98] italic py-8 text-center">Belum ada data reservasi pelanggan.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 2: Antrean Tiket Digital */}
              {bookingSubTab === 'queue' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-6 text-xs">
                    {/* Form Ambil Nomor Antrean */}
                    <div className="linear-card-glow p-6 rounded-2xl space-y-4 col-span-1">
                      <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#00d2ff]" /> Cetak Tiket Antrean (Walk-In)
                      </h3>
                      <form onSubmit={handleIssueQueueTicket} className="space-y-3">
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Nama Pelanggan</label>
                          <input
                            type="text"
                            value={newQueueCustName}
                            onChange={(e) => setNewQueueCustName(e.target.value)}
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Jenis Layanan</label>
                          <input
                            type="text"
                            value={newQueueService}
                            onChange={(e) => setNewQueueService(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <button type="submit" disabled={qLoading} className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2">
                          {qLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : '🎫 Ambil Nomor Antrean'}
                        </button>
                      </form>

                      {/* Display Antrean yang Sedang Dipanggil */}
                      <div className="p-4 bg-[#0058be]/10 border border-[#0058be]/30 rounded-2xl text-center space-y-1">
                        <span className="text-[11px] text-[#00d2ff] font-bold">NOMOR SEDANG DILAYANI</span>
                        <div className="text-4xl font-black text-white font-mono tracking-wider">{queueSummary.currentlyServingNumber}</div>
                        <div className="text-[10px] text-[#8a8f98]">Antrean Menunggu: {queueSummary.waitingCount} Orang</div>
                      </div>
                    </div>

                    {/* Daftar Tiket Antrean */}
                    <div className="linear-card p-6 rounded-2xl col-span-2 space-y-4">
                      <div className="flex justify-between items-center border-b border-white/10 pb-3">
                        <h3 className="font-semibold text-sm text-white">Daftar Antrean Hari Ini</h3>
                        <span className="text-[11px] text-[#8a8f98]">{queueTicketsList.length} Tiket Diterbitkan</span>
                      </div>
                      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                        {queueTicketsList.length > 0 ? (
                          queueTicketsList.map((q: any) => (
                            <div key={q.id} className="p-3 bg-[#15161c] border border-white/10 rounded-xl flex items-center justify-between hover:border-white/20 transition-all">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[#0058be]/20 text-[#00d2ff] border border-[#0058be]/30 flex items-center justify-center font-mono font-bold text-sm">
                                  {q.queueNumber}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-white">{q.customerName}</span>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${q.status === 'SERVING' ? 'bg-[#00e676]/20 text-[#00e676] border border-[#00e676]/30' : q.status === 'COMPLETED' ? 'bg-white/10 text-[#8a8f98]' : 'bg-[#ffab00]/15 text-[#ffab00]'}`}>
                                      {q.status}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-[#8a8f98] mt-0.5">
                                    {q.serviceType} • Est. Tunggu: ~{q.estimatedWaitMinutes} menit • {new Date(q.createdAt).toLocaleTimeString('id-ID')}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {q.status === 'WAITING' && (
                                  <button
                                    onClick={() => handleAdvanceQueue(q.id, 'SERVING')}
                                    className="px-2.5 py-1 bg-[#0058be]/20 hover:bg-[#0058be]/30 text-[#00d2ff] border border-[#0058be]/30 rounded text-[10px] font-semibold"
                                  >
                                    📢 Panggil
                                  </button>
                                )}
                                {q.status === 'SERVING' && (
                                  <button
                                    onClick={() => handleAdvanceQueue(q.id, 'COMPLETED')}
                                    className="px-2.5 py-1 bg-[#00e676]/20 hover:bg-[#00e676]/30 text-[#00e676] border border-[#00e676]/30 rounded text-[10px] font-semibold"
                                  >
                                    ✓ Selesai
                                  </button>
                                )}
                                {q.status === 'WAITING' && (
                                  <button
                                    onClick={() => handleAdvanceQueue(q.id, 'SKIPPED')}
                                    className="px-2 py-1 bg-white/5 hover:bg-white/10 text-[#8a8f98] rounded text-[10px]"
                                  >
                                    Lewati
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-[#8a8f98] italic py-8 text-center">Belum ada nomor antrean yang aktif saat ini.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 3: Pengingat WhatsApp */}
              {bookingSubTab === 'reminder' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6 text-xs">
                    <div className="linear-card-glow p-6 rounded-2xl space-y-4">
                      <h3 className="font-semibold text-sm text-white">Generator Pesan Pengingat (Reminder WA)</h3>
                      <form onSubmit={handleGenerateReminder} className="space-y-3">
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Nama Klien</label>
                          <input
                            type="text"
                            value={remCustName}
                            onChange={(e) => setRemCustName(e.target.value)}
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">No. WhatsApp</label>
                          <input
                            type="text"
                            value={remPhone}
                            onChange={(e) => setRemPhone(e.target.value)}
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Layanan</label>
                          <input
                            type="text"
                            value={remService}
                            onChange={(e) => setRemService(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Tanggal</label>
                            <input
                              type="date"
                              value={remDate}
                              onChange={(e) => setRemDate(e.target.value)}
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Jam</label>
                            <input
                              type="text"
                              value={remTime}
                              onChange={(e) => setRemTime(e.target.value)}
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                        </div>
                        <button type="submit" className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold">
                          📲 Generate Pesan & Link WhatsApp
                        </button>
                      </form>
                    </div>

                    {/* Preview Pesan WA */}
                    <div className="linear-card p-6 rounded-2xl space-y-4">
                      <h3 className="font-semibold text-sm text-white">Preview Pesan Pengingat Resmi</h3>
                      {remResult ? (
                        <div className="space-y-4">
                          <div className="p-4 bg-[#15161c] border border-white/10 rounded-xl font-mono text-[11px] leading-relaxed whitespace-pre-line text-white">
                            {remResult.reminderMessage}
                          </div>
                          <div className="flex items-center gap-3">
                            <a
                              href={remResult.directWaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 py-2.5 bg-[#25d366] hover:bg-[#20ba59] text-black font-bold rounded-lg text-center text-xs transition-all shadow-lg shadow-[#25d366]/20"
                            >
                              💬 Buka WhatsApp & Kirim Pesan
                            </a>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(remResult.reminderMessage);
                                alert('✓ Pesan pengingat berhasil disalin!');
                              }}
                              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white"
                            >
                              📋 Salin
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-[#8a8f98] italic py-12 text-center">Isi data jadwal di samping untuk menyusun format pesan pengingat otomatis.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 4: Poin Loyalitas & Ulasan */}
              {bookingSubTab === 'loyalty' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6 text-xs">
                    <div className="linear-card-glow p-6 rounded-2xl space-y-4">
                      <h3 className="font-semibold text-sm text-white">Catat Ulasan & Hitung Poin Loyalitas</h3>
                      <form onSubmit={handleEvaluateLoyalty} className="space-y-3">
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Nama Klien</label>
                          <input
                            type="text"
                            value={loyCustName}
                            onChange={(e) => setLoyCustName(e.target.value)}
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Rating Kepuasan (1 - 5)</label>
                            <select
                              value={loyRating}
                              onChange={(e) => setLoyRating(e.target.value)}
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            >
                              <option value="5">⭐⭐⭐⭐⭐ 5 - Sangat Puas</option>
                              <option value="4">⭐⭐⭐⭐ 4 - Puas</option>
                              <option value="3">⭐⭐⭐ 3 - Cukup / Netral</option>
                              <option value="2">⭐⭐ 2 - Kurang Puas</option>
                              <option value="1">⭐ 1 - Sangat Kecewa</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Nilai Belanja (Rp)</label>
                            <input
                              type="number"
                              value={loySpend}
                              onChange={(e) => setLoySpend(e.target.value)}
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Ulasan / Masukan Pelanggan</label>
                          <textarea
                            rows={3}
                            value={loyFeedback}
                            onChange={(e) => setLoyFeedback(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <button type="submit" className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold">
                          ⭐ Proses Ulasan & Hadiahi Poin
                        </button>
                      </form>
                    </div>

                    {/* Output Evaluasi Loyalitas */}
                    <div className="linear-card p-6 rounded-2xl space-y-4">
                      <h3 className="font-semibold text-sm text-white">Hasil Evaluasi Kepuasan & Reward</h3>
                      {loyResult ? (
                        <div className="space-y-3">
                          <div className="p-4 bg-[#8d55e8]/10 border border-[#8d55e8]/30 rounded-xl flex justify-between items-center">
                            <div>
                              <span className="text-[#8a8f98] block text-[11px]">Reward Poin Diberikan:</span>
                              <div className="text-2xl font-black text-[#8d55e8]">+{loyResult.pointsEarned} Poin</div>
                              <span className="text-[10px] text-white">Akumulasi: {loyResult.totalLoyaltyPoints} Poin Loyalitas</span>
                            </div>
                            <div className="text-right">
                              <span className="text-lg">{loyResult.stars}</span>
                              <span className={`text-[10px] block mt-1 font-bold ${loyResult.alertStatus === 'SATISFIED_CUSTOMER' ? 'text-[#00e676]' : 'text-[#ff5252]'}`}>
                                {loyResult.alertStatus}
                              </span>
                            </div>
                          </div>

                          <div className="p-3 bg-[#15161c] border border-white/10 rounded-lg space-y-1">
                            <span className="text-[#8a8f98] text-[10px] block">💬 Feedback Pelanggan:</span>
                            <p className="text-white italic">"{loyResult.feedbackText}"</p>
                          </div>

                          <div className="p-3 bg-[#121318] border border-white/10 rounded-lg text-[11px] leading-relaxed">
                            <span className="font-bold text-[#00d2ff] block mb-0.5">💡 Tindakan Manajemen:</span>
                            <p className="text-[#8a8f98]">{loyResult.managementAction}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-[#8a8f98] italic py-8 text-center">Catat ulasan pelanggan untuk menghitung poin reward.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
