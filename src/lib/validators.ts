import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter'),
});

export const RegisterSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter'),
  fullName: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
  workspaceName: z.string().optional(),
});

export const TopUpCreditSchema = z.object({
  workspaceId: z.string().uuid('Workspace ID tidak valid'),
  packageId: z.enum(['MINI_1000', 'MEDIUM_3000', 'PRO_5000', 'STARTER_WEEKLY', 'BUSINESS_WEEKLY']),
  paymentMethod: z.enum(['QRIS', 'BCA_VA', 'MANDIRI_VA', 'BRI_VA', 'CREDIT_CARD']).default('QRIS'),
});

export const CorPlanGenerateSchema = z.object({
  workspaceId: z.string().uuid('Workspace ID tidak valid'),
  businessName: z.string().min(2, 'Nama usaha minimal 2 karakter'),
  industry: z.string().min(2, 'Industri minimal 2 karakter'),
  targetMarket: z.string().min(2, 'Target pasar minimal 2 karakter'),
  initialCapital: z.number().nonnegative('Modal awal tidak boleh negatif'),
  businessType: z.string().optional(),
});

export const CopywritingGenerateSchema = z.object({
  workspaceId: z.string().uuid('Workspace ID tidak valid'),
  productName: z.string().min(2, 'Nama produk minimal 2 karakter'),
  productDescription: z.string().min(5, 'Deskripsi produk minimal 5 karakter'),
  targetAudience: z.string().min(2, 'Target audiens minimal 2 karakter'),
  tone: z.enum(['SKENA_JAKSEL', 'SELLER_RAMAH', 'KORPORAT_FORMAL', 'STORYTELLING_EMOSIONAL', 'HUMOR_SANTAI']).default('SKENA_JAKSEL'),
});

export const CashTransactionSchema = z.object({
  workspaceId: z.string().uuid('Workspace ID tidak valid'),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number().positive('Nominal harus lebih dari 0'),
  category: z.string().min(2, 'Kategori minimal 2 karakter'),
  description: z.string().min(2, 'Keterangan minimal 2 karakter'),
  paymentMethod: z.string().default('CASH'),
});

export const InvoiceCreateSchema = z.object({
  workspaceId: z.string().uuid('Workspace ID tidak valid'),
  clientName: z.string().min(2, 'Nama klien minimal 2 karakter'),
  clientPhone: z.string().optional(),
  amount: z.number().positive('Total invoice harus lebih dari 0'),
  items: z.array(
    z.object({
      description: z.string(),
      qty: z.number().positive(),
      unitPrice: z.number().nonnegative(),
      total: z.number().nonnegative(),
    })
  ).min(1, 'Minimal 1 item tagihan'),
  dueDate: z.string().optional(),
});

export function normalizePhone(rawPhone: string): string {
  let cleanPhone = (rawPhone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.slice(1);
  }
  return cleanPhone;
}
