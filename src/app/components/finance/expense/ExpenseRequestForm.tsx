'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ExpenseCategory, Role } from '@prisma/client';
import { EXPENSE_CATEGORY_LABELS } from '@/lib/expense-approval-engine';

interface ExpenseRequestItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  accountCode?: string;
}

interface ExpenseRequestFormProps {
  workspaceId: string;
  userRole: Role;
  initialData?: {
    id?: string;
    title: string;
    description: string;
    category: ExpenseCategory;
    receiptUrls: string[];
    items: ExpenseRequestItem[];
  };
  onSubmit: (data: {
    title: string;
    description: string;
    category: ExpenseCategory;
    receiptUrls: string[];
    items: ExpenseRequestItem[];
    action: 'DRAFT' | 'SUBMIT';
  }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => ({
  value: value as ExpenseCategory,
  label,
}));

export default function ExpenseRequestForm({
  workspaceId,
  userRole,
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: ExpenseRequestFormProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [category, setCategory] = useState<ExpenseCategory>(initialData?.category || 'OPERATIONAL');
  const [items, setItems] = useState<ExpenseRequestItem[]>(
    initialData?.items?.length ? initialData.items : [{ description: '', quantity: 1, unitPrice: 0 }]
  );
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [receiptPreviews, setReceiptPreviews] = useState<string[]>(initialData?.receiptUrls || []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description);
      setCategory(initialData.category);
      setItems(initialData.items?.length ? initialData.items : [{ description: '', quantity: 1, unitPrice: 0 }]);
      setReceiptPreviews(initialData.receiptUrls || []);
    }
  }, [initialData]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Judul wajib diisi';
    if (!description.trim()) newErrors.description = 'Deskripsi wajib diisi';
    if (!category) newErrors.category = 'Kategori wajib dipilih';
    if (items.length === 0) newErrors.items = 'Minimal 1 item wajib diisi';
    
    const newItemErrors: Record<number, string> = {};
    items.forEach((item, idx) => {
      if (!item.description.trim()) newItemErrors[idx] = 'Deskripsi item wajib diisi';
      if (item.quantity <= 0) newItemErrors[idx] = 'Qty harus > 0';
      if (item.unitPrice < 0) newItemErrors[idx] = 'Harga tidak boleh negatif';
    });

    setErrors(newErrors);
    setItemErrors(newItemErrors);
    return Object.keys(newErrors).length === 0 && Object.keys(newItemErrors).length === 0;
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  const handleItemChange = (index: number, field: keyof ExpenseRequestItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    if (itemErrors[index]) setItemErrors(prev => ({ ...prev, [index]: '' }));
  };

