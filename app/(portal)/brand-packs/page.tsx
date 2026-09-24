'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Header } from '../../../components/header';
import { Modal } from '../../../components/modal';
import { StatusBadge } from '../../../components/status-badge';
import { AddBrandRuleModal } from '../../../components/add-brand-rule-modal';
import { useToast } from '../../../components/toast';
import { api, resolveMediaUrl } from '../../../lib/api';
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
  const [simSite, setSimSite] = useState('Booran BYD Cranbourne (CR-)');
  const [simRoNumber, setSimRoNumber] = useState('CR-98421');
  const [simPowertrain, setSimPowertrain] = useState<'EV' | 'PHEV' | 'ICE'>('EV');
  const [simOdometer, setSimOdometer] = useState('14,250');
  const [simClaimType, setSimClaimType] = useState('Standard Warranty');
  const [simTechName, setSimTechName] = useState('Jake Smith (EV Level 4 Master Tech)');
  const [simFaultCategory, setSimFaultCategory] = useState<FaultCategory>(
    'Battery and high-voltage (HV) components'
  );
  const [simPartReplaced, setSimPartReplaced] = useState(true);
  const [simNoiseFault, setSimNoiseFault] = useState(false);
  const [simDiagnosticsAvailable, setSimDiagnosticsAvailable] = useState(true);
  const [simRepairStage, setSimRepairStage] = useState<'DIAGNOSTIC' | 'IN_PROGRESS' | 'REPAIR_COMPLETE'>('REPAIR_COMPLETE');

  // Interactive Phone Simulator Engine State
  const [simCapturedGates, setSimCapturedGates] = useState<Record<string, { capturedAt: string; ocrText?: string; sampleImage?: string }>>({});
  const [simActiveCameraGate, setSimActiveCameraGate] = useState<BrandPackRule | null>(null);
  const [simPhoneTab, setSimPhoneTab] = useState<'CHECKLIST' | 'WIZARD'>('CHECKLIST');
  const [simWizardStep, setSimWizardStep] = useState(0);
  const [simSubmitted, setSimSubmitted] = useState(false);
  const [simFlashEffect, setSimFlashEffect] = useState(false);
  const [simFlaggedAlert, setSimFlaggedAlert] = useState<{
    ruleKey: string;
    reasonCode: string;
    instruction: string;
  } | null>(null);

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

      if (rule.ruleKey === 'video_before' || rule.ruleKey === 'noise_video') {
        if (simNoiseFault) resolved.push(rule);
        continue;
      }

      if (rule.ruleKey === 'after_repair_photo') {
        if (simRepairStage === 'REPAIR_COMPLETE') resolved.push(rule);
        continue;
      }

      if (rule.ruleKey.includes('hv') || rule.ruleKey.includes('isolation')) {
        if (simPowertrain === 'EV' || simFaultCategory.includes('Battery') || simFaultCategory.includes('HV')) {
          resolved.push(rule);
          continue;
        }
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
    simPowertrain,
  ]);

  const simulatedMandatoryGates = useMemo(
    () => simulatedGates.filter((r) => r.isMandatory),
    [simulatedGates]
  );

  const capturedMandatoryCount = useMemo(
    () => simulatedMandatoryGates.filter((g) => simCapturedGates[g.ruleKey]).length,
    [simulatedMandatoryGates, simCapturedGates]
  );

  const isAllMandatoryCaptured = useMemo(
    () => simulatedMandatoryGates.length > 0 && capturedMandatoryCount === simulatedMandatoryGates.length,
    [simulatedMandatoryGates, capturedMandatoryCount]
  );

  const applyPreset = (presetKey: string) => {
    setSimSubmitted(false);
    setSimCapturedGates({});
    setSimActiveCameraGate(null);
    if (presetKey === 'BYD_ATTO3_HV') {
      setSimSite('Booran BYD Cranbourne (CR-)');
      setSimRoNumber('CR-98421');
      setSimPowertrain('EV');
      setSimFaultCategory('Battery and high-voltage (HV) components');
      setSimPartReplaced(true);
      setSimNoiseFault(false);
      setSimDiagnosticsAvailable(true);
      setSimRepairStage('REPAIR_COMPLETE');
      setSimOdometer('14,250');
      setSimClaimType('Standard Warranty');
    } else if (presetKey === 'MG4_BATTERY') {
      setSimSite('Booran MG & Chery Cheltenham (CHEL-)');
      setSimRoNumber('CHEL-20105');
      setSimPowertrain('EV');
      setSimFaultCategory('Charging system faults');
      setSimPartReplaced(true);
      setSimNoiseFault(false);
      setSimDiagnosticsAvailable(true);
      setSimRepairStage('IN_PROGRESS');
      setSimOdometer('12,400');
      setSimClaimType('Standard Warranty');
    } else if (presetKey === 'CHERY_SUNROOF') {
      setSimSite('Booran MG & Chery Cheltenham (CHEL-)');
      setSimRoNumber('CHEL-20118');
      setSimPowertrain('ICE');
      setSimFaultCategory('Powertrain, chassis or body component faults');
      setSimPartReplaced(false);
      setSimNoiseFault(true);
      setSimDiagnosticsAvailable(false);
      setSimRepairStage('DIAGNOSTIC');
      setSimOdometer('6,800');
      setSimClaimType('Recall Campaign');
    } else if (presetKey === 'SERVICE_INSPECTION') {
      setSimSite('Booran Dandenong Multi-Franchise (DAN-)');
      setSimRoNumber('DAN-40301');
      setSimPowertrain('EV');
      setSimFaultCategory('ECU or sensor internal faults');
      setSimPartReplaced(false);
      setSimNoiseFault(false);
      setSimDiagnosticsAvailable(true);
      setSimRepairStage('DIAGNOSTIC');
      setSimOdometer('25,000');
      setSimClaimType('Standard Warranty');
    }
  };

  const handleSimulateCapture = (gate: BrandPackRule) => {
    setSimFlashEffect(true);
    setTimeout(() => setSimFlashEffect(false), 200);

    const benchmark = getBenchmarkForRule(gate.ruleKey);
    let ocrText: string | undefined = undefined;
    if (gate.ruleKey === 'vin_photo') ocrText = '2C4RDGCG0FR805928 (99% conf)';
    else if (gate.ruleKey === 'odometer_photo') ocrText = `${simOdometer} km (98% conf)`;
    else if (gate.ruleKey.includes('serial')) ocrText = 'SN-BYD-8829104';
    else if (gate.ruleKey === 'diagnostic_evidence') ocrText = 'DTC P0A80-13 LOGGED';

    setSimCapturedGates((prev) => ({
      ...prev,
      [gate.ruleKey]: {
        capturedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ocrText,
        sampleImage: benchmark.sampleImage,
      },
    }));

    setTimeout(() => {
      setSimActiveCameraGate(null);
    }, 450);
  };

  const handleCaptureAll = () => {
    const all: Record<string, any> = {};
    simulatedGates.forEach((gate) => {
      const benchmark = getBenchmarkForRule(gate.ruleKey);
      let ocrText: string | undefined = undefined;
      if (gate.ruleKey === 'vin_photo') ocrText = '2C4RDGCG0FR805928 (99% conf)';
      else if (gate.ruleKey === 'odometer_photo') ocrText = `${simOdometer} km (98% conf)`;
      else if (gate.ruleKey.includes('serial')) ocrText = 'SN-BYD-8829104';
      else if (gate.ruleKey === 'diagnostic_evidence') ocrText = 'DTC P0A80-13 LOGGED';
      all[gate.ruleKey] = {
        capturedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ocrText,
        sampleImage: benchmark.sampleImage,
      };
    });
    setSimCapturedGates(all);
    setSimSubmitted(false);
  };

  const handleResetSimulator = () => {
    setSimCapturedGates({});
    setSimSubmitted(false);
    setSimActiveCameraGate(null);
    setSimWizardStep(0);
  };

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
                          key={benchmark.sampleImage}
                          controls
                          playsInline
                          preload="auto"
                          className="w-full h-full object-contain"
                        >
                          <source src={resolveMediaUrl(benchmark.sampleImage)} type="video/mp4" />
                          <source src={benchmark.sampleImage} />
                          Your browser does not support HTML5 video playback.
                        </video>
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
        maxWidth="6xl"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Controls: Repair Scenario Configurator */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="text-xs font-extrabold text-[#E11F26] uppercase tracking-wider flex items-center gap-1.5">
                  <span>Workshop Scenario Configurator</span>
                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-[#E11F26] text-[10px] font-bold">
                    Attachment A Engine
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Adjust workshop conditions to dynamically test Attachment A checklist evaluation and simulate mobile evidence capture.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCaptureAll}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Simulate all gates captured"
                >
                  <span>📸 Auto-Capture All</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetSimulator}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                  title="Reset simulator"
                >
                  ↺ Reset
                </button>
              </div>
            </div>

            {/* Quick Presets Bar */}
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 block">
                Load Realistic Workshop Presets:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'BYD_ATTO3_HV', label: '⚡ BYD Atto 3 HV Battery Leak (EV)' },
                  { key: 'MG4_BATTERY', label: '🔋 MG4 12V Drain (EV)' },
                  { key: 'CHERY_SUNROOF', label: '🔊 Chery Omoda Rattle (ICE)' },
                  { key: 'SERVICE_INSPECTION', label: '🔄 25,000km Inspection' },
                ].map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => applyPreset(preset.key)}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-red-50 hover:border-red-300 border border-slate-200 text-slate-800 hover:text-[#E11F26] text-[11px] font-semibold transition-all shadow-2xs cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Configurator Form Grid */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-700 font-bold mb-1">
                    Dealership Rooftop & Site
                  </label>
                  <select
                    value={simSite}
                    onChange={(e) => {
                      setSimSite(e.target.value);
                      if (e.target.value.includes('Cranbourne')) setSimRoNumber('CR-98421');
                      else if (e.target.value.includes('Cheltenham')) setSimRoNumber('CHEL-20105');
                      else if (e.target.value.includes('Dandenong')) setSimRoNumber('DAN-40301');
                      else if (e.target.value.includes('Berwick')) setSimRoNumber('BER-10942');
                    }}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-[#E11F26]"
                  >
                    <option value="Booran BYD Cranbourne (CR-)">Booran BYD Cranbourne (CR-)</option>
                    <option value="Booran MG & Chery Cheltenham (CHEL-)">Booran MG & Chery Cheltenham (CHEL-)</option>
                    <option value="Booran Dandenong Multi-Franchise (DAN-)">Booran Dandenong Multi (DAN-)</option>
                    <option value="Booran Berwick Commercials (BER-)">Booran Berwick Commercials (BER-)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-700 font-bold mb-1">
                    Vehicle Powertrain
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['EV', 'PHEV', 'ICE'] as const).map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => setSimPowertrain(pt)}
                        className={`py-1 text-center rounded-md font-bold text-xs border transition-all cursor-pointer ${
                          simPowertrain === pt
                            ? 'bg-[#E11F26] text-white border-[#E11F26] shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {pt === 'EV' ? '⚡ EV' : pt === 'PHEV' ? '🔋 PHEV' : '⛽ ICE'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-700 font-bold mb-1">
                    Dealer Repair Order (RO) #
                  </label>
                  <input
                    type="text"
                    value={simRoNumber}
                    onChange={(e) => setSimRoNumber(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-[#E11F26]"
                    placeholder="e.g. CR-98421"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-700 font-bold mb-1">
                    Odometer Reading (km)
                  </label>
                  <input
                    type="text"
                    value={simOdometer}
                    onChange={(e) => setSimOdometer(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-[#E11F26]"
                    placeholder="e.g. 14,250"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                <div>
                  <label className="block text-[11px] text-slate-700 font-bold mb-1">
                    Repair Stage
                  </label>
                  <select
                    value={simRepairStage}
                    onChange={(e) => setSimRepairStage(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#E11F26]"
                  >
                    <option value="DIAGNOSTIC">Pre-repair & Diagnostic Only</option>
                    <option value="IN_PROGRESS">During Repair (Disassembled)</option>
                    <option value="REPAIR_COMPLETE">Repair Complete & Reassembled</option>
                  </select>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-lg hover:bg-white transition-colors">
                  <div>
                    <span className="text-slate-800 text-xs font-semibold block">Was a physical part replaced?</span>
                    <span className="text-[10px] text-slate-500">Triggers mandatory Old & New Part Serial barcode gates.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={simPartReplaced}
                    onChange={(e) => setSimPartReplaced(e.target.checked)}
                    className="w-4 h-4 rounded text-[#E11F26] border-slate-300 focus:ring-[#E11F26] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-lg hover:bg-white transition-colors">
                  <div>
                    <span className="text-slate-800 text-xs font-semibold block">Customer complaint involves Noise / Rattle?</span>
                    <span className="text-[10px] text-slate-500">Triggers mandatory 15s audio/video recording before teardown.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={simNoiseFault}
                    onChange={(e) => setSimNoiseFault(e.target.checked)}
                    className="w-4 h-4 rounded text-[#E11F26] border-slate-300 focus:ring-[#E11F26] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-lg hover:bg-white transition-colors">
                  <div>
                    <span className="text-slate-800 text-xs font-semibold block">Diagnostic Scan / VDS Printout available?</span>
                    <span className="text-[10px] text-slate-500">Demands live DTC freeze-frame screenshot.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={simDiagnosticsAvailable}
                    onChange={(e) => setSimDiagnosticsAvailable(e.target.checked)}
                    className="w-4 h-4 rounded text-[#E11F26] border-slate-300 focus:ring-[#E11F26] cursor-pointer"
                  />
                </label>
              </div>

              {/* Technician & Claim Context */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-[11px] text-slate-700 font-bold mb-1">
                    Certified Technician
                  </label>
                  <select
                    value={simTechName}
                    onChange={(e) => setSimTechName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#E11F26]"
                  >
                    <option value="Jake Smith (EV Level 4 Master Tech)">Jake Smith (EV Level 4 Master Tech)</option>
                    <option value="Liam Miller (Diagnostic Specialist)">Liam Miller (Diagnostic Specialist)</option>
                    <option value="Ben Walker (Mechanical Technician)">Ben Walker (Mechanical Technician)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-700 font-bold mb-1">
                    Claim Classification
                  </label>
                  <select
                    value={simClaimType}
                    onChange={(e) => setSimClaimType(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#E11F26]"
                  >
                    <option value="Standard Warranty">Standard Warranty Claim</option>
                    <option value="Recall Campaign">Technical Campaign / Recall</option>
                    <option value="Pre-Delivery PDI">Pre-Delivery PDI Discrepancy</option>
                    <option value="Goodwill">Goodwill Prior Approval</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Live Evaluation & Audit Risk Summary */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-red-50 to-orange-50/40 border border-red-200 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-900 font-extrabold">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#E11F26] animate-ping" />
                  Live Rules Evaluation Result:
                </span>
                <span className="text-[#E11F26] font-mono text-sm">
                  {simulatedGates.length} Total Gates ({simulatedMandatoryGates.length} Mandatory)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 text-center">
                <div className="p-2 rounded-lg bg-white/80 border border-red-100">
                  <span className="text-[10px] text-slate-500 block">Mandatory Gates</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{simulatedMandatoryGates.length}</span>
                </div>
                <div className="p-2 rounded-lg bg-white/80 border border-red-100">
                  <span className="text-[10px] text-slate-500 block">Captured so far</span>
                  <span className="font-mono font-bold text-emerald-600 text-sm">{capturedMandatoryCount}</span>
                </div>
                <div className="p-2 rounded-lg bg-white/80 border border-red-100">
                  <span className="text-[10px] text-slate-500 block">Predicted Pass Rate</span>
                  <span className="font-mono font-bold text-[#E11F26] text-sm">
                    {isAllMandatoryCaptured ? '99% Pass' : `${Math.round((capturedMandatoryCount / Math.max(1, simulatedMandatoryGates.length)) * 95)}%`}
                  </span>
                </div>
              </div>
              {simPartReplaced && (
                <p className="text-[11px] text-amber-800 font-medium">
                  ⚠️ Part replacement flag active: Both old & new serial numbers must be documented to avoid claim bounce.
                </p>
              )}
              {simPowertrain === 'EV' && (
                <p className="text-[11px] text-blue-800 font-medium">
                  ⚡ EV High-Voltage Isolation Gate enforced in accordance with BYD-WB-2602-02 Annex 2.
                </p>
              )}
            </div>

            {/* Interactive Quality Gate & Push Notification Simulator */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  📲 Simulate Clerk Flag Push Notification
                </span>
                <span className="text-[10px] text-[#E11F26] font-mono font-bold">Scope Sec. 6 & 8.3</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-tight">
                Simulate a Warranty Clerk rejecting an evidence item. An animated mobile push notification banner will appear on the technician phone. Tapping it drops the technician directly onto that gate.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSimFlaggedAlert({
                      ruleKey: 'fault_location',
                      reasonCode: 'WRONG_ANGLE',
                      instruction: 'Photo framed too tight. Step back 1 meter to show surrounding subframe and mounting bracket.',
                    });
                  }}
                  className="px-2.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-[10px] cursor-pointer text-left transition-colors shadow-2xs"
                >
                  ⚠️ Reject Location (WRONG_ANGLE)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSimFlaggedAlert({
                      ruleKey: 'vin_photo',
                      reasonCode: 'UNREADABLE_VIN',
                      instruction: 'Windscreen glare obscuring VIN characters 4 through 7. Recapture without torch reflection.',
                    });
                  }}
                  className="px-2.5 py-2 rounded-lg bg-red-50 hover:bg-red-100 border border-red-300 text-red-900 font-bold text-[10px] cursor-pointer text-left transition-colors shadow-2xs"
                >
                  ⚠️ Reject VIN (UNREADABLE_VIN)
                </button>
              </div>
            </div>
          </div>

          {/* Right Preview: Interactive Simulated Mobile Phone Viewport */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-[316px] sm:w-[340px] bg-slate-900 border-[6px] border-slate-700 rounded-[2.75rem] p-2.5 shadow-2xl flex flex-col relative overflow-hidden min-h-[600px]">
              {/* Camera Shutter Flash Effect */}
              {simFlashEffect && (
                <div className="absolute inset-0 z-50 bg-white opacity-90 animate-fadeOut pointer-events-none" />
              )}

              {/* Inside Mobile Screen Container (Light Workshop Canvas matching warranty-app) */}
              <div className="bg-[#F8FAFC] rounded-[2.15rem] p-2.5 flex-1 flex flex-col overflow-hidden text-slate-900 relative">
                {/* Phone Speaker Notch & Dynamic Island */}
                <div className="w-24 h-4 bg-black rounded-full mx-auto mb-1 flex items-center justify-between px-2.5 shadow-xs">
                  <div className="w-2 h-2 rounded-full bg-slate-900" />
                  <div className="w-6 h-0.5 bg-slate-800 rounded-full" />
                  <div className="w-1 h-1 rounded-full bg-emerald-500" />
                </div>

                {/* Status Bar */}
                <div className="px-1 py-0.5 flex items-center justify-between text-[10px] text-slate-500 font-mono font-medium">
                  <span>11:28</span>
                  <div className="flex items-center gap-1">
                    <span>5G</span>
                    <span>100% 🔋</span>
                  </div>
                </div>

                {/* Mobile App Header */}
                <div className="px-2 py-1.5 border-b border-slate-200 bg-white rounded-xl shadow-2xs flex items-center justify-between text-[11px] mb-1.5">
                  <div>
                    <span className="font-black text-slate-900 text-xs">Booran</span>
                    <span className="text-[#E11F26] font-bold text-xs ml-1">Tech</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full font-bold">
                      ● Live Sync
                    </span>
                  </div>
                </div>

                {/* View Switcher Tabs inside phone */}
                <div className="grid grid-cols-2 gap-1 p-1 mb-1.5 bg-slate-200/80 rounded-xl border border-slate-300/60 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setSimPhoneTab('CHECKLIST');
                      setSimActiveCameraGate(null);
                    }}
                    className={`py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      simPhoneTab === 'CHECKLIST'
                        ? 'bg-[#E11F26] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📋 Checklist ({simulatedGates.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimPhoneTab('WIZARD');
                      setSimActiveCameraGate(null);
                    }}
                    className={`py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      simPhoneTab === 'WIZARD'
                        ? 'bg-[#E11F26] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🧭 Wizard Flow
                  </button>
                </div>

                {/* Active Ticket Banner in Mobile */}
                <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between text-[10px] mb-1.5">
                  <div>
                    <p className="text-slate-400 text-[9px] uppercase font-mono font-semibold">Repair Order</p>
                    <p className="font-mono font-black text-slate-900 text-xs tracking-tight">{simRoNumber}</p>
                    <p className="text-[9px] text-slate-500 truncate max-w-[155px]">{simSite.split('(')[0]}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] bg-[#E11F26] text-white px-2 py-0.5 rounded font-bold uppercase block shadow-2xs">
                      {selectedPack?.brandName || 'BYD'}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono mt-0.5 block font-semibold">{simPowertrain}</span>
                  </div>
                </div>

                {/* Active View Container */}
                <div className="flex-1 overflow-hidden flex flex-col pt-1">
                  {/* Simulated In-App Push Notification Banner (Scope Section 6 & 8.3) */}
                  {simFlaggedAlert && (
                    <div
                      onClick={() => {
                        const targetGate = simulatedGates.find((g) => g.ruleKey === simFlaggedAlert.ruleKey) || simulatedGates[0];
                        setSimPhoneTab('CHECKLIST');
                        setSimCapturedGates((prev) => {
                          const next = { ...prev };
                          delete next[simFlaggedAlert.ruleKey];
                          return next;
                        });
                        setSimActiveCameraGate(targetGate);
                        setSimFlaggedAlert(null);
                      }}
                      className="mb-2 p-2.5 rounded-xl bg-slate-900 text-white border-2 border-[#E11F26] shadow-xl cursor-pointer animate-bounce group transition-all shrink-0"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-red-400 uppercase tracking-wider">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                          Push Alert · Clerk Flag
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSimFlaggedAlert(null);
                          }}
                          className="text-slate-400 hover:text-white text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="text-[11px] font-bold text-white flex items-center justify-between">
                        <span>Rejected: {simFlaggedAlert.reasonCode}</span>
                        <span className="text-[10px] text-red-400 font-bold group-hover:underline">Tap to Fix 📸</span>
                      </div>
                      <p className="text-[10px] text-slate-300 italic mt-0.5 line-clamp-2 leading-tight">
                        "{simFlaggedAlert.instruction}"
                      </p>
                    </div>
                  )}

                  {/* 1. Camera Viewfinder Simulator Mode */}
                  {simActiveCameraGate ? (
                    <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col justify-between p-3 relative overflow-hidden animate-fadeIn text-white">
                      {/* Viewfinder Header */}
                      <div className="flex items-center justify-between z-10">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-red-400 block tracking-wider">
                            Camera Viewfinder HUD
                          </span>
                          <span className="text-xs font-bold text-white block">
                            {simActiveCameraGate.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSimActiveCameraGate(null)}
                          className="w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-xs font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Viewfinder Center Target HUD */}
                      <div className="relative flex-1 flex flex-col items-center justify-center my-2 border border-slate-800/80 rounded-xl overflow-hidden bg-slate-900/90">
                        {/* Grid crosshair lines */}
                        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20">
                          <div className="border-r border-b border-white" />
                          <div className="border-r border-b border-white" />
                          <div className="border-b border-white" />
                          <div className="border-r border-b border-white" />
                          <div className="border-r border-b border-white" />
                          <div className="border-b border-white" />
                          <div className="border-r border-white" />
                          <div className="border-r border-b border-white" />
                          <div />
                        </div>

                        {/* Targeted framing box based on rule type */}
                        {simActiveCameraGate.ruleKey === 'vin_photo' ? (
                          <div className="w-48 h-20 border-2 border-dashed border-amber-400 rounded-lg flex flex-col items-center justify-center relative bg-amber-400/10 animate-pulse">
                            <span className="text-[9px] font-mono font-bold text-amber-300">ALIGN 17-CHAR VIN BARCODE</span>
                            <div className="w-full h-0.5 bg-red-500 absolute top-1/2 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                          </div>
                        ) : simActiveCameraGate.ruleKey === 'odometer_photo' ? (
                          <div className="w-36 h-36 rounded-full border-2 border-dashed border-emerald-400 flex flex-col items-center justify-center bg-emerald-400/10">
                            <span className="text-[9px] font-mono font-bold text-emerald-300">ODOMETER CLUSTER</span>
                            <span className="text-[8px] text-slate-400">{simOdometer} KM</span>
                          </div>
                        ) : (
                          <div className="w-44 h-32 border-2 border-white/60 rounded-xl flex flex-col items-center justify-center p-2 text-center bg-white/5">
                            <span className="text-[10px] font-bold text-white">📸 Context Target</span>
                            <span className="text-[8px] text-slate-300 mt-1">1m step-back · include assembly</span>
                          </div>
                        )}

                        <p className="text-[9px] text-slate-300 text-center px-4 mt-2">
                          {simActiveCameraGate.guidanceText || 'Tap shutter to capture verified evidence'}
                        </p>
                      </div>

                      {/* Viewfinder Bottom Shutter Button */}
                      <div className="flex items-center justify-around pt-1 z-10">
                        <span className="text-[9px] text-slate-400 font-mono">1x Lens</span>
                        <button
                          type="button"
                          onClick={() => handleSimulateCapture(simActiveCameraGate)}
                          className="w-14 h-14 rounded-full border-4 border-white bg-[#E11F26] hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center cursor-pointer"
                          title="Take Photo"
                        >
                          <div className="w-10 h-10 rounded-full border border-white/40 bg-white/20" />
                        </button>
                        <span className="text-[9px] text-emerald-400 font-mono">HDR Auto</span>
                      </div>
                    </div>
                  ) : simSubmitted ? (
                    /* 2. Submission Success Screen */
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4 space-y-3 bg-white rounded-2xl border border-slate-200 shadow-sm animate-scaleIn">
                      <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center text-2xl font-black shadow-xs">
                        ✓
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">RO {simRoNumber} Submitted!</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Transferred to Booran Warranty Review Queue with all {simulatedMandatoryGates.length} Attachment A gates sealed.
                        </p>
                      </div>
                      <div className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px] space-y-1 font-mono text-slate-700">
                        <div className="flex justify-between">
                          <span className="text-slate-500">OEM Standard:</span>
                          <span className="font-bold text-slate-900">{selectedPack?.brandName || 'BYD'} v1 Live</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Signed by:</span>
                          <span className="text-emerald-700 font-bold">{simTechName.split('(')[0]}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Package:</span>
                          <span className="text-slate-900 font-bold">{simRoNumber}_SubmissionPack.zip</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSimSubmitted(false)}
                        className="w-full py-2 rounded-xl bg-[#E11F26] hover:bg-[#c81a20] text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                      >
                        Back to Checklist
                      </button>
                    </div>
                  ) : simPhoneTab === 'CHECKLIST' ? (
                    /* 3. Interactive Checklist View */
                    <div className="flex-1 flex flex-col">
                      {/* Progress Bar Header */}
                      <div className="px-1 py-1 flex items-center justify-between text-[10px]">
                        <span className="text-slate-700 font-bold">Evidence Checklist</span>
                        <span className={isAllMandatoryCaptured ? 'text-emerald-600 font-bold' : 'text-[#E11F26] font-bold'}>
                          {capturedMandatoryCount} / {simulatedMandatoryGates.length} Captured
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-emerald-500 transition-all duration-300"
                          style={{
                            width: `${Math.round((capturedMandatoryCount / Math.max(1, simulatedMandatoryGates.length)) * 100)}%`,
                          }}
                        />
                      </div>

                      {/* Scrollable Gates */}
                      <div className="flex-1 space-y-2 max-h-[300px] overflow-y-auto pr-1 text-[11px]">
                        {simulatedGates.map((gate, idx) => {
                          const isCaptured = Boolean(simCapturedGates[gate.ruleKey]);
                          const captureInfo = simCapturedGates[gate.ruleKey];
                          const bench = getBenchmarkForRule(gate.ruleKey);
                          const targetFilename = gate.namingConvention.replace(
                            /\[DealerRONumber\]/gi,
                            simRoNumber.replace(/[^a-zA-Z0-9]/g, '') + '_'
                          );

                          return (
                            <div
                              key={gate.id || idx}
                              onClick={() => setSimActiveCameraGate(gate)}
                              className={`p-2 rounded-xl border transition-all cursor-pointer space-y-1.5 group shadow-2xs ${
                                isCaptured
                                  ? 'bg-emerald-50/70 border-emerald-300 hover:border-emerald-400'
                                  : 'bg-white border-slate-200 hover:border-[#E11F26]'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span className="font-bold text-slate-900 text-[11px] leading-tight">
                                  {gate.name}
                                </span>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                    isCaptured
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : gate.isMandatory
                                      ? 'bg-red-50 text-[#E11F26] border border-red-200'
                                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}
                                >
                                  {isCaptured ? '✓ Captured' : gate.isMandatory ? 'Required' : 'Opt'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <img
                                  src={captureInfo?.sampleImage || bench.sampleImage}
                                  alt={gate.name}
                                  className={`w-10 h-7 object-cover rounded border shrink-0 ${
                                    isCaptured ? 'border-emerald-400' : 'border-slate-200'
                                  }`}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] text-slate-600 leading-tight truncate">
                                    📸 {gate.guidanceText || gate.description}
                                  </p>
                                  {captureInfo?.ocrText && (
                                    <p className="text-[9px] text-emerald-700 font-mono font-bold truncate">
                                      OCR: {captureInfo.ocrText}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[9px] font-mono">
                                <span className="text-slate-400 truncate max-w-[130px]">
                                  {targetFilename}
                                </span>
                                <span className={isCaptured ? 'text-emerald-700 font-bold' : 'text-[#E11F26] font-bold group-hover:underline'}>
                                  {isCaptured ? 'Retake ↺' : 'Capture 📸'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Submit Button at bottom of checklist */}
                      <div className="pt-2 mt-auto border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => {
                            if (isAllMandatoryCaptured) {
                              setSimSubmitted(true);
                            } else {
                              handleCaptureAll();
                            }
                          }}
                          className={`w-full py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 ${
                            isAllMandatoryCaptured
                              ? 'bg-[#E11F26] hover:bg-[#c81a20] text-white animate-pulse'
                              : 'bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300'
                          }`}
                        >
                          <span>
                            {isAllMandatoryCaptured
                              ? '🚀 Submit to Warranty Review Queue'
                              : `Complete ${simulatedMandatoryGates.length - capturedMandatoryCount} More Gate${simulatedMandatoryGates.length - capturedMandatoryCount === 1 ? '' : 's'}`}
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 4. Wizard Step-by-Step Flow */
                    <div className="flex-1 flex flex-col justify-between space-y-2 text-[11px] p-1 animate-fadeIn">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 border-b border-slate-200 pb-1">
                          <span className="font-semibold">Technician Fast-Path Wizard</span>
                          <span className="font-mono text-[#E11F26] font-bold">Step {simWizardStep + 1} of 4</span>
                        </div>

                        {simWizardStep === 0 && (
                          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                            <span className="text-xs font-bold text-slate-900 block">Step 1: Rooftop & Vehicle Brand</span>
                            <p className="text-[10px] text-slate-600">
                              Rooftop: <strong className="text-slate-900">{simSite}</strong>
                            </p>
                            <p className="text-[10px] text-slate-600">
                              Brand: <strong className="text-slate-900">{selectedPack?.brandName || 'BYD'}</strong>
                            </p>
                            <p className="text-[10px] text-slate-600">
                              Repair Order: <strong className="text-slate-900 font-mono">{simRoNumber}</strong>
                            </p>
                          </div>
                        )}

                        {simWizardStep === 1 && (
                          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                            <span className="text-xs font-bold text-slate-900 block">Step 2: Vehicle Identity & OCR</span>
                            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 font-mono text-[10px] space-y-1">
                              <span className="text-slate-500 block font-semibold">RedBooks Decoded Profile:</span>
                              <span className="text-emerald-700 font-bold block">VIN: 2C4RDGCG0FR805928</span>
                              <span className="text-slate-900 block">2024 BYD ATTO 3 ({simPowertrain})</span>
                              <span className="text-slate-600 block">Odo: {simOdometer} km (Verified)</span>
                            </div>
                          </div>
                        )}

                        {simWizardStep === 2 && (
                          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                            <span className="text-xs font-bold text-slate-900 block">Step 3: Fault Category & Trigger</span>
                            <p className="text-[10px] text-slate-600">
                              Category: <strong className="text-slate-900">{simFaultCategory}</strong>
                            </p>
                            <p className="text-[10px] text-slate-600">
                              Part Replaced: <strong className="text-slate-900">{simPartReplaced ? 'Yes (Serials Active)' : 'No'}</strong>
                            </p>
                            <p className="text-[10px] text-slate-600">
                              Noise Complaint: <strong className="text-slate-900">{simNoiseFault ? 'Yes (Video Required)' : 'No'}</strong>
                            </p>
                          </div>
                        )}

                        {simWizardStep === 3 && (
                          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                            <span className="text-xs font-bold text-slate-900 block">Step 4: Evidence Capture Summary</span>
                            <p className="text-[10px] text-slate-600">
                              {capturedMandatoryCount} of {simulatedMandatoryGates.length} mandatory gates captured.
                            </p>
                            <button
                              type="button"
                              onClick={handleCaptureAll}
                              className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer shadow-2xs"
                            >
                              Capture All Remaining Gates
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                        <button
                          type="button"
                          disabled={simWizardStep === 0}
                          onClick={() => setSimWizardStep((prev) => Math.max(0, prev - 1))}
                          className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 disabled:opacity-30 text-slate-700 text-[10px] font-bold cursor-pointer"
                        >
                          ← Prev
                        </button>
                        {simWizardStep < 3 ? (
                          <button
                            type="button"
                            onClick={() => setSimWizardStep((prev) => Math.min(3, prev + 1))}
                            className="px-3 py-1 rounded-lg bg-[#E11F26] hover:bg-[#c81a20] text-white text-[10px] font-bold cursor-pointer shadow-2xs"
                          >
                            Next →
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSimSubmitted(true)}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer shadow-2xs"
                          >
                            Finish & Submit ✓
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Mobile Close Button Footer */}
                <div className="pt-2 mt-auto border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsSimulatorOpen(false)}
                    className="w-full py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 hover:text-slate-900 text-[10px] font-bold transition-all cursor-pointer"
                  >
                    Exit Simulator
                  </button>
                </div>
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
