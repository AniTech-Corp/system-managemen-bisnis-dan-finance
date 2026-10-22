'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Boxes,
  CalendarClock,
  FileSpreadsheet,
  LayoutDashboard,
  Tags,
  Wrench,
} from 'lucide-react';
import AssetDashboard from './AssetDashboard';
import AssetList from './AssetList';
import AssetFormModal from './AssetFormModal';
import AssetDetailModal from './AssetDetailModal';
import DepreciationView from './DepreciationView';
import MaintenanceView from './MaintenanceView';
import ReportsView from './ReportsView';
import CategoryView from './CategoryView';
import {
  DisposeAssetModal,
  ImpairAssetModal,
  MaintenanceFormModal,
  TransferAssetModal,
} from './AssetActionModals';
import { apiGet, apiSend, type Asset, type AssetCategory } from './client';
import { Alert, Spinner } from './ui';

type Section = 'overview' | 'assets' | 'depreciation' | 'maintenance' | 'reports' | 'categories';

const SECTIONS: Array<{
  id: Section;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'assets', label: 'Daftar Aset', icon: Boxes },
  { id: 'depreciation', label: 'Penyusutan', icon: CalendarClock },
  { id: 'maintenance', label: 'Pemeliharaan', icon: Wrench },
  { id: 'reports', label: 'Laporan', icon: FileSpreadsheet },
  { id: 'categories', label: 'Kategori', icon: Tags },
];

