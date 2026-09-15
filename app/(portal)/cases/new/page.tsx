'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '../../../../components/header';
import { useToast } from '../../../../components/toast';
import { api } from '../../../../lib/api';
import { FaultCategory, Site, Brand } from '../../../../lib/types';

export default function NewCaseWizard() {
  const router = useRouter();
  const { showToast } = useToast();

  const [sites, setSites] = useState<Site[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [vinDecoding, setVinDecoding] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // Form State
  const [siteId, setSiteId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [roNumber, setRoNumber] = useState('');
  const [vin, setVin] = useState('');
  const [odometer, setOdometer] = useState<number | ''>('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState<number | ''>('');
  const [powertrain, setPowertrain] = useState<'EV' | 'Hybrid' | 'PHEV' | 'ICE'>('EV');
  const [technicianName, setTechnicianName] = useState('Jake Smith');
  const [concernTitle, setConcernTitle] = useState('');
  const [faultCategory, setFaultCategory] = useState<FaultCategory>('Battery and high-voltage (HV) components');
  const [partReplaced, setPartReplaced] = useState(false);
  const [noiseFault, setNoiseFault] = useState(false);
  const [diagnosticsAvailable, setDiagnosticsAvailable] = useState(true);
  const [repairStage, setRepairStage] = useState<'Pre-repair only' | 'During repair' | 'Repair complete'>('Repair complete');

  // Evaluated Rules
  const [evaluatedRules, setEvaluatedRules] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('booran_user') || localStorage.getItem('booran_user_profile');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          setCurrentUserRole(user.role || '');
          if (user.name) setTechnicianName(user.name);
          if (user.defaultSiteId) setSiteId(user.defaultSiteId);
        } catch {
          // ignore
        }
      }
    }

    async function init() {
      try {
        const [sitesRes, brandsRes] = await Promise.all([api.getSites(), api.getBrands()]);
        setSites(sitesRes);
        setBrands(brandsRes);
        if (sitesRes.length > 0 && !siteId) setSiteId(sitesRes[0].id);
        if (brandsRes.length > 0) setBrandId(brandsRes[0].id);
      } catch (err) {
        console.error('Failed to load sites/brands:', err);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (brandId && faultCategory) {
      evaluateDynamicRules();
    }
  }, [brandId, faultCategory, partReplaced, noiseFault, diagnosticsAvailable, repairStage]);

  async function evaluateDynamicRules() {
    try {
      const res = await api.evaluateRules({
        brandId: brandId || 'brand_byd',
        faultCategory,
        partReplaced,
        noiseFault,
        diagnosticsAvailable,
        repairStage,
      });
      setEvaluatedRules(res);
    } catch (err) {
      console.error('Rules engine evaluation error:', err);
    }
  }

  async function handleDecodeVin() {
    if (!vin || vin.length !== 17) {
      showToast('VIN must be exactly 17 characters', 'error');
      return;
    }
    setVinDecoding(true);
    try {
      const decoded = await api.decodeVin(vin);
      setMake(decoded.make);
      setModel(decoded.model);
      setYear(decoded.year);
      setPowertrain(decoded.powertrain);
      showToast(`Decoded: ${decoded.year} ${decoded.make} ${decoded.model} (${decoded.powertrain}) via ${decoded.provider}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'VIN decode failed', 'error');
    } finally {
      setVinDecoding(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (currentUserRole !== 'TECHNICIAN') {
      showToast('Permission denied: Only technicians are authorized to raise warranty tickets.', 'error');
      return;
    }

    setLoading(true);

    try {
      const created = await api.createCase({
        siteId: siteId || (sites[0]?.id || 'site_cranbourne_byd'),
        brandId: brandId || (brands[0]?.id || 'brand_byd'),
        roNumber,
        vin,
        odometer: Number(odometer),
        make,
        model,
        year: Number(year),
        powertrain,
        technicianId: 'tech_' + technicianName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        technicianName,
        concernTitle,
        faultCategory,
        partReplaced,
        noiseFault,
        diagnosticsAvailable,
        repairStage,
        creatorRole: currentUserRole || undefined,
      });

      showToast(`Warranty Case ${created.roNumber} initialized with ${evaluatedRules?.mandatoryCount || 8} mandatory gates!`, 'success');
      router.push(`/cases/${created.id}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to create warranty ticket', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (currentUserRole && currentUserRole !== 'TECHNICIAN') {
    return (
      <div className="flex-1 flex flex-col pb-12 bg-[#F8FAFC]">
        <Header
          title="New Warranty RO Evidence Capture"
          subtitle="Start a guided technician evidence ticket with auto-evaluated OEM rules & Attachment A gates"
        />
        <div className="p-8 max-w-2xl mx-auto w-full mt-8">
          <div className="p-8 border border-amber-200 rounded-2xl bg-white text-center space-y-6 shadow-sm">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 tracking-wide">Technician Role Required</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Warranty tickets can only be raised and captured by workshop technicians. As an Administrator, your account has review, audit, flagging, and submission permissions in the Warranty Review Queue.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-4">
              <button
                type="button"
                onClick={() => router.push('/cases')}
                className="py-2.5 px-6 text-xs font-bold rounded-xl bg-[#E11F26] hover:bg-[#c81a20] text-white flex items-center gap-2 shadow-sm cursor-pointer transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Go to Warranty Cases Queue</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pb-12 bg-[#F8FAFC]">
      <Header
        title="New Warranty RO Evidence Capture"
        subtitle="Start a guided technician evidence ticket with auto-evaluated OEM rules & Attachment A gates"
      />

      <div className="p-6 sm:p-8 max-w-4xl mx-auto w-full">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Rooftop & Brand */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-red-50 text-[#E11F26] border border-red-200 flex items-center justify-center text-xs font-bold">1</span>
              Dealership Rooftop & OEM Roster
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Dealership Site</label>
                <select
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-[#E11F26] focus:outline-none transition-all"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.roPrefix})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">OEM Brand</label>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-[#E11F26] focus:outline-none transition-all"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} — {b.seedChecklistReference}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Step 2: Vehicle & Identification Fast-Path */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-red-50 text-[#E11F26] border border-red-200 flex items-center justify-center text-xs font-bold">2</span>
              Vehicle Identification & RedBooks VIN Decoder
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Repair Order (RO) #</label>
                <input
                  type="text"
                  required
                  value={roNumber}
                  onChange={(e) => setRoNumber(e.target.value)}
                  placeholder="e.g. CR-95260"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#E11F26] focus:outline-none transition-all"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">17-Digit Vehicle VIN</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    maxLength={17}
                    value={vin}
                    onChange={(e) => setVin(e.target.value.toUpperCase())}
                    placeholder="e.g. LGXCE4C86P0019283"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase tracking-wider text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#E11F26] focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleDecodeVin}
                    disabled={vinDecoding}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-bold whitespace-nowrap transition-all cursor-pointer"
                  >
                    {vinDecoding ? 'Decoding...' : 'Decode VIN'}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Make</label>
                <input
                  type="text"
                  required
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  placeholder="e.g. BYD"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#E11F26] focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Model</label>
                <input
                  type="text"
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. ATTO 3 Extended"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#E11F26] focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Year</label>
                <input
                  type="number"
                  required
                  value={year === '' ? '' : year}
                  onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 2024"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#E11F26] focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Odometer (km)</label>
                <input
                  type="number"
                  required
                  value={odometer === '' ? '' : odometer}
                  onChange={(e) => setOdometer(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 14250"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#E11F26] focus:outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Fault Category & Dynamic Evidence Requirements */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-red-50 text-[#E11F26] border border-red-200 flex items-center justify-center text-xs font-bold">3</span>
              Fault Classification & Attachment A Gate Resolver
            </h3>
            
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Fault Category (Attachment A)</label>
              <select
                value={faultCategory}
                onChange={(e) => setFaultCategory(e.target.value as FaultCategory)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-[#E11F26] focus:outline-none transition-all"
              >
                <option value="Oil leaks or seepage">Oil leaks or seepage</option>
                <option value="ECU or sensor internal faults">ECU or sensor internal faults</option>
                <option value="Software updates or program refreshes">Software updates or program refreshes</option>
                <option value="Battery and high-voltage (HV) components">Battery and high-voltage (HV) components</option>
                <option value="Charging system faults">Charging system faults</option>
                <option value="Powertrain, chassis or body component faults">Powertrain, chassis or body component faults</option>
                <option value="General / other (Tier 1 only)">General / other (Tier 1 only)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Technician Stated Concern</label>
              <textarea
                rows={2}
                required
                value={concernTitle}
                onChange={(e) => setConcernTitle(e.target.value)}
                placeholder="Describe customer complaint & workshop findings..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#E11F26] focus:outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={partReplaced}
                  onChange={(e) => setPartReplaced(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#E11F26] focus:ring-[#E11F26]"
                />
                <span>Part Replaced?</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={noiseFault}
                  onChange={(e) => setNoiseFault(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#E11F26] focus:ring-[#E11F26]"
                />
                <span>Noise/Audio Fault?</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={diagnosticsAvailable}
                  onChange={(e) => setDiagnosticsAvailable(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#E11F26] focus:ring-[#E11F26]"
                />
                <span>DTC Scan Available?</span>
              </label>
            </div>

            {/* Dynamic Rule Preview Output - Dealership Showcase Clean White & Red Style */}
            {evaluatedRules && (
              <div className="mt-4 p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#E11F26]" />
                    <span className="text-xs font-extrabold text-slate-900">
                      {evaluatedRules.packName || 'Resolved Evidence Pack'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-0.5 rounded-full bg-red-50 text-[#E11F26] border border-red-200 text-[10px] font-bold">
                      {evaluatedRules.mandatoryCount || 0} Mandatory Gates
                    </span>
                    {evaluatedRules.optionalCount > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-medium">
                        {evaluatedRules.optionalCount} Optional
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {Array.isArray(evaluatedRules.resolvedRules) && evaluatedRules.resolvedRules.map((rule: any, idx: number) => {
                    const ruleName = typeof rule === 'string' ? rule : (rule.name || rule.ruleKey || `Rule ${idx + 1}`);
                    const isMandatory = typeof rule === 'object' ? rule.isMandatory !== false : true;
                    const mediaType = typeof rule === 'object' ? (rule.mediaType || 'image') : 'image';
                    const guidance = typeof rule === 'object' ? rule.guidanceText : null;

                    return (
                      <div
                        key={typeof rule === 'object' ? (rule.id || rule.ruleKey || idx) : idx}
                        className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-xs font-extrabold text-slate-900 truncate">{ruleName}</span>
                          <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                            isMandatory ? 'bg-red-50 text-[#E11F26] border border-red-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {isMandatory ? 'Required' : 'Optional'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-100">
                          <span className="capitalize font-semibold text-slate-700">{mediaType}</span>
                          {guidance && <span className="text-slate-400 truncate max-w-[170px]">{guidance}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 rounded-xl bg-[#E11F26] hover:bg-[#c81a20] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              {loading ? 'Initializing Ticket...' : 'Create Ticket & Launch Evidence Capture →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
