'use client';

import React, { useState, useCallback } from 'react';
import { Role } from '@prisma/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ExpenseRequestList from './ExpenseRequestList';
import ExpenseRequestForm from './ExpenseRequestForm';
import ExpenseRequestDetail from './ExpenseRequestDetail';
import MyApprovalsDashboard from './MyApprovalsDashboard';
import ExpenseStatsCards from './ExpenseStatsCards';
import FinanceReviewPanel from './FinanceReviewPanel';
import { BarChart3, Clock3, FileText, Plus, RefreshCw } from 'lucide-react';
import { ExpenseRequest, ExpenseRequestItem, ExpenseApproval } from '@/lib/expense-approval-types';

export default function ExpenseApprovalTab({
  workspaceId,
  userRole,
  userId,
}: {
  workspaceId: string;
  userRole: Role;
  userId: string;
}) {
  const [activeTab, setActiveTab] = useState<'list' | 'my-approvals' | 'stats'>('list');
  const [selectedRequest, setSelectedRequest] = useState<ExpenseRequest | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ExpenseRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleViewDetail = useCallback((request: ExpenseRequest) => {
    setSelectedRequest(request);
  }, []);

  const handleEditDraft = useCallback((request: ExpenseRequest) => {
    setEditingRequest(request);
    setShowForm(true);
  }, []);

  const handleSubmitDraft = useCallback((request: ExpenseRequest) => {
    setSelectedRequest(request);
    // Submit via API
    fetch(`/api/v1/expense-requests/${request.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'SUBMIT' }),
    }).then(async res => {
      const data = await res.json();
      if (data.success) {
        setSelectedRequest(data.expenseRequest);
      } else {
        alert(data.message || 'Gagal mengajukan');
      }
    });
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
  }, []);

  const handleCancel = useCallback(async (requestId: string) => {
    const reason = window.prompt('Alasan membatalkan pengajuan (wajib diisi):', '');
    if (reason === null) return;
    if (!reason.trim()) {
      alert('Alasan pembatalan wajib diisi agar tercatat di audit trail.');
      return;
    }
    const res = await fetch(`/api/v1/expense-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'CANCEL', reason: reason.trim() }),
    });
    const data = await res.json();
    if (data.success) {
      setSelectedRequest(data.expenseRequest);
    } else {
      alert(data.message || 'Gagal membatalkan');
    }
  }, []);

  const handleFormSubmit = async (data: {
    title: string;
    description: string;
    category: string;
    receiptUrls: string[];
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      accountCode?: string;
    }>;
    action: 'DRAFT' | 'SUBMIT';
  }) => {
    setIsSubmitting(true);
    try {
      const url = editingRequest 
        ? `/api/v1/expense-requests/${editingRequest.id}`
        : '/api/v1/expense-requests';
      const method = editingRequest ? 'PATCH' : 'POST';
      const body = editingRequest 
        ? { ...data, action: 'UPDATE_DRAFT' }
        : data;
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      
      const result = await res.json();
      if (result.success) {
        setShowForm(false);
        setEditingRequest(null);
        setSelectedRequest(result.expenseRequest);
      } else {
        alert(result.message || 'Gagal menyimpan');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (requestId: string, level: number, reason: string) => {
    const res = await fetch(`/api/v1/expense-requests/${requestId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ decision: 'APPROVED', reason }),
    });
    const data = await res.json();
    if (data.success) {
      setSelectedRequest(data.expenseRequest);
    } else {
      alert(data.message || 'Gagal menyetujui');
    }
  };

  const handleReject = async (requestId: string, level: number, reason: string) => {
    const res = await fetch(`/api/v1/expense-requests/${requestId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ decision: 'REJECTED', reason }),
    });
    const data = await res.json();
    if (data.success) {
      setSelectedRequest(data.expenseRequest);
    } else {
      alert(data.message || 'Gagal menolak');
    }
  };

  const handleFinanceReview = async (requestId: string, decision: 'APPROVE_TO_NEXT' | 'REJECT' | 'REQUEST_REVISION', notes: string) => {
    const res = await fetch(`/api/v1/expense-requests/${requestId}/finance-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ decision, notes }),
    });
    const data = await res.json();
    if (data.success) {
      setSelectedRequest(data.expenseRequest);
    } else {
      alert(data.message || 'Gagal memproses review');
    }
  };

  const handleRefresh = useCallback(() => {
    window.dispatchEvent(new CustomEvent('expense-requests-refresh'));
  }, []);

  const isFinance = ['FINANCE', 'ADMIN', 'OWNER'].includes(userRole);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Pengajuan Dana</h1>
          <p className="mt-0.5 text-xs text-slate-500">Kelola pengajuan, review, dan persetujuan pengeluaran berjenjang</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Muat ulang
          </button>
          <button
            onClick={() => { setEditingRequest(null); setShowForm(true); }}
            disabled={isSubmitting}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Ajukan Baru
          </button>
        </div>
      </div>

      {/* Stats Cards - only show on list tab */}
      {activeTab === 'list' && (
        <ExpenseStatsCards workspaceId={workspaceId} userRole={userRole} userId={userId} />
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'list' | 'my-approvals' | 'stats')} className="w-full">
        <TabsList className="flex h-auto w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <TabsTrigger value="list" className="min-h-10 min-w-max flex-1 gap-1.5 rounded-lg px-2 text-xs sm:px-3">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Daftar Pengajuan</span>
          </TabsTrigger>
          <TabsTrigger value="my-approvals" className="min-h-10 min-w-max flex-1 gap-1.5 rounded-lg px-2 text-xs sm:px-3">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Persetujuan Saya</span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="min-h-10 min-w-max flex-1 gap-1.5 rounded-lg px-2 text-xs sm:px-3">
            <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Statistik</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-3">
          <ExpenseRequestList
            workspaceId={workspaceId}
            userRole={userRole}
            userId={userId}
            onViewDetail={handleViewDetail}
            onEditDraft={handleEditDraft}
            onSubmitDraft={handleSubmitDraft}
            onCancel={handleCancel}
          />
        </TabsContent>

        <TabsContent value="my-approvals" className="mt-3">
          <MyApprovalsDashboard
            workspaceId={workspaceId}
            userRole={userRole}
            userId={userId}
            onApprove={handleApprove}
            onReject={handleReject}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="stats" className="mt-3">
          <ExpenseStatsCards workspaceId={workspaceId} userRole={userRole} userId={userId} />
        </TabsContent>
      </Tabs>

      {/* Detail Modal */}
      {selectedRequest && (
        <ExpenseRequestDetail
          request={selectedRequest}
          userRole={userRole}
          userId={userId}
          onClose={() => setSelectedRequest(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          onFinanceReview={handleFinanceReview}
          onCancel={handleCancel}
        />
      )}

      {/* Form Modal */}
      {showForm && (
        <ExpenseRequestForm
          workspaceId={workspaceId}
          userRole={userRole}
          initialData={editingRequest ? {
            id: editingRequest.id,
            title: editingRequest.title,
            description: editingRequest.description,
            category: editingRequest.category,
            receiptUrls: editingRequest.receiptUrls,
            items: editingRequest.items.map(item => ({
              id: item.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              accountCode: item.accountCode,
            })),
          } : undefined}
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowForm(false); setEditingRequest(null); }}
          isLoading={isSubmitting}
        />
      )}

      {/* Finance Review Panel - shown inline when viewing a request in FINANCE_REVIEW status */}
      {selectedRequest && selectedRequest.status === 'FINANCE_REVIEW' && isFinance && (
        <FinanceReviewPanel
          request={selectedRequest}
          userRole={userRole}
          userId={userId}
          onReview={handleFinanceReview}
        />
      )}
    </div>
  );
}