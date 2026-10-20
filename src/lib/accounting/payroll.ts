/**
 * Perhitungan slip gaji (murni, tanpa DB).
 *
 * Sistem TIDAK menghitung tarif pajak. PPh 21 dan BPJS diisi manual dari
 * aplikasi payroll resmi; fungsi ini hanya memastikan angka slip konsisten:
 *
 *   bruto        = gaji pokok + tunjangan + lembur
 *   potongan     = PPh 21 + BPJS karyawan + potongan lain
 *   gaji bersih  = bruto - potongan
 *   biaya pemberi kerja = bruto + BPJS pemberi kerja
 *
 * BPJS pemberi kerja TIDAK mengurangi gaji bersih — itu tambahan biaya company.
 */

export interface PayrollInput {
  basicSalary: number;
  allowance?: number;
  overtime?: number;
  pph21?: number;
  bpjsEmployee?: number;
  bpjsEmployer?: number;
  otherDeductions?: number;
}

export interface PayrollBreakdown {
  gross: number;
  pph21: number;
  bpjsEmployee: number;
  bpjsEmployer: number;
  otherDeductions: number;
  /** Total potongan karyawan (mengisi kolom lama `deductions`). */
  deductions: number;
  net: number;
  /** Beban yang masuk Laba Rugi: bruto + BPJS pemberi kerja. */
  employerCost: number;
}

export type PayrollResult = { ok: true; value: PayrollBreakdown } | { ok: false; error: string };

function nonNegative(name: string, value: number | undefined): number | string {
  if (value === undefined || value === null) return 0;
  if (!Number.isFinite(value)) return `${name} harus angka.`;
  if (value < 0) return `${name} tidak boleh negatif.`;
  return value;
}

export function computePayroll(input: PayrollInput): PayrollResult {
  const basic = nonNegative('Gaji pokok', input.basicSalary);
  if (typeof basic === 'string') return { ok: false, error: basic };

  const allowance = nonNegative('Tunjangan', input.allowance);
  if (typeof allowance === 'string') return { ok: false, error: allowance };

  const overtime = nonNegative('Lembur', input.overtime);
  if (typeof overtime === 'string') return { ok: false, error: overtime };

  const pph21 = nonNegative('PPh 21', input.pph21);
  if (typeof pph21 === 'string') return { ok: false, error: pph21 };

  const bpjsEmployee = nonNegative('BPJS karyawan', input.bpjsEmployee);
  if (typeof bpjsEmployee === 'string') return { ok: false, error: bpjsEmployee };

  const bpjsEmployer = nonNegative('BPJS pemberi kerja', input.bpjsEmployer);
  if (typeof bpjsEmployer === 'string') return { ok: false, error: bpjsEmployer };

  const other = nonNegative('Potongan lain', input.otherDeductions);
  if (typeof other === 'string') return { ok: false, error: other };

  const gross = round2(basic + allowance + overtime);
  const deductions = round2(pph21 + bpjsEmployee + other);
  const net = round2(gross - deductions);

  if (net < 0) {
    return {
      ok: false,
      error: 'Total potongan melebihi gaji bruto. Periksa PPh 21, BPJS, dan potongan lain.',
    };
  }

  return {
    ok: true,
    value: {
      gross,
      pph21: round2(pph21),
      bpjsEmployee: round2(bpjsEmployee),
      bpjsEmployer: round2(bpjsEmployer),
      otherDeductions: round2(other),
      deductions,
      net,
      employerCost: round2(gross + bpjsEmployer),
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
