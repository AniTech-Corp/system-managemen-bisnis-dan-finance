// SUMBER ASLI: src/app/page.tsx (repo KLIR-main, snapshot 23 Agustus 2026)
// RENTANG BARIS ASLI: baris 2830 - 3330 (kondisional render: {activeView === 'kas' \&\& (...)})
// KONTEKS: Modul KLIR Kas -- End-to-End Business Financial OS (buku kas, invoice QRIS/VA, kalkulator pajak UMKM, proyeksi runway)
// CATATAN: ini POTONGAN KODE ASLI dari aplikasi fungsional yang sudah dibangun Tim Pengembang,
// DISERTAKAN sebagai referensi fitur/copy/struktur data -- BUKAN untuk ditiru 1:1 sebagai layout visual.
// Bahasa visual/DNA WAJIB ikut SISTEM-DESAIN-BERSAMA.md + CorPlan v5 / AniVirtual v5, bukan struktur div/class Tailwind di bawah ini.

          {/* VIEW 3: KLIR KAS (END-TO-END FINANCIAL OS) */}
          {activeView === 'kas' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <div>
                  <h1 className="font-heading font-bold text-xl text-white">KLIR Kas — End-to-End Business Financial OS</h1>
                  <p className="text-xs text-[#8a8f98]">Buku kas single-ledger, invoice digital QRIS/VA, kalkulator pajak UMKM 0.5%, & proyeksi runway.</p>
                </div>

                <div className="flex bg-[#15161c] p-1 rounded-xl border border-white/10 text-xs flex-wrap gap-1">
                  <button
                    onClick={() => setKasSubTab('ledger')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${kasSubTab === 'ledger' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    1. Buku Kas (Cashflow)
                  </button>
                  <button
                    onClick={() => setKasSubTab('invoices')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${kasSubTab === 'invoices' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    2. Invoice Digital (QRIS & VA)
                  </button>
                  <button
                    onClick={() => setKasSubTab('tax')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${kasSubTab === 'tax' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    3. Pajak UMKM 0.5%
                  </button>
                  <button
                    onClick={() => setKasSubTab('runway')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${kasSubTab === 'runway' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    4. Proyeksi Runway Kas
                  </button>
                  <button
                    onClick={() => setKasSubTab('health')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${kasSubTab === 'health' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    5. Skor Kesehatan Keuangan
                  </button>
                </div>
              </div>

              {/* Subtab 1: Buku Kas */}
              {kasSubTab === 'ledger' && (
                <div className="space-y-6">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="linear-card p-4 rounded-xl space-y-1">
                      <span className="text-[11px] text-[#8a8f98] font-medium">Total Pemasukan Kas</span>
                      <div className="text-lg font-bold text-[#00e676]">Rp {kasSummary.totalIncome.toLocaleString()}</div>
                      <span className="text-[10px] text-[#00e676] bg-[#00e676]/10 px-1.5 py-0.5 rounded font-semibold">+ Cash Inflows</span>
                    </div>
                    <div className="linear-card p-4 rounded-xl space-y-1">
                      <span className="text-[11px] text-[#8a8f98] font-medium">Total Pengeluaran Kas</span>
                      <div className="text-lg font-bold text-[#ff5252]">Rp {kasSummary.totalExpense.toLocaleString()}</div>
                      <span className="text-[10px] text-[#ff5252] bg-[#ff5252]/10 px-1.5 py-0.5 rounded font-semibold">- Cash Outflows</span>
                    </div>
                    <div className="linear-card p-4 rounded-xl space-y-1 border-[#0058be]/30">
                      <span className="text-[11px] text-[#8a8f98] font-medium">Saldo Kas Bersih Tersedia</span>
                      <div className="text-lg font-bold text-[#00d2ff]">Rp {kasSummary.netCashBalance.toLocaleString()}</div>
                      <span className="text-[10px] text-[#00d2ff] bg-[#00d2ff]/10 px-1.5 py-0.5 rounded font-semibold">Net Cash Balance</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6 text-xs">
                    {/* Form Catat Transaksi */}
                    <div className="linear-card-glow p-6 rounded-2xl space-y-4 col-span-1">
                      <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                        <Plus className="w-4 h-4 text-[#00d2ff]" /> Catat Transaksi Kas Baru
                      </h3>
                      <form onSubmit={handleCreateTransaction} className="space-y-3">
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Tipe Transaksi</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setNewTxType('INCOME')}
                              className={`py-1.5 rounded-lg font-bold border transition-all ${newTxType === 'INCOME' ? 'bg-[#00e676]/15 border-[#00e676] text-[#00e676]' : 'bg-[#15161c] border-white/10 text-[#8a8f98]'}`}
                            >
                              + PEMASUKAN
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewTxType('EXPENSE')}
                              className={`py-1.5 rounded-lg font-bold border transition-all ${newTxType === 'EXPENSE' ? 'bg-[#ff5252]/15 border-[#ff5252] text-[#ff5252]' : 'bg-[#15161c] border-white/10 text-[#8a8f98]'}`}
                            >
                              - PENGELUARAN
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Kategori Transaksi</label>
                          <select
                            value={newTxCategory}
                            onChange={(e) => setNewTxCategory(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          >
                            <option value="Penjualan Produk / Layanan">Penjualan Produk / Layanan</option>
                            <option value="Bahan Baku & Material">Bahan Baku & Material</option>
                            <option value="Gaji Staf & Honor">Gaji Staf & Honor Tim</option>
                            <option value="Biaya Operasional & Utilitas">Biaya Operasional & Utilitas</option>
                            <option value="Biaya Cloud & Server">Biaya Cloud & Server</option>
                            <option value="Marketing & Promosi Iklan">Marketing & Promosi Iklan</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Nominal Transaksi (Rp)</label>
                          <input
                            type="number"
                            value={newTxAmount}
                            onChange={(e) => setNewTxAmount(e.target.value)}
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Deskripsi / Keterangan</label>
                          <input
                            type="text"
                            value={newTxDesc}
                            onChange={(e) => setNewTxDesc(e.target.value)}
                            placeholder="Contoh: Pembayaran invoice #102..."
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <button type="submit" disabled={txLoading} className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2">
                          {txLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : '💾 Simpan Transaksi Kas'}
                        </button>
                      </form>
                    </div>

                    {/* Riwayat Transaksi */}
                    <div className="linear-card p-6 rounded-2xl col-span-2 space-y-4">
                      <div className="flex justify-between items-center border-b border-white/10 pb-3">
                        <h3 className="font-semibold text-sm text-white">Riwayat Transaksi Kas Terkini</h3>
                        <button onClick={fetchKasData} className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded text-[11px] text-[#8a8f98] flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" /> Refresh
                        </button>
                      </div>
                      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                        {kasTransactions.length > 0 ? (
                          kasTransactions.map((tx: any) => (
                            <div key={tx.id} className="p-3 bg-[#15161c] border border-white/10 rounded-xl flex items-center justify-between hover:border-white/20 transition-all">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${tx.type === 'INCOME' ? 'bg-[#00e676]/15 text-[#00e676]' : 'bg-[#ff5252]/15 text-[#ff5252]'}`}>
                                    {tx.type}
                                  </span>
                                  <span className="font-semibold text-white">{tx.description}</span>
                                </div>
                                <div className="text-[10px] text-[#8a8f98]">
                                  {tx.category} • {new Date(tx.transactionDate).toLocaleDateString('id-ID')} • {tx.paymentMethod}
                                </div>
                              </div>
                              <div className={`font-mono font-bold text-sm ${tx.type === 'INCOME' ? 'text-[#00e676]' : 'text-[#ff5252]'}`}>
                                {tx.type === 'INCOME' ? '+' : '-'} Rp {tx.amount.toLocaleString()}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-[#8a8f98] italic py-8 text-center">Belum ada transaksi kas yang dicatat.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 2: Invoice Digital */}
              {kasSubTab === 'invoices' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-6 text-xs">
                    {/* Form Terbitkan Invoice */}
                    <div className="linear-card-glow p-6 rounded-2xl space-y-4 col-span-1">
                      <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#00d2ff]" /> Terbitkan Invoice Digital
                      </h3>
                      <form onSubmit={handleCreateInvoice} className="space-y-3">
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Nama Klien / Perusahaan</label>
                          <input
                            type="text"
                            value={invClientName}
                            onChange={(e) => setInvClientName(e.target.value)}
                            placeholder="PT Mitra Sejahtera"
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Email Klien (Opsional)</label>
                          <input
                            type="email"
                            value={invClientEmail}
                            onChange={(e) => setInvClientEmail(e.target.value)}
                            placeholder="finance@mitra.co.id"
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Item Layanan / Barang</label>
                          <input
                            type="text"
                            value={invItemName}
                            onChange={(e) => setInvItemName(e.target.value)}
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Harga Satuan (Rp)</label>
                            <input
                              type="number"
                              value={invItemPrice}
                              onChange={(e) => setInvItemPrice(e.target.value)}
                              required
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Pajak PPN (%)</label>
                            <input
                              type="number"
                              value={invTaxRate}
                              onChange={(e) => setInvTaxRate(e.target.value)}
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                        </div>
                        <button type="submit" disabled={invLoading} className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2">
                          {invLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : '🧾 Generate Invoice & QRIS Standar'}
                        </button>
                      </form>
                    </div>

                    {/* Daftar Invoice */}
                    <div className="linear-card p-6 rounded-2xl col-span-2 space-y-4">
                      <div className="flex justify-between items-center border-b border-white/10 pb-3">
                        <h3 className="font-semibold text-sm text-white">Daftar Invoice Digital Aktif</h3>
                        <span className="text-[11px] text-[#8a8f98]">{invoices.length} Invoice Diterbitkan</span>
                      </div>
                      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                        {invoices.length > 0 ? (
                          invoices.map((inv: any) => (
                            <div key={inv.id} className="p-4 bg-[#15161c] border border-white/10 rounded-xl space-y-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-[#00d2ff]">{inv.invoiceNumber}</span>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${inv.status === 'PAID' ? 'bg-[#00e676]/15 text-[#00e676] border-[#00e676]/30' : 'bg-[#ffab00]/15 text-[#ffab00] border-[#ffab00]/30'}`}>
                                      {inv.status}
                                    </span>
                                  </div>
                                  <div className="text-xs text-white font-medium mt-1">Klien: {inv.clientName}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-[#8a8f98]">Total Tagihan</div>
                                  <div className="font-bold text-sm text-white">Rp {inv.totalAmount.toLocaleString()}</div>
                                </div>
                              </div>

                              <div className="p-2.5 bg-[#121318] border border-white/10 rounded-lg flex items-center justify-between text-[11px]">
                                <div className="space-y-0.5">
                                  <span className="text-[#8a8f98] block text-[10px]">Virtual Account Mandiri/BCA:</span>
                                  <code className="font-mono font-bold text-[#0058be]">{inv.virtualAccount || '880812345678'}</code>
                                </div>
                                {inv.status === 'UNPAID' ? (
                                  <button
                                    onClick={() => handleMarkInvoicePaid(inv.id)}
                                    className="px-3 py-1.5 bg-[#00e676]/15 hover:bg-[#00e676]/25 text-[#00e676] border border-[#00e676]/30 font-bold rounded-lg text-[10px] transition-all"
                                  >
                                    ✓ Tandai Lunas (Catat ke Kas)
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-[#00e676] font-bold">✓ Dana Telah Masuk ke Kas</span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-[#8a8f98] italic py-8 text-center">Belum ada invoice yang diterbitkan.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 3: Pajak UMKM 0.5% */}
              {kasSubTab === 'tax' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6 text-xs">
                    <div className="linear-card-glow p-6 rounded-2xl space-y-4">
                      <h3 className="font-semibold text-sm text-white">Kalkulator Pajak PPh Final UMKM (PP 55/2022)</h3>
                      <form onSubmit={handleCalculateTax} className="space-y-3">
                        <div>
                          <label className="text-[#8a8f98] block mb-1 font-medium">Bentuk Entitas Usaha</label>
                          <select
                            value={taxEntityType}
                            onChange={(e: any) => setTaxEntityType(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          >
                            <option value="BADAN_USAHA">Badan Usaha (PT / CV / Firma - Tarif Flat 0.5%)</option>
                            <option value="ORANG_PRIBADI">Orang Pribadi (WP OP - Bebas Pajak s.d. 500 Juta/Thn)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1 font-medium">Omset Bruto Bulanan (Rp)</label>
                          <input
                            type="number"
                            value={taxRevenueInput}
                            onChange={(e) => setTaxRevenueInput(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <button type="submit" className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold">
                          Hitung Estimasi Pajak PPh Final
                        </button>
                      </form>
                    </div>

                    <div className="linear-card p-6 rounded-2xl space-y-4">
                      <h3 className="font-semibold text-sm text-white">Kewajiban Setor Pajak Bulanan</h3>
                      {taxResult ? (
                        <div className="space-y-3">
                          <div className="p-3 bg-[#00e676]/10 border border-[#00e676]/30 rounded-xl flex justify-between items-center">
                            <span className="text-[#8a8f98]">Kewajiban Pajak / Bulan:</span>
                            <span className="font-bold text-[#00e676] text-base">Rp {taxResult.monthlyTaxDue.toLocaleString()}</span>
                          </div>
                          <div className="p-3 bg-[#15161c] border border-white/10 rounded-xl flex justify-between items-center">
                            <span className="text-[#8a8f98]">Proyeksi Pajak / Tahun:</span>
                            <span className="font-bold text-white">Rp {taxResult.annualProjectedTaxDue.toLocaleString()}</span>
                          </div>
                          <div className="p-3 bg-[#15161c] border border-white/10 rounded-xl flex justify-between items-center">
                            <span className="text-[#8a8f98]">Dasar Hukum:</span>
                            <span className="font-bold text-[#00d2ff] text-[11px]">{taxResult.legalBasis}</span>
                          </div>
                          <p className="text-[10px] text-[#ffab00] bg-[#ffab00]/10 p-2.5 rounded-lg border border-[#ffab00]/20">
                            💡 {taxResult.paymentDeadlineNote}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-[#8a8f98] italic">Submit form untuk melihat perhitungan pajak resmi.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 4: Proyeksi Runway Kas */}
              {kasSubTab === 'runway' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6 text-xs">
                    <div className="linear-card-glow p-6 rounded-2xl space-y-4">
                      <h3 className="font-semibold text-sm text-white">Simulator Proyeksi Runway Kas & Burn Rate</h3>
                      <form onSubmit={handleCalculateRunway} className="space-y-3">
                        <div>
                          <label className="text-[#8a8f98] block mb-1 font-medium">Cadangan Kas Tersedia (Rp)</label>
                          <input
                            type="number"
                            value={runwayReserveInput}
                            onChange={(e) => setRunwayReserveInput(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1 font-medium">Pengeluaran Rata-rata / Bulan (Rp)</label>
                          <input
                            type="number"
                            value={runwayExpenseInput}
                            onChange={(e) => setRunwayExpenseInput(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1 font-medium">Pemasukan Rata-rata / Bulan (Rp)</label>
                          <input
                            type="number"
                            value={runwayRevenueInput}
                            onChange={(e) => setRunwayRevenueInput(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <button type="submit" className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold">
                          Kalkulasi Ketahanan Runway Kas
                        </button>
                      </form>
                    </div>

                    <div className="linear-card p-6 rounded-2xl space-y-4">
                      <h3 className="font-semibold text-sm text-white">Hasil Proyeksi Ketahanan Kas</h3>
                      {runwayResult ? (
                        <div className="space-y-3">
                          <div className="p-4 bg-[#0058be]/10 border border-[#0058be]/30 rounded-xl flex justify-between items-center">
                            <div>
                              <span className="text-[#8a8f98] block text-[11px]">Daya Tahan Runway Kas:</span>
                              <span className="text-xl font-bold text-[#00d2ff]">{runwayResult.runwayMonths}</span>
                            </div>
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full border" style={{ color: runwayResult.statusColor, borderColor: runwayResult.statusColor }}>
                              {runwayResult.status}
                            </span>
                          </div>
                          <div className="p-3 bg-[#15161c] border border-white/10 rounded-xl flex justify-between items-center">
                            <span className="text-[#8a8f98]">Net Burn Rate (Defisit / Bulan):</span>
                            <span className="font-bold text-[#ff5252]">Rp {runwayResult.netBurnRate.toLocaleString()}</span>
                          </div>
                          <div className="p-3.5 bg-[#121318] border border-white/10 rounded-xl text-[11px] leading-relaxed text-[#f7f8f8]">
                            <span className="font-bold text-[#00d2ff] block mb-1">📋 Rekomendasi Finansial AI:</span>
                            {runwayResult.recommendation}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-[#8a8f98] italic">Submit form untuk melihat proyeksi ketahanan kas bisnis.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 5: Skor Kesehatan Keuangan */}
              {kasSubTab === 'health' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6 text-xs">
                    <div className="linear-card-glow p-6 rounded-2xl space-y-4">
                      <h3 className="font-semibold text-sm text-white">Audit Skor Kesehatan Keuangan Usaha</h3>
                      <form onSubmit={handleCalculateHealth} className="space-y-3">
                        <div>
                          <label className="text-[#8a8f98] block mb-1 font-medium">Omset Bulanan (Rp)</label>
                          <input
                            type="number"
                            value={healthRevInput}
                            onChange={(e) => setHealthRevInput(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1 font-medium">Total Pengeluaran Bulanan (Rp)</label>
                          <input
                            type="number"
                            value={healthExpInput}
                            onChange={(e) => setHealthExpInput(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1 font-medium">Saldo Kas Tunai / Bank (Rp)</label>
                          <input
                            type="number"
                            value={healthCashInput}
                            onChange={(e) => setHealthCashInput(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <button type="submit" className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold">
                          Audit Skor Kesehatan Keuangan (0–100)
                        </button>
                      </form>
                    </div>

                    <div className="linear-card p-6 rounded-2xl space-y-4">
                      <h3 className="font-semibold text-sm text-white">Hasil Audit & Rating Kelayakan Bank (Bankability)</h3>
                      {healthResult ? (
                        <div className="space-y-3">
                          <div className="p-4 bg-[#00e676]/10 border border-[#00e676]/30 rounded-xl flex justify-between items-center">
                            <div>
                              <span className="text-[#8a8f98] block text-[11px]">Financial Health Score:</span>
                              <div className="text-2xl font-black text-[#00e676]">{healthResult.totalScore} / 100</div>
                            </div>
                            <div className="text-right">
                              <span className="font-extrabold text-sm text-white bg-[#00e676]/20 border border-[#00e676]/40 px-3 py-1 rounded-lg">
                                Grade {healthResult.grade}
                              </span>
                              <span className="text-[10px] text-[#00e676] block mt-1 font-bold">{healthResult.gradeLabel}</span>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            {healthResult.breakdown?.map((b: any, idx: number) => (
                              <div key={idx} className="p-2.5 bg-[#15161c] border border-white/10 rounded-lg flex justify-between items-center text-[11px]">
                                <span className="text-[#8a8f98]">{b.component}:</span>
                                <span className="font-bold text-white">{b.score} / {b.max} Pts</span>
                              </div>
                            ))}
                          </div>

                          <p className="text-[11px] text-[#8a8f98] leading-relaxed italic bg-[#121318] p-3 rounded-lg border border-white/10">
                            "{healthResult.summary}"
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-[#8a8f98] italic">Submit form untuk melihat skor kesehatan finansial usaha.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
