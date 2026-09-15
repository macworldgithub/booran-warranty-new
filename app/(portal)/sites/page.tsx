'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Header } from '../../../components/header';
import { api } from '../../../lib/api';
import { Site, Brand } from '../../../lib/types';

/* ─── helpers ─── */
function brandLabel(id: string) {
  return id.replace('brand_', '').toUpperCase();
}

/* ─── Modal ─── */
interface SiteModalProps {
  allBrands: Brand[];
  site: Site | null;
  onClose: () => void;
  onSaved: (s: Site) => void;
}

function SiteModal({ allBrands, site, onClose, onSaved }: SiteModalProps) {
  const isEdit = !!site;
  const [name, setName] = useState(site?.name ?? '');
  const [location, setLocation] = useState(site?.location ?? '');
  const [roPrefix, setRoPrefix] = useState(site?.roPrefix ?? '');
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>(site?.authorizedBrandIds ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleBrand = useCallback((brandId: string) => {
    setSelectedBrandIds((prev) =>
      prev.includes(brandId) ? prev.filter((b) => b !== brandId) : [...prev, brandId],
    );
  }, []);

  const handleSave = async () => {
    if (!name.trim() || !location.trim() || !roPrefix.trim()) {
      setError('Name, location and RO prefix are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let saved: Site;
      if (isEdit && site) {
        saved = await api.updateSite(site.id, { name, location, roPrefix });
        saved = await api.updateSiteBrands(site.id, selectedBrandIds);
      } else {
        saved = await api.createSite({ name, location, roPrefix, authorizedBrandIds: selectedBrandIds });
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
      <div className="glass-card w-full max-w-lg border border-[#1a56db]/40 rounded-2xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-white">{isEdit ? 'Edit Dealership Site' : 'New Dealership Site'}</h2>
            <p className="text-xs text-[#64748b] mt-0.5">{isEdit ? 'Update rooftop details and authorized OEM brands.' : 'Add a new Booran rooftop and link OEM brands to it.'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-[#64748b] hover:text-white hover:bg-white/10 transition-colors">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Site / Rooftop Name <span className="text-red-400">*</span></label>
            <input className="input-field w-full text-sm" placeholder="e.g. Booran BYD Cranbourne" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Location / Address <span className="text-red-400">*</span></label>
            <input className="input-field w-full text-sm" placeholder="e.g. South Gippsland Hwy, Cranbourne VIC" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">RO Prefix <span className="text-red-400">*</span></label>
            <input className="input-field w-full text-sm font-mono" placeholder="e.g. CR-" value={roPrefix} onChange={(e) => setRoPrefix(e.target.value.toUpperCase())} />
            <p className="text-[11px] text-[#64748b] mt-1">Used as prefix for all repair order file names at this site.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-2">
              Authorized OEM Brands
              <span className="ml-2 text-[11px] text-[#64748b] font-normal">(select all that operate at this rooftop)</span>
            </label>
            <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-[#0b1529] border border-[#1a56db]/20 min-h-[48px]">
              {allBrands.length === 0 && <span className="text-xs text-[#64748b]">No brands available — create brands first.</span>}
              {allBrands.map((b) => {
                const active = selectedBrandIds.includes(b.id);
                return (
                  <button key={b.id} type="button" onClick={() => toggleBrand(b.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${active ? 'bg-[#1a56db]/30 border-[#00f0ff] text-[#00f0ff]' : 'bg-[#132952]/50 border-[#1a56db]/20 text-[#64748b] hover:border-[#1a56db]/60 hover:text-[#94a3b8]'}`}>
                    {active && <span className="mr-1">✓</span>}{b.name}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-[#64748b] mt-1">{selectedBrandIds.length} brand{selectedBrandIds.length !== 1 ? 's' : ''} linked</p>
          </div>
        </div>
        {error && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 btn-secondary text-sm py-2 rounded-xl">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary text-sm py-2 px-6 rounded-xl font-bold disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Site'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─── */
export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalSite, setModalSite] = useState<Site | null>(null);
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
        const [s, b] = await Promise.all([api.getSites(), api.getBrands()]);
        setSites(s);
        setAllBrands(b);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredSites = useMemo(() => {
    if (!searchQuery.trim()) return sites;
    const q = searchQuery.toLowerCase().trim();
    return sites.filter((site) => {
      const matchName = site.name?.toLowerCase().includes(q);
      const matchLocation = site.location?.toLowerCase().includes(q);
      const matchPrefix = site.roPrefix?.toLowerCase().includes(q);
      const matchBrand = site.authorizedBrandIds?.some((bid) => bid.toLowerCase().replace('brand_', '').includes(q));
      return matchName || matchLocation || matchPrefix || matchBrand;
    });
  }, [sites, searchQuery]);

  const openCreate = () => { setModalSite(null); setShowModal(true); };
  const openEdit = (site: Site) => { setModalSite(site); setShowModal(true); };

  const handleSaved = (saved: Site) => {
    setSites((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [saved, ...prev];
    });
    setShowModal(false);
    showToast(modalSite ? 'Site updated successfully.' : 'New site created.');
  };

  const handleDeactivate = async (site: Site) => {
    if (!confirm(`Deactivate "${site.name}"? Technicians will no longer see this rooftop.`)) return;
    setDeactivating(site.id);
    try {
      await api.deactivateSite(site.id);
      setSites((prev) => prev.map((s) => (s.id === site.id ? { ...s, isActive: false } : s)));
      showToast(`${site.name} deactivated.`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Deactivate failed', 'error');
    } finally {
      setDeactivating(null);
    }
  };

  const handleReactivate = async (site: Site) => {
    try {
      const updated = await api.updateSite(site.id, { isActive: true });
      setSites((prev) => prev.map((s) => (s.id === site.id ? updated : s)));
      showToast(`${site.name} reactivated.`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Reactivate failed', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header title="Dealership Sites & Rooftops" subtitle="Manage Booran rooftop locations, authorized OEM franchises and RO prefixes" />
      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="glass-card-static p-4 border border-[#1a56db]/20 flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[280px]">
            <input type="text" placeholder="Search by rooftop name, location, prefix (e.g. DAN-), or brand (e.g. BYD, Kia)..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="input-field pl-9 pr-8 text-xs w-full" />
            <svg className="w-4 h-4 absolute left-3 top-3 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#64748b]"><strong className="text-white">{filteredSites.length}</strong> of <strong className="text-white">{sites.length}</strong> rooftops</span>
            <button onClick={openCreate} className="btn-primary text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-2">+ New Site</button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-[#64748b]">Loading dealership sites...</div>
        ) : filteredSites.length === 0 ? (
          <div className="glass-card-static p-12 text-center border border-[#1a56db]/20">
            <div className="max-w-xs mx-auto space-y-3">
              <p className="text-sm font-semibold text-white">No dealership sites found</p>
              <p className="text-xs text-[#64748b]">{searchQuery ? `No rooftop matched "${searchQuery}".` : 'No sites exist yet. Create your first rooftop.'}</p>
              {searchQuery ? (
                <button onClick={() => setSearchQuery('')} className="text-xs font-semibold text-[#00f0ff] hover:underline">Clear search</button>
              ) : (
                <button onClick={openCreate} className="btn-primary text-xs px-4 py-2 rounded-xl font-bold">+ New Site</button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredSites.map((site) => (
              <div key={site.id} className={`glass-card p-6 border transition-all space-y-4 ${site.isActive === false ? 'border-[#1a56db]/10 opacity-60' : 'border-[#1a56db]/20 hover:border-[#00f0ff]/40'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-extrabold text-white truncate">{site.name}</h3>
                    <p className="text-xs text-[#cbd5e1]/70 mt-0.5 truncate">{site.location}</p>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${site.isActive === false ? 'bg-red-500/20 text-red-400' : 'bg-[#10b981]/20 text-[#10b981]'}`}>
                    {site.isActive === false ? 'Inactive' : 'Active'}
                  </span>
                </div>
                <div className="space-y-2 pt-2 border-t border-[#1a56db]/10 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#64748b]">RO Prefix:</span>
                    <strong className="font-mono text-[#00f0ff]">{site.roPrefix}</strong>
                  </div>
                  <div>
                    <span className="text-[#64748b] block mb-1.5">Authorized OEM Brands:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(site.authorizedBrandIds ?? []).length === 0 ? (
                        <span className="text-[#64748b] italic">None linked</span>
                      ) : (
                        (site.authorizedBrandIds ?? []).map((bid) => (
                          <span key={bid} className="px-2 py-0.5 rounded bg-[#132952] text-white font-medium text-[11px]">{brandLabel(bid)}</span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-2 border-t border-[#1a56db]/10">
                  <button onClick={() => openEdit(site)} className="flex-1 text-xs py-1.5 rounded-lg font-semibold border border-[#1a56db]/30 text-[#94a3b8] hover:border-[#00f0ff]/50 hover:text-white transition-colors">
                    ✏️ Edit & Brands
                  </button>
                  {site.isActive === false ? (
                    <button onClick={() => handleReactivate(site)} className="flex-1 text-xs py-1.5 rounded-lg font-semibold border border-[#10b981]/30 text-[#10b981] hover:bg-[#10b981]/10 transition-colors">
                      ↩ Reactivate
                    </button>
                  ) : (
                    <button onClick={() => handleDeactivate(site)} disabled={deactivating === site.id} className="flex-1 text-xs py-1.5 rounded-lg font-semibold border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">
                      {deactivating === site.id ? '...' : 'Deactivate'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <SiteModal allBrands={allBrands.filter((b) => b.isActive !== false)} site={modalSite} onClose={() => setShowModal(false)} onSaved={handleSaved} />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-xl text-sm font-semibold shadow-xl border transition-all ${toast.type === 'success' ? 'bg-[#10b981]/20 border-[#10b981]/40 text-[#10b981]' : 'bg-red-500/20 border-red-500/40 text-red-400'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
