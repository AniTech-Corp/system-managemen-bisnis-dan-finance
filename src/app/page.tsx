'use client';

import React from 'react';
import Link from 'next/link';
import {
  Wallet,
  BarChart3,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Bot,
  Activity,
  Layers,
  ArrowUpRight,
  Lock,
} from 'lucide-react';

export default function AnitechDualSystemPortal() {
  return (
    <div className="min-h-screen w-full bg-[#06080C] text-[#F5F7FA] font-sans flex flex-col selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* 🌟 ENTERPRISE TOP NAVBAR */}
      <header className="w-full h-16 border-b border-white/[0.08] px-6 lg:px-12 flex items-center justify-between sticky top-0 z-50 backdrop-blur-xl bg-[#07090E]/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 via-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold tracking-tight text-white font-['Outfit']">ANITECH</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                SUITE
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Sistem Mandiri Finance &amp; Monitoring Usaha</p>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 font-medium font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sistem Terisolasi Mandiri</span>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <span className="w-7 h-7 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center">
              <Lock size={12} className="text-emerald-400" />
            </span>
            <span className="hidden md:inline font-['Outfit']">Akses Eksekutif</span>
          </div>
        </div>
      </header>

      {/* 🚀 MAIN HERO & PORTAL CARDS */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 lg:py-16 flex flex-col justify-center">
        {/* Header Text */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-slate-300 mb-4">
            <Layers size={13} className="text-emerald-400" />
            <span>Pilih Sistem yang Ingin Dikelola</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white font-['Outfit']">
            Sistem Operasional <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">Anitech</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-400 font-normal leading-relaxed">
            Dua sistem mandiri terpisah yang dirancang khusus untuk manajemen keuangan presisi dan monitoring pertumbuhan performa bisnis Anda.
          </p>
        </div>

        {/* 2 GRAND CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* SYSTEM 1: SISTEM FINANCE */}
          <Link
            href="/finance"
            className="group relative rounded-2xl p-6 sm:p-8 bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-emerald-500/25 hover:border-emerald-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 flex flex-col justify-between overflow-hidden"
            style={{ backdropFilter: 'blur(20px)' }}
          >
            {/* Top Glow Accent */}
            <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-all" />

            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                  <Wallet size={24} />
                </div>
                <span className="text-[11px] font-mono font-bold uppercase px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                  <Activity size={12} />
                  SISTEM FINANCE
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-white font-['Outfit'] group-hover:text-emerald-300 transition-colors">
                Sistem Finance &amp; Kas
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                Manajemen pembukuan kas, pencatatan transaksi masuk/keluar, penagihan faktur piutang, rekonsiliasi, serta kalkulasi runway bisnis dan kepatuhan pajak.
              </p>

              {/* Feature Highlights */}
              <div className="mt-6 space-y-2.5 pt-4 border-t border-white/[0.06]">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Buku Kas Real-time &amp; Arus Kas Operasional</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Manajemen Faktur &amp; Penagihan Piutang Terjadwal</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Kalkulator Pajak &amp; Proyeksi Runway Kas</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="flex items-center gap-1 text-emerald-300 font-medium">
                    <Bot size={13} /> AI Asisten Analis Keuangan
                  </span>
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="mt-8 pt-4 flex items-center justify-between border-t border-white/[0.06]">
              <span className="text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                Buka Sistem Finance <ArrowRight size={14} />
              </span>
              <div className="w-8 h-8 rounded-full bg-white/[0.04] group-hover:bg-emerald-500/20 flex items-center justify-center text-slate-400 group-hover:text-emerald-300 transition-all">
                <ArrowUpRight size={16} />
              </div>
            </div>
          </Link>

          {/* SYSTEM 2: SISTEM MONITORING USAHA */}
          <Link
            href="/monitoring"
            className="group relative rounded-2xl p-6 sm:p-8 bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-cyan-500/25 hover:border-cyan-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/10 flex flex-col justify-between overflow-hidden"
            style={{ backdropFilter: 'blur(20px)' }}
          >
            {/* Top Glow Accent */}
            <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none group-hover:bg-cyan-500/20 transition-all" />

            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                  <BarChart3 size={24} />
                </div>
                <span className="text-[11px] font-mono font-bold uppercase px-2.5 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5">
                  <Activity size={12} />
                  MONITORING USAHA
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-white font-['Outfit'] group-hover:text-cyan-300 transition-colors">
                Sistem Monitoring Usaha
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                Pemantauan komprehensif performa usaha, pencapaian target penjualan, efisiensi operasional tim, data trust dokumen, dan rekomendasi strategis eksekutif.
              </p>

              {/* Feature Highlights */}
              <div className="mt-6 space-y-2.5 pt-4 border-t border-white/[0.06]">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Dashboard Eksekutif KPI &amp; Target Pendapatan</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Analisis Tren Penjualan &amp; Margin Per Produk</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Struktur Tim &amp; Audit Integritas Data Usaha</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span className="flex items-center gap-1 text-cyan-300 font-medium">
                    <Bot size={13} /> AI Asisten Strategi Eksekutif
                  </span>
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="mt-8 pt-4 flex items-center justify-between border-t border-white/[0.06]">
              <span className="text-xs font-semibold text-cyan-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                Buka Monitoring Usaha <ArrowRight size={14} />
              </span>
              <div className="w-8 h-8 rounded-full bg-white/[0.04] group-hover:bg-cyan-500/20 flex items-center justify-center text-slate-400 group-hover:text-cyan-300 transition-all">
                <ArrowUpRight size={16} />
              </div>
            </div>
          </Link>
        </div>

        {/* Security & Infrastructure Strip */}
        <div className="mt-12 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span>Arsitektur Terpisah: Setiap sistem beroperasi mandiri dan independen dari sistem eksternal.</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span>Finance: <strong className="text-slate-200">/finance</strong></span>
            <span>Monitoring: <strong className="text-slate-200">/monitoring</strong></span>
          </div>
        </div>
      </main>
    </div>
  );
}
