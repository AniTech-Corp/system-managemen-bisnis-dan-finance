export const TAX_FEATURE_LOCKED = true as const;

export const TAX_FEATURE_LOCK_MESSAGE =
  'Fitur perpajakan belum tersedia saat ini.';

const TAX_REQUEST_PATTERN = /\b(pajak|perpajakan|pph|ppn|sp2dk|spt|djp|coretax|efaktur|ebupot|tax|taxes|taxation|tax\s+advisor|tax\s+engine|faktur\s+pajak|setoran\s+pajak|tarif\s+pajak)\b/i;

export function isTaxFeatureRequest(message: string): boolean {
  return TAX_REQUEST_PATTERN.test(message.trim());
}

export function buildTaxFeatureLockResponse() {
  return {
    text: TAX_FEATURE_LOCK_MESSAGE,
    featureLocked: true,
    lockedFeature: 'tax',
  } as const;
}
