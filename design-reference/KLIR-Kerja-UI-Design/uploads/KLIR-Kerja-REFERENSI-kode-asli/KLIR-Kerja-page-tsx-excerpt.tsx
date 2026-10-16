// SUMBER ASLI: src/app/page.tsx (repo KLIR-main, snapshot 23 Agustus 2026)
// RENTANG BARIS ASLI: baris 3780 - 4373 (kondisional render: {activeView === 'kerja' \&\& (...)})
// KONTEKS: Modul KLIR Kerja -- Team Operations, Tasks, Attendance, Payroll
// CATATAN: ini POTONGAN KODE ASLI dari aplikasi fungsional yang sudah dibangun Tim Pengembang,
// DISERTAKAN sebagai referensi fitur/copy/struktur data -- BUKAN untuk ditiru 1:1 sebagai layout visual.
// Bahasa visual/DNA WAJIB ikut SISTEM-DESAIN-BERSAMA.md + CorPlan v5 / AniVirtual v5, bukan struktur div/class Tailwind di bawah ini.

          {/* VIEW 5: KLIR KERJA (OPERATIONS, TASKS, ATTENDANCE, & PAYROLL) */}
          {activeView === 'kerja' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <div>
                  <h1 className="font-heading font-bold text-xl text-white">KLIR Kerja — Team Operations & Onboarding</h1>
                  <p className="text-xs text-[#8a8f98]">Papan tugas Kanban, presensi GPS, slip gaji otomatis ke kas, evaluasi KPI, & voice-to-SOP.</p>
                </div>

                <div className="flex bg-[#15161c] p-1 rounded-xl border border-white/10 text-xs flex-wrap gap-1">
                  <button
                    onClick={() => {
                      setKerjaSubTab('kanban');
                      fetchKerjaData();
                    }}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${kerjaSubTab === 'kanban' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    1. Papan Tugas (Kanban)
                  </button>
                  <button
                    onClick={() => {
                      setKerjaSubTab('attendance');
                      fetchKerjaData();
                    }}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${kerjaSubTab === 'attendance' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    2. Presensi GPS & Shift
                  </button>
                  <button
                    onClick={() => {
                      setKerjaSubTab('payroll');
                      fetchKerjaData();
                    }}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${kerjaSubTab === 'payroll' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    3. Penggajian & Slip Gaji
                  </button>
                  <button
                    onClick={() => setKerjaSubTab('kpi')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${kerjaSubTab === 'kpi' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    4. Evaluasi KPI Staf
                  </button>
                  <button
                    onClick={() => setKerjaSubTab('sop')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${kerjaSubTab === 'sop' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    5. Generator SOP (Voice/Text)
                  </button>
                </div>
              </div>

              {/* Subtab 1: Papan Tugas Kanban */}
              {kerjaSubTab === 'kanban' && (
                <div className="space-y-6">
                  {/* Form Tambah Tugas Cepat */}
                  <div className="linear-card-glow p-4 rounded-xl flex items-center gap-3 text-xs">
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Judul tugas baru (misal: Cek stok opname / follow up klien)..."
                      className="flex-1 bg-[#15161c] border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-[#0058be]"
                    />
                    <input
                      type="text"
                      value={newTaskAssignee}
                      onChange={(e) => setNewTaskAssignee(e.target.value)}
                      placeholder="Nama PIC"
                      className="w-36 bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                    />
                    <select
                      value={newTaskPriority}
                      onChange={(e: any) => setNewTaskPriority(e.target.value)}
                      className="bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleCreateTask}
                      disabled={taskLoading}
                      className="btn-linear-glow px-4 py-2 rounded-lg font-semibold flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambah Tugas
                    </button>
                  </div>

                  {/* 3 Kolom Kanban Board */}
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    {/* Kolom 1: TODO */}
                    <div className="linear-card p-4 rounded-2xl space-y-3 bg-[#0d0e12]">
                      <div className="flex justify-between items-center border-b border-white/10 pb-2">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#ffab00]" /> Belum Dikerjakan (TODO)
                        </span>
                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-bold">{tasksColumns.TODO?.length || 0}</span>
                      </div>
                      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                        {tasksColumns.TODO?.map((t: any) => (
                          <div key={t.id} className="p-3 bg-[#15161c] border border-white/10 rounded-xl space-y-2 hover:border-white/20 transition-all">
                            <div className="font-semibold text-white">{t.title}</div>
                            <div className="flex justify-between items-center text-[10px] text-[#8a8f98]">
                              <span>👤 {t.assigneeName}</span>
                              <span className="text-[#ffab00] font-bold">{t.priority}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUpdateTaskStatus(t.id, 'IN_PROGRESS')}
                              className="w-full py-1 bg-[#0058be]/20 hover:bg-[#0058be]/30 text-[#00d2ff] font-semibold rounded text-[10px] border border-[#0058be]/30 transition-all"
                            >
                              Mulai Kerjakan →
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Kolom 2: IN_PROGRESS */}
                    <div className="linear-card p-4 rounded-2xl space-y-3 bg-[#0d0e12]">
                      <div className="flex justify-between items-center border-b border-white/10 pb-2">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#00d2ff]" /> Sedang Berjalan (In Progress)
                        </span>
                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-bold">{tasksColumns.IN_PROGRESS?.length || 0}</span>
                      </div>
                      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                        {tasksColumns.IN_PROGRESS?.map((t: any) => (
                          <div key={t.id} className="p-3 bg-[#15161c] border border-[#0058be]/30 rounded-xl space-y-2">
                            <div className="font-semibold text-white">{t.title}</div>
                            <div className="flex justify-between items-center text-[10px] text-[#8a8f98]">
                              <span>👤 {t.assigneeName}</span>
                              <span className="text-[#00d2ff] font-bold">{t.priority}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUpdateTaskStatus(t.id, 'DONE')}
                              className="w-full py-1 bg-[#00e676]/20 hover:bg-[#00e676]/30 text-[#00e676] font-semibold rounded text-[10px] border border-[#00e676]/30 transition-all"
                            >
                              ✓ Tandai Selesai
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Kolom 3: DONE */}
                    <div className="linear-card p-4 rounded-2xl space-y-3 bg-[#0d0e12]">
                      <div className="flex justify-between items-center border-b border-white/10 pb-2">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#00e676]" /> Selesai (DONE)
                        </span>
                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-bold">{tasksColumns.DONE?.length || 0}</span>
                      </div>
                      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                        {tasksColumns.DONE?.map((t: any) => (
                          <div key={t.id} className="p-3 bg-[#15161c] border border-[#00e676]/20 rounded-xl space-y-1 opacity-80">
                            <div className="font-semibold text-white line-through">{t.title}</div>
                            <div className="text-[10px] text-[#8a8f98]">👤 {t.assigneeName} • ✓ Selesai</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 2: Presensi GPS */}
              {kerjaSubTab === 'attendance' && (
                <div className="space-y-6">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="linear-card p-4 rounded-xl space-y-1">
                      <span className="text-[11px] text-[#8a8f98] font-medium">Tingkat Ketepatan Waktu</span>
                      <div className="text-xl font-bold text-[#00e676]">{attSummary.punctualityRate}</div>
                      <span className="text-[10px] text-[#00e676]">Punctuality Score</span>
                    </div>
                    <div className="linear-card p-4 rounded-xl space-y-1">
                      <span className="text-[11px] text-[#8a8f98] font-medium">Total Presensi Hari Ini</span>
                      <div className="text-xl font-bold text-white">{attSummary.totalAttendance} Staf</div>
                      <span className="text-[10px] text-[#8a8f98]">Tercatat di Sistem</span>
                    </div>
                    <div className="linear-card p-4 rounded-xl space-y-1">
                      <span className="text-[11px] text-[#8a8f98] font-medium">Keterlambatan</span>
                      <div className="text-xl font-bold text-[#ff5252]">{attSummary.lateCount} Orang</div>
                      <span className="text-[10px] text-[#ff5252]">Perlu Perhatian</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6 text-xs">
                    {/* Form Catat Presensi */}
                    <div className="linear-card-glow p-6 rounded-2xl space-y-4 col-span-1">
                      <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-[#00d2ff]" /> Presensi Mandiri Staf (GPS)
                      </h3>
                      <form onSubmit={handleRecordAttendance} className="space-y-3">
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Nama Karyawan</label>
                          <input
                            type="text"
                            value={attEmpName}
                            onChange={(e) => setAttEmpName(e.target.value)}
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Shift Kerja</label>
                          <select
                            value={attShift}
                            onChange={(e) => setAttShift(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          >
                            <option value="PAGI">Shift Pagi (08:00 - 16:00)</option>
                            <option value="SIANG">Shift Siang (13:00 - 21:00)</option>
                            <option value="MALAM">Shift Malam (18:00 - 02:00)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Status Kehadiran</label>
                          <select
                            value={attStatus}
                            onChange={(e) => setAttStatus(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          >
                            <option value="HADIR_TEPAT_WAKTU">✓ Hadir Tepat Waktu</option>
                            <option value="TERLAMBAT">⚠️ Terlambat</option>
                            <option value="IZIN">📝 Izin / Sakit</option>
                            <option value="CUTI">🏖️ Cuti Resmi</option>
                          </select>
                        </div>
                        <div className="p-2.5 bg-[#0058be]/10 border border-[#0058be]/20 rounded-lg text-[10px] text-[#00d2ff]">
                          📍 Lokasi Terdeteksi: Outlet Utama (GPS Verified: -6.2088, 106.8456)
                        </div>
                        <button type="submit" disabled={attLoading} className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2">
                          {attLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : '📍 Clock-In Presensi'}
                        </button>
                      </form>
                    </div>

                    {/* Log Presensi */}
                    <div className="linear-card p-6 rounded-2xl col-span-2 space-y-4">
                      <div className="flex justify-between items-center border-b border-white/10 pb-3">
                        <h3 className="font-semibold text-sm text-white">Log Presensi Real-Time Hari Ini</h3>
                        <button onClick={fetchKerjaData} className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded text-[11px] text-[#8a8f98] flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" /> Refresh
                        </button>
                      </div>
                      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                        {attendanceRecords.length > 0 ? (
                          attendanceRecords.map((att: any) => (
                            <div key={att.id} className="p-3 bg-[#15161c] border border-white/10 rounded-xl flex items-center justify-between hover:border-white/20 transition-all">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-white">{att.employeeName}</span>
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${att.status === 'HADIR_TEPAT_WAKTU' ? 'bg-[#00e676]/15 text-[#00e676]' : 'bg-[#ff5252]/15 text-[#ff5252]'}`}>
                                    {att.status}
                                  </span>
                                </div>
                                <div className="text-[10px] text-[#8a8f98]">
                                  Shift {att.shift} • {new Date(att.checkInTime).toLocaleTimeString('id-ID')} • {att.location}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-[#8a8f98] italic py-8 text-center">Belum ada catatan presensi staf hari ini.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 3: Penggajian & Slip Gaji */}
              {kerjaSubTab === 'payroll' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-6 text-xs">
                    {/* Form Buat Slip Gaji */}
                    <div className="linear-card-glow p-6 rounded-2xl space-y-4 col-span-1">
                      <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-[#00d2ff]" /> Terbitkan Slip Gaji
                      </h3>
                      <form onSubmit={handleCreatePayroll} className="space-y-3">
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Nama Karyawan</label>
                          <input
                            type="text"
                            value={payEmpName}
                            onChange={(e) => setPayEmpName(e.target.value)}
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Posisi / Divisi</label>
                          <input
                            type="text"
                            value={payRole}
                            onChange={(e) => setPayRole(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Gaji Pokok (Rp)</label>
                            <input
                              type="number"
                              value={payBasic}
                              onChange={(e) => setPayBasic(e.target.value)}
                              required
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Tunjangan (Rp)</label>
                            <input
                              type="number"
                              value={payAllow}
                              onChange={(e) => setPayAllow(e.target.value)}
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Lembur (Rp)</label>
                            <input
                              type="number"
                              value={payOvertime}
                              onChange={(e) => setPayOvertime(e.target.value)}
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Potongan (Rp)</label>
                            <input
                              type="number"
                              value={payDeduct}
                              onChange={(e) => setPayDeduct(e.target.value)}
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                        </div>
                        <button type="submit" disabled={payLoading} className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2">
                          {payLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : '📄 Generate Slip Gaji'}
                        </button>
                      </form>
                    </div>

                    {/* Daftar Slip Gaji */}
                    <div className="linear-card p-6 rounded-2xl col-span-2 space-y-4">
                      <div className="flex justify-between items-center border-b border-white/10 pb-3">
                        <h3 className="font-semibold text-sm text-white">Daftar Penggajian Karyawan</h3>
                        <span className="text-[11px] text-[#8a8f98]">{payrollsList.length} Slip Diterbitkan</span>
                      </div>
                      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                        {payrollsList.length > 0 ? (
                          payrollsList.map((p: any) => (
                            <div key={p.id} className="p-4 bg-[#15161c] border border-white/10 rounded-xl space-y-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-sm">{p.employeeName}</span>
                                    <span className="text-[10px] text-[#8a8f98] bg-white/5 px-2 py-0.5 rounded">{p.role}</span>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${p.isPaid ? 'bg-[#00e676]/15 text-[#00e676]' : 'bg-[#ffab00]/15 text-[#ffab00]'}`}>
                                      {p.isPaid ? '✓ SUDAH DIBAYAR' : 'MENUNGGU PEMBAYARAN'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-[#8a8f98] mt-1">Periode: {p.monthYear}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[10px] text-[#8a8f98]">Gaji Bersih (Take Home Pay)</div>
                                  <div className="font-bold text-base text-[#00d2ff]">Rp {p.netSalary.toLocaleString()}</div>
                                </div>
                              </div>

                              <div className="p-2.5 bg-[#121318] border border-white/10 rounded-lg flex items-center justify-between text-[11px]">
                                <div className="text-[#8a8f98] text-[10px]">
                                  Pokok: Rp {p.basicSalary.toLocaleString()} • Tunjangan: Rp {p.allowance.toLocaleString()} • Potongan: Rp {p.deductions.toLocaleString()}
                                </div>
                                {!p.isPaid ? (
                                  <button
                                    onClick={() => handlePayPayroll(p.id)}
                                    className="px-3 py-1.5 bg-[#00e676]/15 hover:bg-[#00e676]/25 text-[#00e676] border border-[#00e676]/30 font-bold rounded-lg text-[10px] transition-all"
                                  >
                                    💰 Bayarkan & Catat ke KLIR Kas
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-[#00e676] font-bold">✓ Tercatat di Beban Kas</span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-[#8a8f98] italic py-8 text-center">Belum ada slip gaji yang dibuat.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 4: Evaluasi KPI Staf */}
              {kerjaSubTab === 'kpi' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6 text-xs">
                    <div className="linear-card-glow p-6 rounded-2xl space-y-4">
                      <h3 className="font-semibold text-sm text-white">Evaluasi Performa & KPI Karyawan</h3>
                      <form onSubmit={handleCalculateKPI} className="space-y-3">
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Nama Karyawan</label>
                          <input
                            type="text"
                            value={kpiEmpName}
                            onChange={(e) => setKpiEmpName(e.target.value)}
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Disiplin Jam Kerja (Max 25)</label>
                            <input
                              type="number"
                              value={kpiPunctuality}
                              onChange={(e) => setKpiPunctuality(e.target.value)}
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Ketepatan Tugas (Max 30)</label>
                            <input
                              type="number"
                              value={kpiTaskScore}
                              onChange={(e) => setKpiTaskScore(e.target.value)}
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Kualitas Output (Max 25)</label>
                            <input
                              type="number"
                              value={kpiQuality}
                              onChange={(e) => setKpiQuality(e.target.value)}
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Kerjasama Tim (Max 20)</label>
                            <input
                              type="number"
                              value={kpiTeamwork}
                              onChange={(e) => setKpiTeamwork(e.target.value)}
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                        </div>
                        <button type="submit" className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold">
                          Kalkulasi Skor KPI & Rekomendasi
                        </button>
                      </form>
                    </div>

                    {/* Output KPI Evaluation */}
                    <div className="linear-card p-6 rounded-2xl space-y-4">
                      <h3 className="font-semibold text-sm text-white">Hasil Evaluasi Kinerja Staf</h3>
                      {kpiResult ? (
                        <div className="space-y-3">
                          <div className="p-4 bg-[#00e676]/10 border border-[#00e676]/30 rounded-xl flex justify-between items-center">
                            <div>
                              <span className="text-[#8a8f98] block text-[11px]">Total KPI Score:</span>
                              <div className="text-2xl font-black text-[#00e676]">{kpiResult.totalScore} / 100</div>
                            </div>
                            <div className="text-right">
                              <span className="font-extrabold text-sm text-white bg-[#00e676]/20 border border-[#00e676]/40 px-3 py-1 rounded-lg">
                                Grade {kpiResult.grade}
                              </span>
                              <span className="text-[10px] text-[#00e676] block mt-1 font-bold">{kpiResult.gradeLabel}</span>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            {kpiResult.breakdown?.map((b: any, idx: number) => (
                              <div key={idx} className="p-2 bg-[#15161c] border border-white/10 rounded-lg flex justify-between items-center text-[11px]">
                                <span className="text-[#8a8f98]">{b.indicator}:</span>
                                <span className="font-bold text-white">{b.score} / {b.max} Pts</span>
                              </div>
                            ))}
                          </div>

                          <div className="p-3 bg-[#121318] border border-white/10 rounded-lg text-[11px] leading-relaxed">
                            <span className="font-bold text-[#00d2ff] block mb-0.5">💡 Rekomendasi Management:</span>
                            <p className="text-[#8a8f98]">{kpiResult.recommendation}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-[#8a8f98] italic py-8 text-center">Submit evaluasi untuk melihat skor performa karyawan.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 5: Generator SOP */}
              {kerjaSubTab === 'sop' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-6 text-xs">
                    <div className="linear-card-glow p-6 rounded-2xl space-y-4 col-span-1">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-sm text-white">Generator SOP & Kuis Onboarding</h3>
                        <span className="text-[10px] bg-[#8d55e8]/15 text-[#8d55e8] px-2.5 py-0.5 rounded-full border border-[#8d55e8]/30 font-bold">20 Credits</span>
                      </div>
                      <form onSubmit={handleGenerateSOP} className="space-y-3">
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Judul SOP Kerja</label>
                          <input
                            type="text"
                            value={sopTitleInput}
                            onChange={(e) => setSopTitleInput(e.target.value)}
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Instruksi Mentah / Suara Transkripsi</label>
                          <textarea
                            rows={5}
                            value={sopRawInput}
                            onChange={(e) => setSopRawInput(e.target.value)}
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <button type="submit" disabled={sopLoading} className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2">
                          {sopLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : '⚡ Susun SOP & 3 Soal Kuis (20 Credits)'}
                        </button>
                      </form>
                    </div>

                    <div className="linear-card p-6 rounded-2xl col-span-2 space-y-4">
                      <h3 className="font-semibold text-sm text-white">Dokumen SOP & Kuis Pemahaman Karyawan Baru</h3>
                      {sopResult ? (
                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                          <div className="p-4 bg-[#15161c] border border-white/10 rounded-xl space-y-2">
                            <div className="font-bold text-white text-base">{sopResult.sopTitle}</div>
                            <p className="text-[#8a8f98] text-xs leading-relaxed">{sopResult.tujuan}</p>
                          </div>

                          <div className="space-y-2">
                            <h4 className="font-bold text-white text-xs">📋 Tahapan Langkah Kerja (Prosedur):</h4>
                            {sopResult.langkahKerja?.map((st: any, idx: number) => (
                              <div key={idx} className="p-3 bg-[#15161c] border border-white/10 rounded-lg flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-[#0058be]/20 text-[#00d2ff] font-bold flex items-center justify-center shrink-0 text-[10px]">
                                  {st.step}
                                </span>
                                <div>
                                  <div className="font-bold text-white">{st.action}</div>
                                  <div className="text-[#8a8f98] text-[10px] mt-0.5">Standar: {st.standard}</div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="p-4 bg-[#8d55e8]/10 border border-[#8d55e8]/30 rounded-xl space-y-3">
                            <h4 className="font-bold text-[#8d55e8] text-xs">🎓 3 Soal Kuis Pemahaman Karyawan Baru:</h4>
                            {sopResult.kuisPemahaman?.map((q: any, idx: number) => (
                              <div key={idx} className="p-3 bg-[#121318] border border-white/10 rounded-lg space-y-1">
                                <div className="font-bold text-white">{idx + 1}. {q.pertanyaan}</div>
                                <div className="grid grid-cols-2 gap-1 text-[10px] text-[#8a8f98] pt-1">
                                  {q.pilihan?.map((opt: string, optIdx: number) => (
                                    <div key={optIdx} className={`p-1.5 rounded ${opt.startsWith(q.jawabanBenar) ? 'bg-[#00e676]/10 text-[#00e676] font-semibold border border-[#00e676]/20' : 'bg-[#15161c]'}`}>
                                      {opt}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-[#8a8f98] italic py-8 text-center">Isi form di samping untuk membuat dokumen SOP dan kuis pemahaman instan.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