export default function AssetTab({ workspaceId }: { workspaceId: string }) {
  const [section, setSection] = useState<Section>('overview');
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [members, setMembers] = useState<Array<{ id: string; fullName: string; email?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [detailAssetId, setDetailAssetId] = useState<string | null>(null);
  const [disposeAsset, setDisposeAsset] = useState<Asset | null>(null);
  const [transferAsset, setTransferAsset] = useState<Asset | null>(null);
  const [impairAsset, setImpairAsset] = useState<Asset | null>(null);
  const [maintenanceFor, setMaintenanceFor] = useState<Asset | null>(null);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [assetOptions, setAssetOptions] = useState<Asset[]>([]);
  const [hasPostedDepreciation, setHasPostedDepreciation] = useState(false);

  const seeded = useRef(false);
  const bump = useCallback(() => setRefreshKey((value) => value + 1), []);

  const loadCategories = useCallback(async () => {
    const response = await apiGet<{ data: AssetCategory[] }>('/api/v1/assets/categories');
    return response.data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [categoryList, membersResponse] = await Promise.all([
          loadCategories(),
          apiGet<{ members: Array<{ user: { id: string; fullName: string; email: string } }> }>(
            `/api/v1/workspaces/${workspaceId}/members`
          ).catch(() => ({ members: [] })),
        ]);

        if (cancelled) return;

        let resolvedCategories = categoryList;
        if (categoryList.length === 0 && !seeded.current) {
          seeded.current = true;
          try {
            await apiSend('/api/v1/assets/categories/seed', 'POST');
            resolvedCategories = await loadCategories();
          } catch {
            // Biarkan kosong; pengguna bisa menekan tombol Kategori Bawaan.
          }
        }

        setCategories(resolvedCategories);
        setMembers(
          (membersResponse.members ?? []).map((member) => ({
            id: member.user.id,
            fullName: member.user.fullName,
            email: member.user.email,
          }))
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Gagal memuat modul aset.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, loadCategories]);

  const loadAssetOptions = useCallback(async () => {
    try {
      const response = await apiGet<{ data: Asset[] }>('/api/v1/assets?limit=200');
      setAssetOptions(response.data.filter((asset) => asset.status !== 'DISPOSED' && asset.status !== 'SOLD'));
    } catch {
      setAssetOptions([]);
    }
  }, []);

  useEffect(() => {
    void loadAssetOptions();
  }, [loadAssetOptions, refreshKey]);

  const openCreate = () => {
    setEditingAsset(null);
    setHasPostedDepreciation(false);
    setFormOpen(true);
  };

  const openEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setHasPostedDepreciation(false);
    setFormOpen(true);
    // Cek status posting agar field penyusutan bisa dikunci lebih awal.
    apiGet<{ depreciationEntries: Array<{ isPosted: boolean }> }>(`/api/v1/assets/${asset.id}`)
      .then((response) => {
        setHasPostedDepreciation((response.depreciationEntries ?? []).some((entry) => entry.isPosted));
      })
      .catch(() => setHasPostedDepreciation(false));
  };

  const openMaintenanceFor = (asset: Asset | null) => {
    setMaintenanceFor(asset);
    setMaintenanceOpen(true);
  };

  const afterChange = () => {
    bump();
    if (detailAssetId) {
      // Detail memuat ulang sendiri saat dibuka; cukup refresh daftar.
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <Spinner label="Menyiapkan modul aset..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              Manajemen Aset & Penyusutan
            </h1>
            <p className="text-xs text-slate-500">
              Catat aset tetap, hitung penyusutan otomatis, dan jaga nilai buku tetap akurat.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Terhubung ke Jurnal
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  active
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {section === 'overview' && (
        <AssetDashboard
          refreshKey={refreshKey}
          onNavigate={setSection}
          onAddAsset={openCreate}
        />
      )}

      {section === 'assets' && (
        <AssetList
          categories={categories}
          refreshKey={refreshKey}
          onAdd={openCreate}
          onSelect={(assetId) => setDetailAssetId(assetId)}
          onEdit={openEdit}
          onChanged={afterChange}
        />
      )}

      {section === 'depreciation' && (
        <DepreciationView refreshKey={refreshKey} onChanged={afterChange} />
      )}

      {section === 'maintenance' && (
        <MaintenanceView
          refreshKey={refreshKey}
          onAdd={() => openMaintenanceFor(null)}
          onChanged={afterChange}
        />
      )}

      {section === 'reports' && <ReportsView categories={categories} refreshKey={refreshKey} />}

      {section === 'categories' && (
        <CategoryView refreshKey={refreshKey} onChanged={bump} />
      )}

      <AssetFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          bump();
          if (editingAsset) {
            setDetailAssetId(editingAsset.id);
          }
        }}
        categories={categories}
        members={members}
        asset={editingAsset}
        hasPostedDepreciation={hasPostedDepreciation}
      />

      <AssetDetailModal
        open={Boolean(detailAssetId)}
        assetId={detailAssetId}
        onClose={() => setDetailAssetId(null)}
        onEdit={(asset) => {
          setDetailAssetId(null);
          openEdit(asset);
        }}
        onDispose={(asset) => setDisposeAsset(asset)}
        onTransfer={(asset) => setTransferAsset(asset)}
        onImpair={(asset) => setImpairAsset(asset)}
        onAddMaintenance={(asset) => openMaintenanceFor(asset)}
      />

      <DisposeAssetModal
        open={Boolean(disposeAsset)}
        asset={disposeAsset}
        onClose={() => setDisposeAsset(null)}
        onDone={() => {
          afterChange();
          setDetailAssetId(null);
        }}
      />

      <TransferAssetModal
        open={Boolean(transferAsset)}
        asset={transferAsset}
        members={members}
        onClose={() => setTransferAsset(null)}
        onDone={() => {
          afterChange();
          setDetailAssetId(null);
        }}
      />

      <ImpairAssetModal
        open={Boolean(impairAsset)}
        asset={impairAsset}
        onClose={() => setImpairAsset(null)}
        onDone={() => {
          afterChange();
          setDetailAssetId(null);
        }}
      />

      <MaintenanceFormModal
        open={maintenanceOpen}
        onClose={() => setMaintenanceOpen(false)}
        assets={assetOptions}
        defaultAssetId={maintenanceFor?.id ?? null}
        onDone={afterChange}
      />
    </div>
  );
}
