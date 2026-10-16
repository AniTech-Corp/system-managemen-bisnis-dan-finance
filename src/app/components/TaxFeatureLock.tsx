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
        border: '1px solid rgba(201,166,107,0.28)',
        background: 'linear-gradient(135deg, rgba(201,166,107,0.12), rgba(78,155,255,0.06))',
        color: '#F5F7FA',
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
          background: 'rgba(201,166,107,0.16)',
          color: '#C9A66B',
        }}
      >
        <LockKeyhole size={compact ? 15 : 18} strokeWidth={1.8} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0 }}>
        <strong style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: compact ? '12px' : '13px', color: '#F5F7FA' }}>
          Perpajakan <span style={{ color: '#C9A66B' }}>Belum tersedia</span>
        </strong>
        <span style={{ fontSize: compact ? '10.5px' : '11.5px', lineHeight: 1.55, color: '#A9B2C0' }}>
          {TAX_FEATURE_LOCK_MESSAGE}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#C9A66B' }}>
          <Clock3 size={11} strokeWidth={1.8} /> Belum ada perhitungan, reminder, atau aksi pajak yang aktif
        </span>
      </span>
    </div>
  );
}
