'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '../../../components/header';
import { useToast } from '../../../components/toast';
import { api } from '../../../lib/api';
import { BrandPack } from '../../../lib/types';

export default function BrandPacksPage() {
  const { showToast } = useToast();
  const [packs, setPacks] = useState<BrandPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPack, setSelectedPack] = useState<BrandPack | null>(null);

  useEffect(() => {
    loadPacks();
  }, []);

  async function loadPacks() {
    setLoading(true);
    try {
      const data = await api.getBrandPacks();
      setPacks(data);
      if (data.length > 0) setSelectedPack(data[0]);
    } catch (err) {
      console.error('Failed to load brand packs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleClone(id: string) {
    try {
      const cloned = await api.cloneBrandPackVersion(id);
      showToast(`Created draft v${cloned.version} of ${cloned.name}`, 'success');
      loadPacks();
    } catch (err: any) {
      showToast(err.message || 'Clone failed', 'error');
    }
  }

  async function handlePublish(id: string) {
    try {
      const pub = await api.publishBrandPackVersion(id);
      showToast(`Published v${pub.version} as live OEM evidence pack!`, 'success');
      loadPacks();
    } catch (err: any) {
      showToast(err.message || 'Publish failed', 'error');
    }
  }

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Brand Packs & Rules Engine Admin"
        subtitle="Versioned OEM evidence requirements, BYD Attachment A checklist gates, and fault triggers"
      />

      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Brand Packs Version List */}
          <div className="glass-card-static p-5 border border-[#1a56db]/20 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Configured OEM Packs</h3>
            <div className="space-y-2">
              {packs.map((pack) => {
                const isSelected = selectedPack?.id === pack.id;
                return (
                  <div
                    key={pack.id}
                    onClick={() => setSelectedPack(pack)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1a56db]/30 border-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                        : 'bg-[#081225]/70 border-[#1a56db]/20 hover:border-[#1a56db]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-white text-xs">{pack.name}</p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          pack.status === 'PUBLISHED'
                            ? 'bg-[#10b981]/20 text-[#10b981]'
                            : 'bg-[#f59e0b]/20 text-[#f59e0b]'
                        }`}
                      >
                        v{pack.version} · {pack.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748b] mt-1 line-clamp-1">{pack.description}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1a56db]/10 text-[10px] text-[#00f0ff]">
                      <span>{pack.rules.length} Evidence Rules</span>
                      <span>OEM: {pack.brandName}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Pack Detail & Rules Viewer */}
          <div className="lg:col-span-2 glass-card-static p-6 border border-[#1a56db]/20 space-y-6">
            {selectedPack ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1a56db]/20">
                  <div>
                    <h3 className="text-lg font-black text-white">{selectedPack.name}</h3>
                    <p className="text-xs text-[#cbd5e1]/70 mt-0.5">{selectedPack.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleClone(selectedPack.id)}
                      className="btn-ghost text-xs py-1.5 px-3"
                    >
                      Clone Draft Version
                    </button>
                    {selectedPack.status === 'DRAFT' && (
                      <button
                        onClick={() => handlePublish(selectedPack.id)}
                        className="btn-success text-xs py-1.5 px-3"
                      >
                        Publish Version
                      </button>
                    )}
                  </div>
                </div>

                {/* Rules Table */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#00f0ff] uppercase tracking-wider">
                    Evidence Checklist Gates ({selectedPack.rules.length} Rules)
                  </h4>

                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {selectedPack.rules.map((rule) => (
                      <div
                        key={rule.id}
                        className="p-3.5 rounded-xl bg-[#081225]/80 border border-[#1a56db]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{rule.name}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                                rule.isMandatory
                                  ? 'bg-[#ef4444]/20 text-[#ef4444]'
                                  : 'bg-[#64748b]/20 text-[#cbd5e1]'
                              }`}
                            >
                              {rule.isMandatory ? 'Mandatory' : 'Optional'}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-[#1a56db]/20 text-[#00f0ff] text-[10px] font-mono">
                              Tier {rule.tier}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#cbd5e1]/80">{rule.description}</p>
                          <p className="text-[10px] text-[#64748b] font-mono">
                            OEM File: <strong>{rule.namingConvention}</strong>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="px-2 py-1 rounded bg-[#132952] text-[#00f0ff] font-mono uppercase text-[10px]">
                            {rule.mediaType}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-[#64748b]">Select a brand pack to review rules.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
