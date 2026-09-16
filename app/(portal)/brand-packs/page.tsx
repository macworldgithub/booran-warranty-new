'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Header } from '../../../components/header';
import { Modal } from '../../../components/modal';
import { StatusBadge } from '../../../components/status-badge';
import { AddBrandRuleModal } from '../../../components/add-brand-rule-modal';
import { useToast } from '../../../components/toast';
import { api } from '../../../lib/api';
import { BrandPack, BrandPackRule, FaultCategory, WarrantyCase } from '../../../lib/types';

const FAULT_CATEGORIES: FaultCategory[] = [
  'Battery and high-voltage (HV) components',
  'Powertrain, chassis or body component faults',
  'Charging system faults',
  'Oil leaks or seepage',
  'ECU or sensor internal faults',
  'Software updates or program refreshes',
  'General / other (Tier 1 only)',
];

interface BenchmarkInfo {
  sampleImage: string;
  goodTip: string;
  badTip: string;
  specStandard: string;
}

const RULE_BENCHMARKS: Record<string, BenchmarkInfo> = {
  vin_photo: {
    sampleImage: '/benchmarks/vin_photo.jpg',
    goodTip: 'All 17 characters pin-sharp. B-pillar aluminum plate or windscreen barcode filling 60%+ frame with no reflection.',
    badTip: 'Flash reflection washing out characters, thumb blocking barcode, or angled camera distortion.',
    specStandard: 'BYD-WB-2602-02 §4.1 · B-Pillar / VDS Identification',
  },
  odometer_photo: {
    sampleImage: '/benchmarks/odometer_photo.jpg',
    goodTip: 'Instrument cluster in READY / IGNITION ON mode. Both EV state-of-charge and total ODO mileage clearly readable.',
    badTip: 'Steering wheel rim blocking digits or unlit dashboard cluster.',
    specStandard: 'BYD-WB-2602-02 §4.2 · Mileage & Warranty Verification',
  },
  front_vehicle_photo: {
    sampleImage: '/benchmarks/front_vehicle_photo.jpg',
    goodTip: 'Complete 3/4 front view showing front fascia, headlights, rego plate, and workshop context.',
    badTip: 'Cropped bumper, missing registration plate, or dark unlit workshop bay.',
    specStandard: 'BYD-WB-2602-02 §4.3 · Vehicle Overview Reference',
  },
  fault_closeup: {
    sampleImage: '/benchmarks/fault_closeup.jpg',
    goodTip: 'Defect fills 70%+ of frame with workshop torch angled at 45° to illuminate micro-cracks/leaks.',
    badTip: 'Camera autofocus hunting onto background or greasy lens blur obscuring the crack.',
    specStandard: 'BYD-WB-2602-02 §4.4 · Macro Defect Standard',
  },
  fault_location: {
    sampleImage: '/benchmarks/fault_location.jpg',
    goodTip: 'Medium contextual shot showing where the failed part sits relative to the subframe / engine.',
    badTip: 'Shot too tight to identify which side of the vehicle or corner of the suspension.',
    specStandard: 'BYD-WB-2602-02 §4.5 · Component Context & Orientation',
  },
  old_part_serial: {
    sampleImage: '/benchmarks/old_part_serial.jpg',
    goodTip: 'Removed defective part on workbench showing both stamped alphanumeric serial and 2D QR matrix.',
    badTip: 'Grease obscuring QR code or unreadable stamped dot-matrix serial.',
    specStandard: 'BYD-WB-2602-02 §5.1 · Defective Part Serial Audit',
  },
  new_part_serial: {
    sampleImage: '/benchmarks/new_part_serial.jpg',
    goodTip: 'Genuine OEM replacement box label with sealed holographic sticker, part number, and clean new part.',
    badTip: 'Torn packaging label, missing part number, or aftermarket unapproved component.',
    specStandard: 'BYD-WB-2602-02 §5.2 · Genuine Replacement Verification',
  },
  diagnostic_evidence: {
    sampleImage: '/benchmarks/diagnostic_evidence.jpg',
    goodTip: 'VDS scanner tablet screenshot displaying active DTC fault code, freeze-frame, and ECU pass indicators.',
    badTip: 'Screen glare obscuring fault codes or generic aftermarket scanner app.',
    specStandard: 'BYD-WB-2602-02 §5.3 · VDS Diagnostic Freeze-Frame',
  },
  video_before: {
    sampleImage: '/benchmarks/video_before.jpg',
    goodTip: 'Steady 15–30s recording capturing sound source with clear workshop audio and torch illumination.',
    badTip: 'Loud background air-tools drowning out vehicle noise, or clip under 5 seconds.',
    specStandard: 'BYD-WB-2602-02 §5.4 · Noise & Operational Malfunction',
  },
  after_repair_photo: {
    sampleImage: '/benchmarks/after_repair_photo.jpg',
    goodTip: 'New part torqued and clean. Yellow torque witness marks visible on fasteners at identical angle.',
    badTip: 'Missing torque witness marks, dirty oil residue left behind, or loose wiring clips.',
    specStandard: 'BYD-WB-2602-02 §5.5 · Completed Reassembly Sign-off',
  },
  hv_safety_isolation: {
    sampleImage: '/benchmarks/hv_safety_isolation.jpg',
    goodTip: 'Manual Service Disconnect (MSD) pulled with master technician padlock lockout tag in place.',
    badTip: 'Unconfirmed isolation or missing lock-out tag on high voltage battery pack.',
    specStandard: 'BYD-WB-2602-02 Annex 2 · High Voltage Isolation Protocol',
  },
  tier2_hv_isolation: {
    sampleImage: '/benchmarks/hv_safety_isolation.jpg',
    goodTip: 'Manual Service Disconnect (MSD) pulled with master technician padlock lockout tag in place.',
    badTip: 'Unconfirmed isolation or missing lock-out tag on high voltage battery pack.',
    specStandard: 'BYD-WB-2602-02 Annex 2 · High Voltage Isolation Protocol',
  },
  hv_battery_serial: {
    sampleImage: '/benchmarks/old_part_serial.jpg',
    goodTip: 'Laser-etched pack serial barcode on underside of traction battery tray.',
    badTip: 'Underbody road grime obscuring barcode characters.',
    specStandard: 'BYD-WB-2602-02 §6.1 · HV Traction Battery Traceability',
  },
  tier2_hv_battery_serial: {
    sampleImage: '/benchmarks/old_part_serial.jpg',
    goodTip: 'Laser-etched pack serial barcode on underside of traction battery tray.',
    badTip: 'Underbody road grime obscuring barcode characters.',
    specStandard: 'BYD-WB-2602-02 §6.1 · HV Traction Battery Traceability',
  },
};