  const addItem = () => {
    setItems(prev => [...prev, { description: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
    setItemErrors(prev => {
      const next = { ...prev };
      delete next[index];
      // Re-index errors
      const reindexed: Record<number, string> = {};
      Object.entries(next).forEach(([k, v]) => {
        const idx = parseInt(k);
        reindexed[idx > index ? idx - 1 : idx] = v;
      });
      return reindexed;
    });
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(f => 
      ['image/jpeg', 'image/png', 'application/pdf'].includes(f.type) && f.size <= 10 * 1024 * 1024
    );
    if (validFiles.length !== files.length) {
      alert('File harus berupa JPG, PNG, atau PDF, maksimal 10MB per file.');
    }
    setReceiptFiles(prev => [...prev, ...validFiles]);
    
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setReceiptPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeReceipt = (index: number) => {
    setReceiptPreviews(prev => prev.filter((_, i) => i !== index));
    setReceiptFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (action: 'DRAFT' | 'SUBMIT') => {
    if (!validateForm()) return;
    
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      category,
      receiptUrls: receiptPreviews,
      items: items.map(item => ({
        description: item.description.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        accountCode: item.accountCode?.trim(),
      })),
      action,
    });
  };

  const total = calculateTotal();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {initialData?.id ? 'Edit Pengajuan Pengeluaran' : 'Buat Pengajuan Pengeluaran Baru'}
          </h2>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-700 uppercase tracking-wider">Informasi Dasar</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Judul Pengajuan *</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Contoh: Pembelian Perlengkapan Kantor Bulan Ini"
                  className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    errors.title ? 'border-red-300 focus:border-red-500' : 'border-slate-300'
                  }`}
                  disabled={isLoading}
                />
                {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kategori *</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as ExpenseCategory)}
                  className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    errors.category ? 'border-red-300 focus:border-red-500' : 'border-slate-300'
                  }`}
                  disabled={isLoading}
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Deskripsi *</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Jelaskan alasan dan detail pengeluaran ini..."
                className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  errors.description ? 'border-red-300 focus:border-red-500' : 'border-slate-300'
                }`}
                disabled={isLoading}
              />
              {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description}</p>}
            </div>
          </div>

          {/* Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-700 uppercase tracking-wider">Item Pengeluaran</h3>
              <button
                type="button"
                onClick={addItem}
                disabled={isLoading}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Tambah Item
              </button>
            </div>

            {errors.items && <p className="text-xs text-red-600">{errors.items}</p>}

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={item.id || idx} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-sm font-medium text-slate-700">Item #{idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        disabled={isLoading}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Deskripsi *</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={e => handleItemChange(idx, 'description', e.target.value)}
                        placeholder="Contoh: Sewa kantor bulan Januari"
                        className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                          itemErrors[idx] ? 'border-red-300 focus:border-red-500' : 'border-slate-300'
                        }`}
                        disabled={isLoading}
                      />
                      {itemErrors[idx] && <p className="mt-1 text-xs text-red-600">{itemErrors[idx]}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Qty *</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={e => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                        min="1"
                        max="1000000"
                        className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                          itemErrors[idx] ? 'border-red-300 focus:border-red-500' : 'border-slate-300'
                        }`}
                        disabled={isLoading}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Harga Satuan *</label>
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={e => handleItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="100"
                        className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                          itemErrors[idx] ? 'border-red-300 focus:border-red-500' : 'border-slate-300'
                        }`}
                        disabled={isLoading}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Kode Akun (Opsional)</label>
                      <input
                        type="text"
                        value={item.accountCode || ''}
                        onChange={e => handleItemChange(idx, 'accountCode', e.target.value)}
                        placeholder="Contoh: 6-1100"
                        className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 border-slate-300`}
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-end">
                    <span className="text-sm font-mono font-semibold text-emerald-700">
                      Subtotal: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.quantity * item.unitPrice)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Receipts */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-700 uppercase tracking-wider">Bukti Transaksi (Opsional)</h3>
            
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6">
              <input
                type="file"
                id="receipt-upload"
                multiple
                accept="image/jpeg,image/png,application/pdf"
                onChange={handleReceiptUpload}
                disabled={isLoading}
                className="hidden"
              />
              <label
                htmlFor="receipt-upload"
                className="cursor-pointer flex flex-col items-center justify-center text-center"
              >
                <Upload className="w-10 h-10 text-slate-400 mb-2" />
                <p className="text-sm text-slate-600">Klik atau tarik file bukti (JPG, PNG, PDF - max 10MB)</p>
                <p className="text-xs text-slate-400 mt-1">Bisa upload multiple file</p>
              </label>
            </div>

            {receiptPreviews.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {receiptPreviews.map((preview, idx) => (
                  <div key={idx} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-slate-200">
                    {preview.startsWith('data:image') ? (
                      <img src={preview} alt={`Bukti ${idx + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100">
                        <FileText className="w-8 h-8 text-slate-400" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeReceipt(idx)}
                      disabled={isLoading}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total Summary */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-800">Total Pengajuan</span>
              <span className="text-2xl font-bold font-mono text-emerald-700">
                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(total)}
              </span>
            </div>
            <p className="text-xs text-emerald-600 mt-1">
              {items.length} item • {items.reduce((sum, i) => sum + i.quantity, 0)} total quantity
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={() => handleSubmit('DRAFT')}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
          >
            Simpan Draft
          </button>
          <button
            onClick={() => handleSubmit('SUBMIT')}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 border border-emerald-600 rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Ajukan untuk Review
          </button>
        </div>
      </div>
    </div>
  );
}