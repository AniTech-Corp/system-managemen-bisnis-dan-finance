'use client';

import { Clock3, LockKeyhole } from 'lucide-react';
import { TAX_FEATURE_LOCK_MESSAGE } from '@/lib/tax-feature';

interface TaxFeatureLockProps {
  compact?: boolean;
}

export default function TaxFeatureLock({ compact = false }: TaxFeatureLockProps) {
  return (
    <div
      data-testid="tax-feature-lock"
      role="status"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: compact ? '10px' : '14px',
        padding: compact ? '14px' : '20px',
        borderRadius: compact ? '12px' : '16px',
        border: '1px solid #E2E8F0',
        background: '#F8FAFC',
        color: '#0F172A',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'grid',
          placeItems: 'center',
          width: compact ? '30px' : '36px',
          height: compact ? '30px' : '36px',
          flexShrink: 0,
          borderRadius: '10px',
          background: '#FEF3C7',
          color: '#B45309',
        }}
      >
        <LockKeyhole size={compact ? 15 : 18} strokeWidth={1.8} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0 }}>
        <strong style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: compact ? '12px' : '13px', color: '#0F172A' }}>
          Perpajakan <span style={{ color: '#B45309' }}>Belum tersedia</span>
        </strong>
        <span style={{ fontSize: compact ? '10.5px' : '11.5px', lineHeight: 1.55, color: '#475569' }}>
          {TAX_FEATURE_LOCK_MESSAGE}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#B45309' }}>
          <Clock3 size={12} strokeWidth={1.8} /> Belum ada perhitungan, reminder, atau aksi pajak yang aktif
        </span>
      </span>
    </div>
  );
}