const DEFAULT_BENCHMARK: BenchmarkInfo = {
  sampleImage: '/benchmarks/fault_closeup.jpg',
  goodTip: 'High illumination, crisp focal point, genuine part number and defect clearly documented.',
  badTip: 'Blurry lens, dark lighting, or missing defect reference point.',
  specStandard: 'Booran Tier 1 Standard Evidence Protocol §2.0',
};

export default function BrandPacksPage() {
  const { showToast } = useToast();
  const [packs, setPacks] = useState<BrandPack[]>([]);
  const [cases, setCases] = useState<WarrantyCase[]>([]);
  const [selectedPack, setSelectedPack] = useState<BrandPack | null>(null);
  const [loading, setLoading] = useState(true);

  // Search & Filter State for Packs List
  const [packSearchQuery, setPackSearchQuery] = useState('');
  const [packBrandFilter, setPackBrandFilter] = useState('ALL');

  // Filter State for Active Pack Rules
  const [ruleTierTab, setRuleTierTab] = useState<'ALL' | 'TIER_1' | 'TIER_2'>('ALL');
  const [mandatoryOnly, setMandatoryOnly] = useState(false);
  const [ruleSearch, setRuleSearch] = useState('');

  // Interactive Action Modal State
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [activeActionRule, setActiveActionRule] = useState<BrandPackRule | null>(null);
  const [actionTab, setActionTab] = useState<'SAMPLE_BENCHMARK' | 'RESOLVE_CASES'>('SAMPLE_BENCHMARK');

  // Copy Feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Add Rule / Import CSV Modal State
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [ruleModalMode, setRuleModalMode] = useState<'MANUAL' | 'IMPORT'>('MANUAL');

  // Interactive Mobile Technician Simulator Modal State
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simRoNumber, setSimRoNumber] = useState('RO-10482');
  const [simFaultCategory, setSimFaultCategory] = useState<FaultCategory>(
    'Battery and high-voltage (HV) components'
  );
  const [simPartReplaced, setSimPartReplaced] = useState(true);
  const [simNoiseFault, setSimNoiseFault] = useState(false);
  const [simDiagnosticsAvailable, setSimDiagnosticsAvailable] = useState(true);
  const [simRepairStage, setSimRepairStage] = useState<'DIAGNOSTIC' | 'IN_PROGRESS' | 'REPAIR_COMPLETE'>('DIAGNOSTIC');

  const loadData = async () => {
    try {
      setLoading(true);
      const [packsData, casesData] = await Promise.all([
        api.getBrandPacks(),
        api.getWarrantyCases({ limit: 100 }),
      ]);

      setPacks(packsData);
      setCases(casesData.data || (casesData as any));

      if (packsData.length > 0) {
        if (!selectedPack) {
          const published = packsData.find((p: BrandPack) => p.status === 'PUBLISHED') || packsData[0];
          setSelectedPack(published);
        } else {
          const current = packsData.find((p: BrandPack) => p.id === selectedPack.id) || packsData[0];
          setSelectedPack(current);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load brand packs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePublish = async (packId: string) => {
    try {
      await api.publishBrandPackVersion(packId);
      showToast('Brand pack version published successfully!', 'success');
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to publish brand pack', 'error');
    }
  };

  const handleClone = async (packId: string) => {
    try {
      const cloned = await api.cloneBrandPackVersion(packId);
      showToast(`Created new draft v${cloned.version}!`, 'success');
      await loadData();
      setSelectedPack(cloned);
    } catch (err: any) {
      showToast(err.message || 'Failed to clone brand pack', 'error');
    }
  };

  const handleOpenRuleAction = (rule: BrandPackRule, defaultTab: 'SAMPLE_BENCHMARK' | 'RESOLVE_CASES' = 'SAMPLE_BENCHMARK') => {
    setActiveActionRule(rule);
    setActionTab(defaultTab);
    setActionModalOpen(true);
  };

  const handleCopyFilename = (ruleKey: string, convention: string) => {
    const example = `RO10482_${convention.replace('[DealerRONumber]', '')}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(example);
      setCopiedKey(ruleKey);
      setTimeout(() => setCopiedKey(null), 2000);
      showToast(`Copied filename to clipboard: ${example}`, 'info');
    }
  };

  const handleOpenPdf = (dataUrlOrUrl: string) => {
    try {
      if (dataUrlOrUrl.startsWith('data:')) {
        const arr = dataUrlOrUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/pdf';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
      } else {
        window.open(dataUrlOrUrl, '_blank');
      }
    } catch (e) {
      console.error('Failed to open PDF:', e);
      showToast('Could not open PDF in new tab.', 'error');
    }
  };

  const handleDownloadMedia = (dataUrlOrUrl: string, fileName: string) => {
    try {
      const link = document.createElement('a');
      if (dataUrlOrUrl.startsWith('data:')) {
        const arr = dataUrlOrUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        link.href = URL.createObjectURL(blob);
      } else {
        link.href = dataUrlOrUrl;
      }
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Failed to download media:', e);
      showToast('Download failed', 'error');
    }
  };

  const getBenchmarkForRule = (ruleKey: string, exampleImageUrl?: string): BenchmarkInfo => {
    const base = RULE_BENCHMARKS[ruleKey] || DEFAULT_BENCHMARK;
    if (exampleImageUrl) {
      return {
        ...base,
        sampleImage: exampleImageUrl,
      };
    }
    return base;
  };

  const uniqueBrands = useMemo(() => {
    const brands = new Set<string>();
    packs.forEach((p) => {
      if (p.brandName) brands.add(p.brandName);
    });
    return Array.from(brands);
  }, [packs]);

  const filteredPacks = useMemo(() => {
    return packs.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(packSearchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(packSearchQuery.toLowerCase())) ||
        (p.brandName && p.brandName.toLowerCase().includes(packSearchQuery.toLowerCase()));

      const matchesBrand =
        packBrandFilter === 'ALL' || (p.brandName && p.brandName.toUpperCase() === packBrandFilter.toUpperCase());

      return matchesSearch && matchesBrand;
    });
  }, [packs, packSearchQuery, packBrandFilter]);

  const filteredRules = useMemo(() => {
    if (!selectedPack) return [];
    let list = [...selectedPack.rules];

    if (ruleTierTab === 'TIER_1') {
      list = list.filter((r) => r.tier === 1);
    } else if (ruleTierTab === 'TIER_2') {
      list = list.filter((r) => r.tier === 2);
    }

    if (mandatoryOnly) {
      list = list.filter((r) => r.isMandatory);
    }

    if (ruleSearch.trim()) {
      const q = ruleSearch.toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.namingConvention.toLowerCase().includes(q) ||
          r.ruleKey.toLowerCase().includes(q)
      );
    }

    return list;
  }, [selectedPack, ruleTierTab, mandatoryOnly, ruleSearch]);

  const isRuleKeyMatch = (packRuleKey: string, targetKey?: string | null) => {
    if (!packRuleKey || !targetKey) return false;
    if (packRuleKey === targetKey) return true;
    const p = packRuleKey.toLowerCase();
    const t = targetKey.toLowerCase();
    if (p === t) return true;
    if ((p.includes('video') || p.includes('noise')) && (t.includes('video') || t.includes('noise'))) return true;
    if ((p.includes('diagnostic') || p.includes('dtc')) && (t.includes('diagnostic') || t.includes('dtc'))) return true;
    if (p.includes('hv_isolation') && t.includes('hv_isolation')) return true;
    if (p.includes('hv_serial') && t.includes('hv_serial')) return true;
    return false;
  };

  const getCasesFlaggedForRule = (ruleKey: string) => {
    return cases.filter((c) => {
      const flags = c.flagHistory || c.flags || [];
      return flags.some((f) => !f.resolvedAt && isRuleKeyMatch(ruleKey, f.evidenceRuleKey));
    });
  };

  const getCasesRequiringRule = (ruleKey: string) => {
    const flagged = getCasesFlaggedForRule(ruleKey);
    if (flagged.length > 0) return flagged;

    return cases.filter(
      (c) =>
        (c.status === 'Draft' || c.status === 'Awaiting Review' || c.status === 'Flagged') &&
        (!selectedPack?.brandId || c.brandId === selectedPack.brandId || c.brandName === selectedPack.brandName)
    );
  };

  const simulatedGates = useMemo(() => {
    if (!selectedPack) return [];
    const resolved: BrandPackRule[] = [];

    for (const rule of selectedPack.rules) {
      if (
        ['vin_photo', 'odometer_photo', 'front_vehicle_photo', 'fault_closeup', 'fault_location'].includes(
          rule.ruleKey
        )
      ) {
        resolved.push(rule);
        continue;
      }

      if (['old_part_serial', 'new_part_serial'].includes(rule.ruleKey)) {
        if (simPartReplaced) resolved.push(rule);
        continue;
      }

      if (rule.ruleKey === 'diagnostic_evidence') {
        if (simDiagnosticsAvailable) resolved.push(rule);
        continue;
      }

      if (rule.ruleKey === 'video_before') {
        if (simNoiseFault) resolved.push(rule);
        continue;
      }

      if (rule.ruleKey === 'after_repair_photo') {
        if (simRepairStage === 'REPAIR_COMPLETE') resolved.push(rule);
        continue;
      }

      if (rule.faultCategorySpecific && rule.faultCategorySpecific.length > 0) {
        if (
          rule.faultCategorySpecific.includes(simFaultCategory) ||
          (simFaultCategory.includes('Battery') && rule.faultCategorySpecific.some((c) => c.includes('Battery') || c.includes('HV')))
        ) {
          resolved.push(rule);
        }
        continue;
      }

      resolved.push(rule);
    }

    return resolved;
  }, [
    selectedPack,
    simFaultCategory,
    simPartReplaced,
    simNoiseFault,
    simDiagnosticsAvailable,
    simRepairStage,
  ]);

  const simulatedMandatoryGates = simulatedGates.filter((r) => r.isMandatory);

  return (
    <div className="flex-1 flex flex-col pb-12 bg-[#F8FAFC]">
      <Header
        title="Brand Packs & Rules Engine Admin"
        subtitle="Versioned OEM evidence requirements, BYD Attachment A checklist gates, and official photo benchmarks"
      />

      <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Info Banner / Quick Stats - Clean White Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800">
              <svg className="w-5 h-5 text-[#E11F26]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Configured OEM Packs</p>
              <p className="text-xl font-extrabold text-slate-900">{packs.length}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Published Live Packs</p>
              <p className="text-xl font-extrabold text-emerald-600">
                {packs.filter((p) => p.status === 'PUBLISHED').length}
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Draft Staging Packs</p>
              <p className="text-xl font-extrabold text-amber-600">
                {packs.filter((p) => p.status === 'DRAFT').length}
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-[#E11F26]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Active Flagged Cases</p>
              <p className="text-xl font-extrabold text-[#E11F26]">
                {cases.filter((c) => c.status === 'Flagged').length}
              </p>
            </div>
          </div>
        </div>

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Brand Packs Version List */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col h-fit">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E11F26]"></span>
                OEM Evidence Packs
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                {filteredPacks.length} available
              </span>
            </div>

            {/* Search Packs Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search brand packs..."
                value={packSearchQuery}
                onChange={(e) => setPackSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 text-xs py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#E11F26] focus:bg-white transition-all"
              />
              <svg
                className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {packSearchQuery && (
                <button
                  onClick={() => setPackSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                  title="Clear pack search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Brand Filter Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                onClick={() => setPackBrandFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  packBrandFilter === 'ALL'
                    ? 'bg-[#E11F26] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                All Brands
              </button>
              {uniqueBrands.map((b) => (
                <button
                  key={b}
                  onClick={() => setPackBrandFilter(b)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    packBrandFilter === b
                      ? 'bg-[#E11F26] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>

            {/* Packs Scrollable List */}
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {loading ? (
                <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
                  Loading OEM evidence packs...
                </div>
              ) : filteredPacks.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl space-y-2">
                  <p>No brand packs found.</p>
                  {(packSearchQuery || packBrandFilter !== 'ALL') && (
                    <button
                      onClick={() => {
                        setPackSearchQuery('');
                        setPackBrandFilter('ALL');
                      }}
                      className="text-[#E11F26] hover:underline font-bold text-[11px]"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              ) : (
                filteredPacks.map((pack) => {
                  const isSelected = selectedPack?.id === pack.id;
                  const isPublished = pack.status === 'PUBLISHED';
                  const tier1Count = pack.rules.filter((r) => r.tier === 1).length;
                  const tier2Count = pack.rules.length - tier1Count;

                  return (
                    <div
                      key={pack.id}
                      onClick={() => setSelectedPack(pack)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-red-50/50 border-[#E11F26] shadow-sm ring-1 ring-[#E11F26]'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-extrabold text-slate-900 text-xs leading-snug">{pack.name}</p>
                          <span className="text-[10px] font-mono text-[#E11F26] font-bold uppercase tracking-wider">
                            OEM: {pack.brandName || 'General'}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 uppercase tracking-wide flex items-center gap-1 ${
                            isPublished
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isPublished ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          ></span>
                          v{pack.version} · {pack.status}
                        </span>
                      </div>

                      {pack.description && (
                        <p className="text-[11px] text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                          {pack.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[10px]">
                        <span className="text-slate-700 font-semibold">
                          {pack.rules.length} Total Rules
                        </span>
                        <span className="text-slate-500 font-mono">
                          T1: {tier1Count} · T2: {tier2Count}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Pack Detail & Rules Viewer */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            {selectedPack ? (
              <>
                {/* Pack Header & Top Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-lg font-black text-slate-900">{selectedPack.name}</h2>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          selectedPack.status === 'PUBLISHED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        v{selectedPack.version} · {selectedPack.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 max-w-2xl">{selectedPack.description}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* Add Brand Rule & Spreadsheet Import Trigger */}
                    <button
                      onClick={() => {
                        setRuleModalMode('MANUAL');
                        setRuleModalOpen(true);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[#E11F26] hover:bg-[#c81a20] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>➕ Add Rule</span>
                    </button>
                    <button
                      onClick={() => {
                        setRuleModalMode('IMPORT');
                        setRuleModalOpen(true);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 hover:border-[#E11F26] hover:text-[#E11F26] text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>📁 Import CSV / Excel</span>
                    </button>

                    {/* Live Mobile Simulator Trigger */}
                    <button
                      onClick={() => setIsSimulatorOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-[#E11F26]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      📱 Mobile Simulator
                    </button>

                    <button
                      onClick={() => handleClone(selectedPack.id)}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                      title="Duplicate this configuration to test new rules safely"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Clone Draft
                    </button>

                    {selectedPack.status === 'DRAFT' && (
                      <button
                        onClick={() => handlePublish(selectedPack.id)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                        title="Promote this draft to the live workshop standard"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Publish Version
                      </button>
                    )}
                  </div>
                </div>

                {/* Staging Notice for Drafts */}
                {selectedPack.status === 'DRAFT' && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-800">
                    <svg className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="font-bold">Draft Staging Mode</p>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        Technicians on the workshop floor will continue using the currently published
                        standard until you click <strong>Publish Version</strong>.
                      </p>
                    </div>
                  </div>
                )}

                {/* Rules Filter Bar & Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  {/* Tier Tabs */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                    <button
                      onClick={() => setRuleTierTab('ALL')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                        ruleTierTab === 'ALL'
                          ? 'bg-[#E11F26] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All Rules ({selectedPack.rules.length})
                    </button>
                    <button
                      onClick={() => setRuleTierTab('TIER_1')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                        ruleTierTab === 'TIER_1'
                          ? 'bg-[#E11F26] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tier 1 Core ({selectedPack.rules.filter((r) => r.tier === 1).length})
                    </button>
                    <button
                      onClick={() => setRuleTierTab('TIER_2')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                        ruleTierTab === 'TIER_2'
                          ? 'bg-[#E11F26] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tier 2 Triggers ({selectedPack.rules.filter((r) => r.tier === 2).length})
                    </button>
                  </div>

                  {/* Search and Mandatory Toggle */}
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={mandatoryOnly}
                        onChange={(e) => setMandatoryOnly(e.target.checked)}
                        className="rounded border-slate-300 text-[#E11F26] focus:ring-[#E11F26]"
                      />
                      <span>Mandatory only</span>
                    </label>

                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search rules / files..."
                        value={ruleSearch}
                        onChange={(e) => setRuleSearch(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#E11F26] focus:bg-white w-44 transition-all"
                      />
                      {ruleSearch && (
                        <button
                          onClick={() => setRuleSearch('')}
                          className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Evidence Rules Checklist Cards with Real Photo Benchmark Previews */}
                <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                  {filteredRules.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
                      No rules matched your search or tier filter.
                    </div>
                  ) : (
                    filteredRules.map((rule) => {
                      const isMandatory = rule.isMandatory;
                      const isTier1 = rule.tier === 1;
                      const isVideo = rule.mediaType === 'video';
                      const isBarcode = rule.ruleKey.includes('serial') || rule.ruleKey.includes('barcode');
                      const isDiagnostic = rule.ruleKey.includes('diagnostic');
                      const flaggedCases = getCasesFlaggedForRule(rule.ruleKey);
                      const benchmark = getBenchmarkForRule(rule.ruleKey, rule.exampleImageUrl);

                      return (
                        <div
                          key={rule.id}
                          onClick={() => handleOpenRuleAction(rule, 'SAMPLE_BENCHMARK')}
                          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all space-y-3 group relative cursor-pointer"
                        >
                          {/* Top Row: Title, Badges, and Thumbnail */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-slate-900 text-xs group-hover:text-[#E11F26] transition-colors">
                                  {rule.name}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    isMandatory
                                      ? 'bg-red-50 text-[#E11F26] border border-red-200'
                                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}
                                >
                                  {isMandatory ? 'Mandatory Gate' : 'Optional'}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                                    isTier1
                                      ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                      : 'bg-purple-50 text-purple-700 border border-purple-200'
                                  }`}
                                >
                                  {isTier1 ? 'Tier 1 Core' : 'Tier 2 Defect Gate'}
                                </span>

                                {/* Flagged Cases Alert Chip */}
                                {flaggedCases.length > 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-[#E11F26] text-white text-[10px] font-bold flex items-center gap-1 animate-pulse">
                                    <span>⚠️</span>
                                    <span>{flaggedCases.length} Flagged</span>
                                  </span>
                                )}
                              </div>

                              {/* Description */}
                              <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                                {rule.description}
                              </p>
                            </div>

                            {/* Benchmark Thumbnail Image Preview */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenRuleAction(rule, 'SAMPLE_BENCHMARK');
                              }}
                              className="w-24 h-16 rounded-xl overflow-hidden border border-slate-200 group-hover:border-[#E11F26] shrink-0 relative shadow-sm group/thumb"
                              title="Click to inspect full OEM reference benchmark"
                            >
                              {rule.mediaType === 'document' || (rule.exampleImageUrl && (rule.exampleImageUrl.startsWith('data:application/pdf') || rule.exampleImageUrl.includes('.pdf'))) ? (
                                <div className="w-full h-full bg-red-50 text-[#E11F26] flex flex-col items-center justify-center font-bold text-[10px]">
                                  <span>📄</span>
                                  <span>PDF SPEC</span>
                                </div>
                              ) : rule.mediaType === 'video' ? (
                                <div className="w-full h-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px]">
                                  ▶ Video
                                </div>
                              ) : (
                                <img
                                  src={benchmark.sampleImage}
                                  alt={rule.name}
                                  className="w-full h-full object-contain p-1 bg-slate-50 group-hover/thumb:scale-105 transition-transform duration-300"
                                />
                              )}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-bold">
                                View 🔍
                              </div>
                            </div>
                          </div>

                          {/* Viewfinder Camera Guidance Overlay Callout */}
                          {rule.guidanceText && (
                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-[11px] text-slate-700">
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 shrink-0 text-[#E11F26]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <span>
                                  <strong className="text-slate-900">Viewfinder HUD:</strong> {rule.guidanceText}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500 font-bold group-hover:text-[#E11F26] shrink-0">
                                View Benchmark Sample ➔
                              </span>
                            </div>
                          )}

                          {/* OEM File Naming + Media Badge + Dynamic Trigger Indicators */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[10px]">
                            <div className="flex items-center gap-2 flex-wrap font-mono">
                              <span className="text-slate-500">OEM File:</span>
                              <span className="text-slate-800 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {rule.namingConvention}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyFilename(rule.ruleKey, rule.namingConvention);
                                }}
                                className="text-[#E11F26] hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                                title="Copy example filename"
                              >
                                <span>Example: RO10482_{rule.namingConvention.replace('[DealerRONumber]', '')}</span>
                                <span className="text-[9px] bg-red-50 text-[#E11F26] border border-red-200 px-1 py-0.2 rounded font-bold">
                                  {copiedKey === rule.ruleKey ? 'Copied!' : 'Copy'}
                                </span>
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Trigger Logic Indicator */}
                              {['old_part_serial', 'new_part_serial'].includes(rule.ruleKey) && (
                                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                                  ⚡ Trigger: Part Replaced
                                </span>
                              )}
                              {rule.ruleKey === 'video_before' && (
                                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                                  ⚡ Trigger: Noise / Rattle
                                </span>
                              )}
                              {rule.ruleKey === 'diagnostic_evidence' && (
                                <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium">
                                  ⚡ Trigger: Diagnostic Available
                                </span>
                              )}
                              {rule.faultCategorySpecific && rule.faultCategorySpecific.length > 0 && (
                                <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 font-medium">
                                  ⚡ Trigger: HV Battery Component
                                </span>
                              )}

                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px] flex items-center gap-1 uppercase font-bold">
                                {isVideo ? '📹 Video' : isBarcode ? '🏷️ Barcode' : isDiagnostic ? '📄 DTC' : '📷 Photo'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-xs text-slate-500">
                Select an OEM Brand Pack on the left to inspect and configure evidence rules.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* OFFICIAL OEM BENCHMARK & EVIDENCE ACTION MODAL */}
      <Modal
        isOpen={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        title={activeActionRule ? `OEM Evidence Benchmark: ${activeActionRule.name}` : 'OEM Evidence Benchmark'}
        maxWidth="3xl"
      >
        {activeActionRule && (() => {
          const benchmark = getBenchmarkForRule(activeActionRule.ruleKey, activeActionRule.exampleImageUrl);
          const flaggedCases = getCasesFlaggedForRule(activeActionRule.ruleKey);
          const workshopCases = getCasesRequiringRule(activeActionRule.ruleKey);
          const flaggedCount = flaggedCases.length;

          return (
            <div className="space-y-4">
              {/* Modal Header Bar */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-sm">{activeActionRule.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        activeActionRule.isMandatory ? 'bg-red-50 text-[#E11F26] border border-red-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {activeActionRule.isMandatory ? 'Mandatory Gate' : 'Optional'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono border border-slate-200 font-bold">
                      Tier {activeActionRule.tier} Core
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">{activeActionRule.description}</p>
                </div>

                <div className="text-right font-mono text-[10px] text-slate-500">
                  <p>Required OEM Target File:</p>
                  <p className="text-slate-900 font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                    RO10482_{activeActionRule.namingConvention.replace('[DealerRONumber]', '')}
                  </p>
                </div>
              </div>

              {/* Modal Action Tabs */}
              <div className="flex border-b border-slate-200 text-xs font-semibold">
                <button
                  onClick={() => setActionTab('SAMPLE_BENCHMARK')}
                  className={`pb-2.5 px-4 flex items-center gap-2 transition-all cursor-pointer ${
                    actionTab === 'SAMPLE_BENCHMARK'
                      ? 'border-b-2 border-[#E11F26] text-[#E11F26] font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span>📷 Official OEM Benchmark Photo</span>
                </button>
                <button
                  onClick={() => setActionTab('RESOLVE_CASES')}
                  className={`pb-2.5 px-4 flex items-center gap-2 transition-all cursor-pointer ${
                    actionTab === 'RESOLVE_CASES'
                      ? 'border-b-2 border-[#E11F26] text-[#E11F26] font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {flaggedCount > 0 ? (
                    <span className="flex items-center gap-1.5 text-[#E11F26]">
                      <span>⚠️ Flagged Retakes Required</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-[#E11F26] border border-red-200 text-[10px] font-mono font-bold">
                        {flaggedCount}
                      </span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <span>⚡ Active Cases Needing This</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-mono font-bold">
                        {workshopCases.length}
                      </span>
                    </span>
                  )}
                </button>
              </div>

              {/* TAB 1: OFFICIAL OEM BENCHMARK SAMPLE */}
              {actionTab === 'SAMPLE_BENCHMARK' && (
                <div className="space-y-4 pt-1">
                  {(() => {
                    const isPdf = activeActionRule.mediaType === 'document' ||
                                  benchmark.sampleImage.startsWith('data:application/pdf') ||
                                  benchmark.sampleImage.toLowerCase().endsWith('.pdf');

                    const isRealVideo = benchmark.sampleImage.startsWith('data:video') ||
                                        benchmark.sampleImage.toLowerCase().endsWith('.mp4') ||
                                        benchmark.sampleImage.toLowerCase().endsWith('.webm') ||
                                        benchmark.sampleImage.toLowerCase().endsWith('.mov');

                if (isPdf) {
                  return (
                    <div className="space-y-3 pt-1">
                      {/* PDF Action Toolbar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-lg bg-red-50 text-[#E11F26] flex items-center justify-center font-bold text-base border border-red-200">
                            📄
                          </span>
                          <div>
                            <p className="text-xs font-bold text-slate-900">
                              OEM Technical Service Bulletin / DTC Diagnostic Spec PDF
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Official document standard for {activeActionRule.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenPdf(benchmark.sampleImage)}
                            className="px-3.5 py-1.5 rounded-lg bg-[#E11F26] text-white text-xs font-bold hover:bg-red-700 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <span>Open in Full Window</span>
                            <span>↗</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadMedia(benchmark.sampleImage, `${activeActionRule.ruleKey}_spec.pdf`)}
                            className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>Download PDF</span>
                            <span>⬇</span>
                          </button>
                        </div>
                      </div>

                      {/* Embedded Interactive PDF Viewer */}
                      <div className="w-full h-[450px] rounded-2xl overflow-hidden border-2 border-slate-300 shadow-md bg-slate-100 relative">
                        <iframe
                          src={benchmark.sampleImage}
                          className="w-full h-full border-0 rounded-2xl bg-white"
                          title={activeActionRule.name}
                        />
                      </div>
                    </div>
                  );
                }

                if (isRealVideo) {
                  return (
                    <div className="space-y-3 pt-1">
                      {/* Video Header & Controls */}
                      <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                            ▶
                          </span>
                          <div>
                            <p className="text-xs font-bold text-slate-900">
                              Official OEM Video Demonstration Clip
                            </p>
                            <p className="text-[11px] text-slate-500">
                              15–30s recording demonstration for {activeActionRule.name}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownloadMedia(benchmark.sampleImage, `${activeActionRule.ruleKey}_demo.mp4`)}
                          className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Download Video</span>
                          <span>⬇</span>
                        </button>
                      </div>

                      {/* Video Player without obstructing overlays */}
                      <div className="w-full h-[360px] bg-black rounded-2xl overflow-hidden border-2 border-slate-300 shadow-md flex items-center justify-center relative">
                        <video
                          src={benchmark.sampleImage}
                          controls
                          playsInline
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  );
                }

                // If video rule but using still reference snapshot
                const isVideoStill = activeActionRule.mediaType === 'video';

                return (
                  <div className="space-y-4 pt-1">
                    {/* Large High-Resolution OEM Benchmark Image Frame */}
                    <div className="relative w-full aspect-video sm:h-[360px] bg-slate-900 rounded-2xl border-2 border-slate-300 overflow-hidden shadow-md flex flex-col justify-between">
                      <img
                        src={benchmark.sampleImage}
                        alt={activeActionRule.name}
                        className="absolute inset-0 w-full h-full object-contain p-2 z-0"
                      />

                      {/* Reticle Framing Guidelines */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6 z-10">
                        <div className="w-full h-full border-2 border-dashed border-white/60 rounded-xl relative flex items-center justify-center">
                          <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-white"></div>
                          <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-white"></div>
                          <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-white"></div>
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-white"></div>
                        </div>
                      </div>

                      {/* Top Overlay Bar */}
                      <div className="relative z-20 flex items-center justify-between text-[11px] font-mono text-white bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-b-xl border-b border-white/20 mx-3 mt-0">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded ${isVideoStill ? 'bg-amber-400 text-black' : 'bg-emerald-500 text-black'} font-extrabold text-[10px] uppercase tracking-wide`}>
                            {isVideoStill ? '📹 Video Capture Benchmark (Still Reference)' : '✓ Compliant OEM Sample'}
                          </span>
                          <span className="font-bold text-white">{activeActionRule.name}</span>
                        </div>
                        <span className="text-slate-300">
                          Standard: <strong className="text-white">{benchmark.specStandard}</strong>
                        </span>
                      </div>

                      {/* Bottom HUD Overlay Bar */}
                      <div className="relative z-20 bg-black/85 backdrop-blur-md p-3 rounded-t-xl border-t border-white/20 text-xs space-y-1 mx-3 mb-0">
                        <p className="text-white font-bold flex items-center gap-1.5">
                          <span className="text-[#E11F26]">{isVideoStill ? '📹 Viewfinder Video HUD:' : '📸 Viewfinder Overlay HUD:'}</span>
                          <span className="text-slate-200 font-normal">
                            {activeActionRule.guidanceText || activeActionRule.description}
                          </span>
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {isVideoStill
                            ? `Mandated 15–30s MP4 audio/video recording. Auto-named as RO10482_${activeActionRule.namingConvention.replace('[DealerRONumber]', '')} upon capture.`
                            : `Mandated by OEM Warranty Bulletin: Auto-named as RO10482_${activeActionRule.namingConvention.replace('[DealerRONumber]', '')} upon mobile technician capture.`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

                  {/* Side-by-side Quality Requirements (Good Standard vs Bad Pitfalls) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                      <p className="font-bold text-emerald-800 flex items-center gap-1.5 text-xs">
                        <span>✓</span>
                        <span>How to Pass OEM First-Time Audit</span>
                      </p>
                      <p className="text-[11px] text-emerald-900 leading-relaxed">
                        {benchmark.goodTip}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 space-y-1">
                      <p className="font-bold text-[#E11F26] flex items-center gap-1.5 text-xs">
                        <span>⚠️</span>
                        <span>Common Rejection Pitfalls</span>
                      </p>
                      <p className="text-[11px] text-red-900 leading-relaxed">
                        {benchmark.badTip}
                      </p>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      onClick={() => setActionTab('RESOLVE_CASES')}
                      className={`text-xs py-2 px-4 flex items-center gap-1.5 cursor-pointer rounded-xl font-bold transition-all shadow-sm ${
                        flaggedCount > 0
                          ? 'bg-[#E11F26] hover:bg-[#c81a20] text-white'
                          : 'bg-slate-900 hover:bg-black text-white'
                      }`}
                    >
                      {flaggedCount > 0 ? (
                        <>
                          <span>⚠️ Review Flagged Retakes ({flaggedCount})</span>
                          <span>➔</span>
                        </>
                      ) : (
                        <>
                          <span>⚡ Check Active Cases Needing This ({workshopCases.length})</span>
                          <span>➔</span>
                        </>
                      )}
                    </button>

                    <Link
                      href={`/cases?ruleKey=${activeActionRule.ruleKey}`}
                      className="text-xs py-2 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer font-bold"
                    >
                      <span>View in Cases CRM</span>
                      <span>➔</span>
                    </Link>
                  </div>
                </div>
              )}

              {/* TAB 2: RESOLVE ACTIVE CASES */}
              {actionTab === 'RESOLVE_CASES' && (
                <div className="space-y-3 pt-1">
                  {flaggedCount > 0 ? (
                    <div className="space-y-2.5">
                      <p className="text-xs text-[#E11F26] font-bold flex items-center gap-1.5">
                        <span>⚠️</span>
                        <span>
                          {flaggedCount} {flaggedCount === 1 ? 'ticket has' : 'tickets have'} open retake flags on this exact evidence gate:
                        </span>
                      </p>

                      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                        {flaggedCases.map((c) => {
                          const flags = c.flagHistory || c.flags || [];
                          const matchedFlag = flags.find(
                            (f) => !f.resolvedAt && isRuleKeyMatch(activeActionRule.ruleKey, f.evidenceRuleKey)
                          );

                          return (
                            <div
                              key={c.id}
                              className="p-3.5 rounded-xl bg-white border border-red-200 hover:border-[#E11F26] shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    RO #{c.roNumber}
                                  </span>
                                  <span className="text-slate-900 font-semibold">
                                    {c.vehicle?.year || c.year} {c.vehicle?.make || c.make} {c.vehicle?.model || c.model}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    VIN: {c.vin || c.vehicle?.vin}
                                  </span>
                                </div>

                                {matchedFlag && (
                                  <div className="p-2 rounded bg-red-50 border border-red-200 text-[11px] text-red-900">
                                    <p className="font-bold text-[#E11F26]">
                                      Flag Reason: {matchedFlag.reasonCode.replace(/_/g, ' ')}
                                    </p>
                                    {matchedFlag.instruction && (
                                      <p className="mt-0.5 text-red-800">
                                        Clerk Note: &ldquo;{matchedFlag.instruction}&rdquo;
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>

                              <Link
                                href={`/cases/${c.id}?retake=true&retakeRule=${activeActionRule.ruleKey}`}
                                className="px-3.5 py-2 rounded-xl bg-[#E11F26] hover:bg-[#c81a20] text-white font-bold text-xs shadow-sm shrink-0 flex items-center justify-center gap-1.5 transition-all"
                              >
                                <span>Resolve & Retake</span>
                                <span>➔</span>
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-800">
                        <svg className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <div>
                          <p className="font-bold">No Open Retake Flags for {activeActionRule.name}</p>
                          <p className="text-[11px] text-emerald-700 mt-0.5">
                            There are currently no tickets blocked or flagged for this rule across workshop bays. Below are the active workshop tickets currently undergoing claim preparation for {selectedPack?.brandName || 'this Brand'}.
                          </p>
                        </div>
                      </div>

                      {/* Show active cases for this brand */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-slate-700 font-bold">
                            Active Workshop Cases for {selectedPack?.brandName || 'this Brand'}:
                          </p>
                          <span className="text-[10px] text-slate-700 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-bold">
                            {workshopCases.length} Active in Bays
                          </span>
                        </div>
                        <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 text-xs">
                          {workshopCases.slice(0, 6).map((c) => {
                            const isFlagged = c.status === 'Flagged';
                            const flagItem = (c.flagHistory || c.flags || []).find((f: any) => !f.resolvedAt);

                            return (
                              <div
                                key={c.id}
                                className={`p-3 rounded-xl bg-white border transition-all flex items-center justify-between gap-3 shadow-sm ${
                                  isFlagged
                                    ? 'border-red-300 bg-red-50/50 hover:border-[#E11F26]'
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                                      RO #{c.roNumber}
                                    </span>
                                    <span className="text-slate-900 font-semibold">{c.vehicle?.make || c.make} {c.vehicle?.model || c.model}</span>
                                    <StatusBadge status={c.status as any} size="sm" />
                                  </div>
                                  <p className="text-[11px] text-slate-500">
                                    Tech: {c.technicianName || 'Workshop Bay'} · VIN: {c.vin || c.vehicle?.vin}
                                  </p>
                                  {isFlagged && flagItem && (
                                    <p className="text-[10px] text-[#E11F26] font-medium flex items-center gap-1">
                                      <span>⚠️ Flagged on other gate:</span>
                                      <span>{flagItem.reasonCode?.replace(/_/g, ' ')}</span>
                                      {flagItem.evidenceRuleKey && (
                                        <span className="font-mono">({flagItem.evidenceRuleKey})</span>
                                      )}
                                    </p>
                                  )}
                                </div>

                                <Link
                                  href={isFlagged ? `/cases/${c.id}?retake=true` : `/cases/${c.id}`}
                                  className={
                                    isFlagged
                                      ? 'px-3 py-1.5 rounded-lg bg-[#E11F26] hover:bg-[#c81a20] text-white font-bold text-[11px] shadow-sm shrink-0 flex items-center gap-1 transition-all'
                                      : 'px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] shrink-0 border border-slate-200'
                                  }
                                >
                                  {isFlagged ? 'Resolve Retake ➔' : 'Open Ticket ➔'}
                                </Link>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-2 flex justify-between items-center text-xs">
                        <Link
                          href={`/cases?ruleKey=${activeActionRule.ruleKey}`}
                          className="text-[#E11F26] hover:underline flex items-center gap-1 font-bold"
                        >
                          <span>View all cases filtered by {activeActionRule.name} in CRM</span>
                          <span>➔</span>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* INTERACTIVE MOBILE TECHNICIAN SIMULATOR MODAL */}
      <Modal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        title="Mobile Technician Evidence Wizard Simulator"
        maxWidth="3xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Controls: Repair Scenario Configurator */}
          <div className="md:col-span-6 space-y-4 pr-1">
            <div>
              <h4 className="text-xs font-extrabold text-[#E11F26] uppercase tracking-wider">
                Workshop Scenario Configurator
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Toggle conditions to test which Attachment A gates the technician will be required
                to capture on their mobile phone.
              </p>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <label className="block text-[11px] text-slate-700 font-bold mb-1">
                  Active Brand Standard
                </label>
                <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-900 font-bold text-xs flex items-center justify-between shadow-sm">
                  <span>{selectedPack?.name || 'BYD Attachment A'}</span>
                  <span className="text-[10px] text-emerald-700 font-mono bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">v{selectedPack?.version} Live</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-700 font-bold mb-1">
                  Dealer Repair Order (RO) #
                </label>
                <input
                  type="text"
                  value={simRoNumber}
                  onChange={(e) => setSimRoNumber(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-[#E11F26]"
                  placeholder="e.g. RO-10482"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-700 font-bold mb-1">
                  Fault Category
                </label>
                <select
                  value={simFaultCategory}
                  onChange={(e) => setSimFaultCategory(e.target.value as FaultCategory)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#E11F26]"
                >
                  {FAULT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-800 text-xs font-medium">Was a physical part replaced?</span>
                  <input
                    type="checkbox"
                    checked={simPartReplaced}
                    onChange={(e) => setSimPartReplaced(e.target.checked)}
                    className="w-4 h-4 rounded text-[#E11F26] border-slate-300 focus:ring-[#E11F26]"
                  />
                </label>
                <p className="text-[10px] text-slate-500">
                  If checked, dynamically triggers Old & New Part Serial barcode gates.
                </p>

                <label className="flex items-center justify-between cursor-pointer pt-1">
                  <span className="text-slate-800 text-xs font-medium">Customer complaint involves Noise / Rattle?</span>
                  <input
                    type="checkbox"
                    checked={simNoiseFault}
                    onChange={(e) => setSimNoiseFault(e.target.checked)}
                    className="w-4 h-4 rounded text-[#E11F26] border-slate-300 focus:ring-[#E11F26]"
                  />
                </label>
                <p className="text-[10px] text-slate-500">
                  If checked, triggers a mandatory 10–15s audio/video recording before disassembly.
                </p>

                <label className="flex items-center justify-between cursor-pointer pt-1">
                  <span className="text-slate-800 text-xs font-medium">Diagnostic Scan / VDS Printout available?</span>
                  <input
                    type="checkbox"
                    checked={simDiagnosticsAvailable}
                    onChange={(e) => setSimDiagnosticsAvailable(e.target.checked)}
                    className="w-4 h-4 rounded text-[#E11F26] border-slate-300 focus:ring-[#E11F26]"
                  />
                </label>

                <div className="pt-2">
                  <label className="block text-[11px] text-slate-700 font-bold mb-1">
                    Repair Stage
                  </label>
                  <select
                    value={simRepairStage}
                    onChange={(e) => setSimRepairStage(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#E11F26]"
                  >
                    <option value="DIAGNOSTIC">Initial Diagnostics</option>
                    <option value="IN_PROGRESS">Repair In-Progress</option>
                    <option value="REPAIR_COMPLETE">Repair Complete & Reassembled</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Live Evaluation Summary */}
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 space-y-1 text-xs">
              <div className="flex items-center justify-between text-slate-900 font-bold">
                <span>Evaluated Evidence Gates:</span>
                <span className="text-[#E11F26] font-mono font-extrabold">{simulatedGates.length} Total</span>
              </div>
              <p className="text-[11px] text-slate-600">
                <strong className="text-slate-900">{simulatedMandatoryGates.length} Mandatory Gates</strong> must be captured before
                the technician mobile app will permit submission to the warranty clerk.
              </p>
            </div>
          </div>

          {/* Right Preview: Simulated Mobile Phone Viewport */}
          <div className="md:col-span-6 flex justify-center">
            <div className="w-[300px] sm:w-[320px] bg-slate-900 border-4 border-slate-700 rounded-[2.5rem] p-3.5 shadow-2xl flex flex-col relative overflow-hidden text-white">
              {/* Phone Speaker Notch */}
              <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center">
                <div className="w-8 h-1 bg-slate-700 rounded-full"></div>
              </div>

              {/* Mobile App Header */}
              <div className="px-2 py-1.5 border-b border-slate-800 flex items-center justify-between text-[11px]">
                <div>
                  <span className="font-extrabold text-white">Booran</span>
                  <span className="text-[#E11F26] font-bold ml-1">Tech</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.2 rounded font-bold">
                  Online
                </span>
              </div>

              {/* Active RO Badge in App */}
              <div className="p-2 my-2 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between text-[10px]">
                <div>
                  <p className="text-slate-400">Repair Order</p>
                  <p className="font-mono font-bold text-white">{simRoNumber}</p>
                </div>
                <span className="text-[9px] bg-[#E11F26] text-white px-2 py-0.5 rounded font-bold">
                  {selectedPack?.brandName || 'BYD'}
                </span>
              </div>

              {/* Evidence Checklist Header in Mobile */}
              <div className="px-1 mb-2 flex items-center justify-between text-[10px]">
                <span className="text-slate-300 font-semibold">Evidence Checklist</span>
                <span className="text-red-400 font-bold">{simulatedMandatoryGates.length} Required</span>
              </div>

              {/* Mobile Dynamic Gates Checklist Scrollable */}
              <div className="flex-1 space-y-2 max-h-[340px] overflow-y-auto pr-1 text-[11px]">
                {simulatedGates.map((gate, idx) => {
                  const targetFilename = gate.namingConvention.replace(
                    /\[DealerRONumber\]/gi,
                    simRoNumber.replace(/[^a-zA-Z0-9]/g, '') + '_'
                  );
                  const bench = getBenchmarkForRule(gate.ruleKey);

                  return (
                    <div
                      key={gate.id || idx}
                      onClick={() => handleOpenRuleAction(gate, 'SAMPLE_BENCHMARK')}
                      className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700 hover:border-[#E11F26] transition-all cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-bold text-white text-[11px] leading-tight">
                          {gate.name}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                            gate.isMandatory
                              ? 'bg-red-950 text-red-400 border border-red-800/50'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {gate.isMandatory ? 'Required' : 'Opt'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <img
                          src={bench.sampleImage}
                          alt={gate.name}
                          className="w-10 h-7 object-cover rounded border border-slate-700 shrink-0"
                        />
                        <p className="text-[10px] text-slate-300 leading-tight line-clamp-2">
                          📸 {gate.guidanceText || gate.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-700/60 text-[9px] font-mono">
                        <span className="text-slate-400 truncate max-w-[150px]">
                          {targetFilename}
                        </span>
                        <span className="text-[#E11F26] font-bold">
                          Sample ➔
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile Info Footer */}
              <div className="pt-2 mt-auto border-t border-slate-800">
                <button
                  onClick={() => setIsSimulatorOpen(false)}
                  className="w-full py-1.5 rounded-xl bg-[#E11F26] hover:bg-[#c81a20] text-white text-[11px] font-bold transition-all cursor-pointer shadow-md"
                >
                  Close Simulator
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Add Brand Rule & CSV/Excel Import Modal */}
      <AddBrandRuleModal
        isOpen={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        defaultPackId={selectedPack?.id}
        initialMode={ruleModalMode}
        onSuccess={async () => {
          await loadData();
        }}
      />
    </div>
  );
}
