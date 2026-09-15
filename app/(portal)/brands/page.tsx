'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../../../components/header';
import { api } from '../../../lib/api';
import { Brand } from '../../../lib/types';

/* ─── Modal ─── */
interface BrandModalProps {
  brand: Brand | null;
  onClose: () => void;
  onSaved: (b: Brand) => void;
}

function BrandModal({ brand, onClose, onSaved }: BrandModalProps) {
  const isEdit = !!brand;
  const [name, setName] = useState(brand?.name ?? '');
  const [description, setDescription] = useState(brand?.description ?? '');
  const [checklistRef, setChecklistRef] = useState(brand?.seedChecklistReference ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !description.trim()) {
      setError('Brand name and description are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let saved: Brand;
      if (isEdit && brand) {
        saved = await api.updateBrand(brand.id, { name, description, seedChecklistReference: checklistRef || undefined });
      } else {
        saved = await api.createBrand({ name, description, seedChecklistReference: checklistRef || undefined });
      }
      onSaved(saved);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card w-full max-w-md border border-[#1a56db]/40 rounded-2xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-white">{isEdit ? 'Edit OEM Brand' : 'New OEM Brand'}</h2>
            <p className="text-xs text-[#64748b] mt-0.5">{isEdit ? 'Update brand details.' : 'Add a new brand to the Booran roster.'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-[#64748b] hover:text-white hover:bg-white/10 transition-colors">X</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Brand Name <span className="text-red-400">*</span></label>
            <input className="input-field w-full text-sm" placeholder="e.g. BYD" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Description <span className="text-red-400">*</span></label>
            <input className="input-field w-full text-sm" placeholder="e.g. Build Your Dreams - EV / DM-i Super Hybrid" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Checklist Reference <span className="text-[#64748b] font-normal">(optional)</span></label>
            <input className="input-field w-full text-sm" placeholder="e.g. Tier 1 Common Pack / BYD Attachment A" value={checklistRef} onChange={(e) => setChecklistRef(e.target.value)} />
            <p className="text-[11px] text-[#64748b] mt-1">Leave blank to default to Tier 1 Common Pack.</p>
          </div>
        </div>

        {error && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 btn-secondary text-sm py-2 rounded-xl">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary text-sm py-2 px-6 rounded-xl font-bold disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Brand'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─── */
export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalBrand, setModalBrand] = useState<Brand | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getBrands();
        setBrands(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return brands;
    const q = searchQuery.toLowerCase().trim();
    return brands.filter((b) =>
      b.name?.toLowerCase().includes(q) || b.description?.toLowerCase().includes(q),
    );
  }, [brands, searchQuery]);

  const openCreate = () => { setModalBrand(null); setShowModal(true); };
  const openEdit = (b: Brand) => { setModalBrand(b); setShowModal(true); };

  const handleSaved = (saved: Brand) => {
    setBrands((prev) => {
      const idx = prev.findIndex((b) => b.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [saved, ...prev];
    });
    setShowModal(false);
    showToast(modalBrand ? 'Brand updated.' : 'New brand created.');
  };

  const handleDeactivate = async (b: Brand) => {
    if (!confirm(`Deactivate "${b.name}"?`)) return;
    setDeactivating(b.id);
    try {
      await api.deactivateBrand(b.id);
      setBrands((prev) => prev.map((x) => (x.id === b.id ? { ...x, isActive: false } : x)));
      showToast(`${b.name} deactivated.`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally {
      setDeactivating(null);
    }
  };

  const handleReactivate = async (b: Brand) => {
    try {
      const updated = await api.updateBrand(b.id, { isActive: true });
      setBrands((prev) => prev.map((x) => (x.id === b.id ? updated : x)));
      showToast(`${b.name} reactivated.`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed', 'error');
    }
  };

  const activeBrands = brands.filter((b) => b.isActive !== false);
  const inactiveBrands = brands.filter((b) => b.isActive === false);

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="OEM Vehicle Brands"
        subtitle="Manage the Booran brand roster — each brand can be linked to dealership rooftops via the Sites page"
      />
      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Brands', value: brands.length, color: 'text-white' },
            { label: 'Active', value: activeBrands.length, color: 'text-[#10b981]' },
            { label: 'Inactive', value: inactiveBrands.length, color: 'text-[#64748b]' },
          ].map((stat) => (
            <div key={stat.label} className="glass-card-static border border-[#1a56db]/20 p-4 text-center">
              <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-[#64748b] mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="glass-card-static p-4 border border-[#1a56db]/20 flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[260px]">
            <input type="text" placeholder="Search brands by name or description..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="input-field pl-9 pr-8 text-xs w-full" />
            <svg className="w-4 h-4 absolute left-3 top-3 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#64748b]"><strong className="text-white">{filteredBrands.length}</strong> of <strong className="text-white">{brands.length}</strong> brands</span>
            <button onClick={openCreate} className="btn-primary text-xs px-4 py-2 rounded-xl font-bold">+ New Brand</button>
          </div>
        </div>

        {/* Notice */}
        <div className="glass-card-static p-3 border border-[#f59e0b]/20 rounded-xl flex gap-3 items-start">
          <span className="text-[#f59e0b] text-base mt-0.5">ⓘ</span>
          <p className="text-xs text-[#94a3b8] leading-relaxed">
            After creating or editing a brand here, go to <strong className="text-white">Sites &amp; Rooftops</strong> to link it to the relevant dealership rooftop(s). Technicians will only see brands authorized for the site they select.
          </p>
        </div>

        {/* Brands grid */}
        {loading ? (
          <div className="py-16 text-center text-xs text-[#64748b]">Loading OEM brands...</div>
        ) : filteredBrands.length === 0 ? (
          <div className="glass-card-static p-12 text-center border border-[#1a56db]/20">
            <p className="text-sm font-semibold text-white mb-2">No brands found</p>
            <p className="text-xs text-[#64748b]">{searchQuery ? `No brand matched "${searchQuery}".` : 'No brands yet.'}</p>
            {!searchQuery && <button onClick={openCreate} className="btn-primary text-xs px-4 py-2 rounded-xl font-bold mt-4">+ New Brand</button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBrands.map((b) => (
              <div key={b.id} className={`glass-card p-5 border transition-all space-y-3 ${b.isActive === false ? 'border-[#1a56db]/10 opacity-60' : 'border-[#1a56db]/20 hover:border-[#00f0ff]/40'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-extrabold text-white">{b.name}</h3>
                      {b.id === 'brand_byd' && (
                        <span className="px-1.5 py-0.5 rounded bg-[#10b981]/20 text-[#10b981] text-[10px] font-bold">Attachment A</span>
                      )}
                    </div>
                    <p className="text-xs text-[#64748b] mt-0.5 leading-relaxed">{b.description}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${b.isActive === false ? 'bg-red-500/20 text-red-400' : 'bg-[#10b981]/20 text-[#10b981]'}`}>
                    {b.isActive === false ? 'Off' : 'On'}
                  </span>
                </div>

                {b.seedChecklistReference && (
                  <div className="text-[11px] text-[#64748b] bg-[#0b1529] rounded-lg px-3 py-2">
                    <span className="text-[#94a3b8] font-medium">Pack: </span>{b.seedChecklistReference}
                  </div>
                )}

                <div className="flex gap-2 pt-1 border-t border-[#1a56db]/10">
                  <button onClick={() => openEdit(b)} className="flex-1 text-xs py-1.5 rounded-lg font-semibold border border-[#1a56db]/30 text-[#94a3b8] hover:border-[#00f0ff]/50 hover:text-white transition-colors">
                    Edit
                  </button>
                  {b.isActive === false ? (
                    <button onClick={() => handleReactivate(b)} className="flex-1 text-xs py-1.5 rounded-lg font-semibold border border-[#10b981]/30 text-[#10b981] hover:bg-[#10b981]/10 transition-colors">Reactivate</button>
                  ) : (
                    <button onClick={() => handleDeactivate(b)} disabled={deactivating === b.id} className="flex-1 text-xs py-1.5 rounded-lg font-semibold border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">
                      {deactivating === b.id ? '...' : 'Deactivate'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <BrandModal brand={modalBrand} onClose={() => setShowModal(false)} onSaved={handleSaved} />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-xl text-sm font-semibold shadow-xl border ${toast.type === 'success' ? 'bg-[#10b981]/20 border-[#10b981]/40 text-[#10b981]' : 'bg-red-500/20 border-red-500/40 text-red-400'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
