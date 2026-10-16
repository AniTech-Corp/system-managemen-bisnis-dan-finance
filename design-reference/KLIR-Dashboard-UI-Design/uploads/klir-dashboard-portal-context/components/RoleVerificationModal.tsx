'use client';

import React, { useState } from 'react';
import {
  Lock,
  X,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

interface RoleVerificationModalProps {
  isOpen: boolean;
  role: 'CEO' | 'FINANCE' | 'MARKETING';
  onClose: () => void;
  onVerified: () => void;
}

export default function RoleVerificationModal({
  isOpen,
  role,
  onClose,
  onVerified,
}: RoleVerificationModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const roleConfig = {
    CEO: {
      title: 'Verifikasi Keamanan CEO / Owner',
      desc: 'Area ini memuat data keuangan sensitif, valuasi bisnis, dan Simulator What-If. Masukkan PIN Otorisasi CEO.',
      icon: '👑',
      color: '#00D2FF',
      defaultPin: '8888',
      roleBadge: 'CHIEF EXECUTIVE OFFICER',
    },
    FINANCE: {
      title: 'Verifikasi Keamanan Divisi Keuangan',
      desc: 'Area ini memuat mutasi buku kas riil dan data penagihan faktur piutang. Masukkan PIN Petugas Keuangan.',
      icon: '💰',
      color: '#3FBF8F',
      defaultPin: '1234',
      roleBadge: 'FINANCE CONTROLLER',
    },
    MARKETING: {
      title: 'Verifikasi Keamanan Divisi Pemasaran',
      desc: 'Area ini memuat alokasi anggaran iklan dan kupon diskon promo. Masukkan PIN Petugas Pemasaran.',
      icon: '📣',
      color: '#F2A83B',
      defaultPin: '5678',
      roleBadge: 'MARKETING LEAD',
    },
  }[role];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setError(null);

    setTimeout(() => {
      // Allow default role PIN or quick pass
      if (pin === roleConfig.defaultPin || pin === '123456' || pin === '8888' || pin === 'admin') {
        setIsVerifying(false);
        setPin('');
        onVerified();
      } else {
        setIsVerifying(false);
        setError(`PIN tidak valid. Gunakan PIN Otorisasi (${roleConfig.defaultPin})`);
      }
    }, 300);
  };

  const handleQuickVerify = () => {
    setPin(roleConfig.defaultPin);
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      onVerified();
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#0B0E14] border border-white/20 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#8A93A3] hover:text-white transition-colors p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="text-center space-y-2">
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl shadow-lg"
            style={{
              backgroundColor: `${roleConfig.color}20`,
              border: `1px solid ${roleConfig.color}50`,
            }}
          >
            {roleConfig.icon}
          </div>

          <div className="space-y-1">
            <span
              className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase inline-block"
              style={{
                backgroundColor: `${roleConfig.color}15`,
                color: roleConfig.color,
                border: `1px solid ${roleConfig.color}30`,
              }}
            >
              {roleConfig.roleBadge}
            </span>
            <h3 className="font-heading font-extrabold text-xl text-white">{roleConfig.title}</h3>
          </div>

          <p className="text-xs text-[#8A93A3] leading-relaxed max-w-xs mx-auto">
            {roleConfig.desc}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-[#8A93A3] block mb-1.5 font-medium">
              Masukkan PIN Akses Khusus:
            </label>
            <div className="relative">
              <input
                type="password"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder={`PIN Otorisasi (Default: ${roleConfig.defaultPin})`}
                required
                autoFocus
                className="w-full bg-[#141820] border border-white/15 rounded-xl px-4 py-3 text-white text-center font-mono text-base tracking-widest placeholder-[#5C6474] focus:outline-none focus:border-[#4E9BFF]"
              />
              <KeyRound className="w-4 h-4 text-[#8A93A3] absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {error && (
            <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-[11px] text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3 bg-gradient-to-b from-[#0F6FE0] to-[#0058BE] text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer shadow-lg shadow-[#0058BE]/25 text-xs"
            >
              {isVerifying ? 'Memverifikasi Kredensial...' : 'Buka & Masuk ke Portal →'}
            </button>

            {/* Quick 1-Click Authorized Bypass for Convenience */}
            <button
              type="button"
              onClick={handleQuickVerify}
              className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-[#8A93A3] hover:text-white rounded-xl text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#3FBF8F]" />
              <span>Verifikasi Cepat dengan Kredensial Resmi ({roleConfig.defaultPin})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
