// SUMBER ASLI: src/app/page.tsx (repo KLIR-main, snapshot 23 Agustus 2026)
// RENTANG BARIS ASLI: baris 3332 - 3778 (kondisional render: {activeView === 'promo' \&\& (...)})
// KONTEKS: Modul KLIR Promo -- Context-Aware Marketing Engine (copywriting AI, kalender konten, kupon, bio link)
// CATATAN: ini POTONGAN KODE ASLI dari aplikasi fungsional yang sudah dibangun Tim Pengembang,
// DISERTAKAN sebagai referensi fitur/copy/struktur data -- BUKAN untuk ditiru 1:1 sebagai layout visual.
// Bahasa visual/DNA WAJIB ikut SISTEM-DESAIN-BERSAMA.md + CorPlan v5 / AniVirtual v5, bukan struktur div/class Tailwind di bawah ini.

          {/* VIEW 4: KLIR PROMO (AI MARKETING & CONTENT ENGINE) */}
          {activeView === 'promo' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <div>
                  <h1 className="font-heading font-bold text-xl text-white">KLIR Promo — Context-Aware Marketing Engine</h1>
                  <p className="text-xs text-[#8a8f98]">Copywriting lokal multi-platform, kalender konten 7 hari terstruktur, kupon diskon, & bio link digital.</p>
                </div>

                <div className="flex bg-[#15161c] p-1 rounded-xl border border-white/10 text-xs flex-wrap gap-1">
                  <button
                    onClick={() => setPromoSubTab('copywriting')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${promoSubTab === 'copywriting' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    1. Copywriting Multi-Platform
                  </button>
                  <button
                    onClick={() => setPromoSubTab('calendar')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${promoSubTab === 'calendar' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    2. Kalender Konten 7 Hari
                  </button>
                  <button
                    onClick={() => {
                      setPromoSubTab('coupons');
                      fetchCoupons();
                    }}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${promoSubTab === 'coupons' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    3. Kupon & Voucher Diskon
                  </button>
                  <button
                    onClick={() => setPromoSubTab('biolink')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${promoSubTab === 'biolink' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    4. Bio Link & WA Order
                  </button>
                </div>
              </div>

              {/* Subtab 1: Copywriting Multi-Platform */}
              {promoSubTab === 'copywriting' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-6 text-xs">
                    {/* Form Input Copywriting */}
                    <div className="linear-card-glow p-6 rounded-2xl space-y-4 col-span-1">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-sm text-white">Generator Materi Promosi AI</h3>
                        <span className="text-[10px] bg-[#8d55e8]/15 text-[#8d55e8] px-2.5 py-0.5 rounded-full border border-[#8d55e8]/30 font-bold">20 Credits</span>
                      </div>
                      <form onSubmit={handleGenerateCopywriting} className="space-y-3">
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Nama Produk / Layanan</label>
                          <input
                            type="text"
                            value={promoProdName}
                            onChange={(e) => setPromoProdName(e.target.value)}
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Deskripsi Singkat / Keunggulan</label>
                          <textarea
                            rows={2}
                            value={promoProdDesc}
                            onChange={(e) => setPromoProdDesc(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Gaya Bahasa (Tone) Lokal</label>
                          <select
                            value={promoTone}
                            onChange={(e) => setPromoTone(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          >
                            <option value="SKENA_JAKSEL">🌴 Skena Jaksel / Santai Gaul Kekinian</option>
                            <option value="RAMAH_SELLER">🛍️ Ramah Seller E-Commerce (Halo Kakak Sayang)</option>
                            <option value="FORMAL_KORPORAT">💼 Formal Korporat & B2B Profesional</option>
                            <option value="STORYTELLING">📖 Storytelling Emosional & Sentuhan Personal</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Sudut Promosi (Angle)</label>
                          <select
                            value={promoAngle}
                            onChange={(e) => setPromoAngle(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          >
                            <option value="DISKON_GAJIAN">💳 Promo Gajian / Payday Sale</option>
                            <option value="TANGGAL_KEMBAR">⚡ Flash Sale Tanggal Kembar</option>
                            <option value="PELUNCURAN_BARU">🚀 Peluncuran Menu / Produk Baru</option>
                            <option value="SOLUSI_MASALAH">🎯 Solusi Tuntas Masalah Konsumen</option>
                          </select>
                        </div>
                        <button type="submit" disabled={copyLoading} className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2">
                          {copyLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : '⚡ Generate Materi Promosi (20 Credits)'}
                        </button>
                      </form>
                    </div>

                    {/* Output Multi-Platform Copywriting */}
                    <div className="linear-card p-6 rounded-2xl col-span-2 space-y-4">
                      <h3 className="font-semibold text-sm text-white">Hasil Copywriting Siap Pakai (Multi-Platform)</h3>
                      {copywritingResult ? (
                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                          {/* Instagram */}
                          <div className="p-4 bg-[#15161c] border border-white/10 rounded-xl space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-[#e1306c] text-xs">📸 Instagram Feed & Caption</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(`${copywritingResult.instagram?.headline}\n\n${copywritingResult.instagram?.caption}\n\n${copywritingResult.instagram?.callToAction}\n\n${copywritingResult.instagram?.hashtags?.join(' ')}`);
                                  alert('✓ Copy IG berhasil disalin!');
                                }}
                                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] text-[#00d2ff]"
                              >
                                📋 Salin Caption IG
                              </button>
                            </div>
                            <div className="font-bold text-white text-xs">{copywritingResult.instagram?.headline}</div>
                            <p className="text-[#8a8f98] leading-relaxed text-xs">{copywritingResult.instagram?.caption}</p>
                            <p className="text-[#00e676] font-semibold text-[11px]">{copywritingResult.instagram?.callToAction}</p>
                            <div className="flex flex-wrap gap-1 pt-1">
                              {copywritingResult.instagram?.hashtags?.map((h: string, idx: number) => (
                                <span key={idx} className="text-[10px] text-[#00d2ff] bg-[#00d2ff]/10 px-2 py-0.5 rounded">{h}</span>
                              ))}
                            </div>
                          </div>

                          {/* TikTok Hook & Script */}
                          <div className="p-4 bg-[#15161c] border border-white/10 rounded-xl space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-[#00f2fe] text-xs">🎵 TikTok / Reels Hook 3 Detik & Skrip</span>
                            </div>
                            <div className="p-2.5 bg-[#00f2fe]/10 border border-[#00f2fe]/20 rounded-lg text-white font-semibold text-xs">
                              🪝 Hook: "{copywritingResult.tiktok?.hook3Detik}"
                            </div>
                            <p className="text-[#8a8f98] leading-relaxed text-xs">
                              🎬 <strong className="text-white">Arahan Video:</strong> {copywritingResult.tiktok?.scriptVideo}
                            </p>
                          </div>

                          {/* WhatsApp Broadcast */}
                          <div className="p-4 bg-[#15161c] border border-white/10 rounded-xl space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-[#25d366] text-xs">📲 WhatsApp Broadcast / Chat Klien</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(`${copywritingResult.whatsappBroadcast?.salamPembuka}\n\n${copywritingResult.whatsappBroadcast?.isiPesan}\n\nLink Order: ${copywritingResult.whatsappBroadcast?.linkPemesanan}`);
                                  alert('✓ Pesan WhatsApp berhasil disalin!');
                                }}
                                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] text-[#25d366]"
                              >
                                📋 Salin Pesan WA
                              </button>
                            </div>
                            <div className="p-3 bg-[#25d366]/5 border border-[#25d366]/20 rounded-lg space-y-1 text-xs">
                              <span className="font-bold text-white block">{copywritingResult.whatsappBroadcast?.salamPembuka}</span>
                              <p className="text-[#8a8f98] leading-relaxed">{copywritingResult.whatsappBroadcast?.isiPesan}</p>
                              <a href={copywritingResult.whatsappBroadcast?.linkPemesanan} target="_blank" rel="noreferrer" className="text-[#25d366] underline font-mono text-[10px] block mt-1">
                                {copywritingResult.whatsappBroadcast?.linkPemesanan}
                              </a>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-[#8a8f98] italic py-8 text-center">Isi form di samping untuk men-generate variasi materi promosi instan.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 2: Kalender Konten 7 Hari */}
              {promoSubTab === 'calendar' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-6 text-xs">
                    <div className="linear-card-glow p-6 rounded-2xl space-y-4 col-span-1">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-sm text-white">Susun Kalender Konten 7 Hari</h3>
                        <span className="text-[10px] bg-[#8d55e8]/15 text-[#8d55e8] px-2.5 py-0.5 rounded-full border border-[#8d55e8]/30 font-bold">30 Credits</span>
                      </div>
                      <form onSubmit={handleGenerateCalendar} className="space-y-3">
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Nama Brand / Usaha</label>
                          <input
                            type="text"
                            value={calTitle}
                            onChange={(e) => setCalTitle(e.target.value)}
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Kategori Industri</label>
                          <input
                            type="text"
                            value={calIndustry}
                            onChange={(e) => setCalIndustry(e.target.value)}
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Tema Kampanye Utama</label>
                          <input
                            type="text"
                            value={calCampaign}
                            onChange={(e) => setCalCampaign(e.target.value)}
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <button type="submit" disabled={calLoading} className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2">
                          {calLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : '📅 Susun Kalender 7 Hari (30 Credits)'}
                        </button>
                      </form>
                    </div>

                    <div className="linear-card p-6 rounded-2xl col-span-2 space-y-4">
                      <div className="flex justify-between items-center border-b border-white/10 pb-3">
                        <h3 className="font-semibold text-sm text-white">Rencana Konten Mingguan Terjadwal</h3>
                        {calendarResult && <span className="text-[10px] text-[#00d2ff] bg-[#00d2ff]/10 px-2 py-0.5 rounded font-bold">7 Hari Terencana</span>}
                      </div>
                      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                        {calendarResult?.days ? (
                          calendarResult.days.map((d: any, idx: number) => (
                            <div key={idx} className="p-3.5 bg-[#15161c] border border-white/10 rounded-xl space-y-1.5 hover:border-white/20 transition-all">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-white bg-white/10 px-2 py-0.5 rounded">{d.dayName} (Hari {d.day})</span>
                                  <span className="text-[10px] text-[#00d2ff] font-semibold">{d.pillar}</span>
                                </div>
                                <span className="text-[10px] text-[#ffab00] bg-[#ffab00]/10 px-2 py-0.5 rounded font-bold">⏰ {d.bestPostingTime}</span>
                              </div>
                              <div className="font-bold text-sm text-white">{d.headlineIdea}</div>
                              <div className="text-[11px] text-[#8a8f98]">
                                <strong className="text-white">Format:</strong> {d.contentType} • <strong className="text-white">Visual:</strong> {d.visualConcept}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-[#8a8f98] italic py-8 text-center">Klik 'Susun Kalender' untuk merencanakan posting harian otomatis.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 3: Kupon & Voucher Diskon */}
              {promoSubTab === 'coupons' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-6 text-xs">
                    {/* Form Buat Kupon */}
                    <div className="linear-card-glow p-6 rounded-2xl space-y-4 col-span-1">
                      <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                        <Tag className="w-4 h-4 text-[#00d2ff]" /> Terbitkan Kupon Promo
                      </h3>
                      <form onSubmit={handleCreateCoupon} className="space-y-3">
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Kode Voucher</label>
                          <input
                            type="text"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            placeholder="MISAL: DISKON50"
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white font-mono uppercase"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Tipe Diskon</label>
                            <select
                              value={couponType}
                              onChange={(e: any) => setCouponType(e.target.value)}
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            >
                              <option value="PERCENTAGE">Persen (%)</option>
                              <option value="FIXED_AMOUNT">Nominal (Rp)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Nilai Diskon</label>
                            <input
                              type="number"
                              value={couponValue}
                              onChange={(e) => setCouponValue(e.target.value)}
                              required
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Min. Belanja (Rp)</label>
                            <input
                              type="number"
                              value={couponMinPurchase}
                              onChange={(e) => setCouponMinPurchase(e.target.value)}
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[#8a8f98] block mb-1">Kuota Klaim</label>
                            <input
                              type="number"
                              value={couponQuota}
                              onChange={(e) => setCouponQuota(e.target.value)}
                              className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                            />
                          </div>
                        </div>
                        <button type="submit" disabled={coupLoading} className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2">
                          {coupLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : '🎟️ Terbitkan Voucher Diskon'}
                        </button>
                      </form>
                    </div>

                    {/* Daftar Kupon Aktif */}
                    <div className="linear-card p-6 rounded-2xl col-span-2 space-y-4">
                      <div className="flex justify-between items-center border-b border-white/10 pb-3">
                        <h3 className="font-semibold text-sm text-white">Daftar Voucher Diskon Aktif</h3>
                        <span className="text-[11px] text-[#8a8f98]">{couponsList.length} Kupon Dibuat</span>
                      </div>
                      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                        {couponsList.length > 0 ? (
                          couponsList.map((cp: any) => (
                            <div key={cp.id} className="p-4 bg-[#15161c] border border-white/10 rounded-xl flex justify-between items-center hover:border-white/20 transition-all">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-black text-white text-base tracking-wider bg-[#0058be]/20 px-2.5 py-0.5 rounded border border-[#0058be]/30">
                                    {cp.code}
                                  </span>
                                  <span className="text-[10px] text-[#00e676] bg-[#00e676]/10 px-2 py-0.5 rounded font-bold">
                                    Diskon {cp.discountType === 'PERCENTAGE' ? `${cp.discountValue}%` : `Rp ${cp.discountValue.toLocaleString()}`}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#8a8f98]">
                                  Min. Belanja: Rp {cp.minPurchase.toLocaleString()} • Kuota: {cp.usedCount}/{cp.quota} Terpakai
                                </div>
                              </div>
                              <span className="text-[10px] text-[#8a8f98]">
                                Berlaku s.d: {new Date(cp.validUntil).toLocaleDateString('id-ID')}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-[#8a8f98] italic py-8 text-center">Belum ada kupon diskon yang dibuat.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 4: Bio Link & WA Order */}
              {promoSubTab === 'biolink' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6 text-xs">
                    <div className="linear-card-glow p-6 rounded-2xl space-y-4">
                      <h3 className="font-semibold text-sm text-white">Generator Bio Link & Direct WA Order</h3>
                      <form onSubmit={handleGenerateBioLink} className="space-y-3">
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Nama Usaha / Brand</label>
                          <input
                            type="text"
                            value={bioName}
                            onChange={(e) => setBioName(e.target.value)}
                            placeholder={workspace.name}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Tagline Bisnis</label>
                          <input
                            type="text"
                            value={bioTagline}
                            onChange={(e) => setBioTagline(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Nomor WhatsApp Bisnis</label>
                          <input
                            type="text"
                            value={bioPhone}
                            onChange={(e) => setBioPhone(e.target.value)}
                            placeholder="081298765432"
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Lokasi Bisnis (Google Maps)</label>
                          <input
                            type="text"
                            value={bioLocation}
                            onChange={(e) => setBioLocation(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                          />
                        </div>
                        <button type="submit" className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold">
                          📲 Generate Tautan Bio & Link WhatsApp
                        </button>
                      </form>
                    </div>

                    {/* Preview Bio Link Card */}
                    <div className="linear-card p-6 rounded-2xl space-y-4">
                      <h3 className="font-semibold text-sm text-white">Preview Tautan Bio Publik (Mobile Preview)</h3>
                      {bioProfileResult ? (
                        <div className="max-w-xs mx-auto p-5 bg-[#0b0c0f] border-2 border-white/20 rounded-3xl space-y-4 text-center shadow-2xl">
                          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#0058be] to-[#8d55e8] mx-auto flex items-center justify-center font-bold text-lg text-white">
                            {bioProfileResult.businessName.slice(0, 1)}
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-sm">{bioProfileResult.businessName}</h4>
                            <p className="text-[11px] text-[#8a8f98] mt-0.5">{bioProfileResult.tagline}</p>
                          </div>
                          <div className="space-y-2 pt-2">
                            {bioProfileResult.actionButtons?.map((btn: any, idx: number) => (
                              <a
                                key={idx}
                                href={btn.url}
                                target="_blank"
                                rel="noreferrer"
                                className={`block w-full py-2.5 rounded-xl font-bold text-[11px] transition-all ${btn.isPrimary ? 'bg-[#00e676] text-black hover:opacity-90 shadow-lg shadow-[#00e676]/20' : 'bg-[#15161c] text-white border border-white/10 hover:border-white/25'}`}
                              >
                                {btn.label}
                              </a>
                            ))}
                          </div>
                          <p className="text-[9px] text-[#626770] pt-2">Powered by KLIR OS BioLink</p>
                        </div>
                      ) : (
                        <p className="text-xs text-[#8a8f98] italic text-center py-12">Submit form untuk melihat preview kartu bio link digital.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
