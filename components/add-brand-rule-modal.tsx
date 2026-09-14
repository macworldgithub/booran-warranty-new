'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Modal } from './modal';
import { api } from '../lib/api';
import { BrandPack, BrandPackRule } from '../lib/types';
import { useToast } from './toast';

interface AddBrandRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPackId?: string;
  initialMode?: 'MANUAL' | 'IMPORT';
  onSuccess?: (pack: BrandPack) => void;
}

export function AddBrandRuleModal({
  isOpen,
  onClose,
  defaultPackId,
  initialMode = 'MANUAL',
  onSuccess,
}: AddBrandRuleModalProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'MANUAL' | 'IMPORT'>(initialMode);
  const [packs, setPacks] = useState<BrandPack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<string>(defaultPackId || '');
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Manual Form State
  const [name, setName] = useState('');
  const [ruleKey, setRuleKey] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'document'>('image');
  const [tier, setTier] = useState<number>(1);
  const [isMandatory, setIsMandatory] = useState<boolean>(true);
  const [namingConvention, setNamingConvention] = useState('');
  const [guidanceText, setGuidanceText] = useState('');
  const [triggerType, setTriggerType] = useState<'NONE' | 'PART_REPLACED' | 'NOISE' | 'DIAGNOSTIC' | 'HV_BATTERY'>('NONE');
  const [autoKey, setAutoKey] = useState(true);

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedRules, setParsedRules] = useState<Partial<BrandPackRule>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Keep mode aligned when opened with specific initialMode or defaultPackId
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      loadPacks();
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (defaultPackId) {
      setSelectedPackId(defaultPackId);
    }
  }, [defaultPackId]);

  async function loadPacks() {
    setLoadingPacks(true);
    try {
      const data = await api.getBrandPacks();
      setPacks(data);
      if (!selectedPackId && data.length > 0) {
        setSelectedPackId(defaultPackId || data[0].id);
      }
    } catch (err) {
      console.error('Failed to load brand packs for rule modal:', err);
    } finally {
      setLoadingPacks(false);
    }
  }

  // Auto-generate ruleKey & namingConvention when rule name changes
  function handleNameChange(val: string) {
    setName(val);
    if (autoKey) {
      const slug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      setRuleKey(slug);

      const camelClean = val.replace(/[^a-zA-Z0-9]/g, '');
      const ext = mediaType === 'video' ? '.mp4' : mediaType === 'document' ? '.pdf' : '.jpg';
      setNamingConvention(`[DealerRONumber]${camelClean || 'Proof'}${ext}`);
    }
  }

  function handleMediaTypeChange(newMedia: 'image' | 'video' | 'document') {
    setMediaType(newMedia);
    const ext = newMedia === 'video' ? '.mp4' : newMedia === 'document' ? '.pdf' : '.jpg';
    if (namingConvention) {
      setNamingConvention(namingConvention.replace(/\.[a-z0-9]+$/i, ext));
    }
  }

  // Handle Manual Submission
  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPackId) {
      showToast('Please select a target Brand Pack', 'error');
      return;
    }
    if (!name.trim()) {
      showToast('Rule Name is required', 'error');
      return;
    }
    if (!ruleKey.trim()) {
      showToast('Rule Key is required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const faultCategorySpecific: string[] = [];
      if (triggerType === 'HV_BATTERY') {
        faultCategorySpecific.push('Battery and high-voltage (HV) components');
      }

      const ruleData: Partial<BrandPackRule> = {
        ruleKey: ruleKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        name: name.trim(),
        description: guidanceText.trim() || name.trim(),
        mediaType,
        tier,
        isMandatory,
        namingConvention: namingConvention.trim() || `[DealerRONumber]${ruleKey}.jpg`,
        guidanceText: guidanceText.trim(),
        faultCategorySpecific,
      };

      const updated = await api.addBrandPackRule(selectedPackId, ruleData);
      showToast(`Added evidence rule "${ruleData.name}" to ${updated.name}!`, 'success');
      onSuccess?.(updated);
      handleReset();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to add rule', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Parse CSV or Excel (.xlsx, .xls)
  async function processSpreadsheetFile(file: File) {
    setImportFile(file);
    setParseErrors([]);
    setParsedRules([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        setParseErrors(['Spreadsheet contains no sheets.']);
        return;
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (rawRows.length === 0) {
        setParseErrors(['No data rows found in sheet.']);
        return;
      }

      const parsed: Partial<BrandPackRule>[] = [];
      const errors: string[] = [];

      rawRows.forEach((row, idx) => {
        const rowNum = idx + 2; // header is row 1
        // Normalize column keys
        const cleanRow: Record<string, any> = {};
        Object.keys(row).forEach((k) => {
          const normKey = k.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          cleanRow[normKey] = row[k];
        });

        const rowName =
          cleanRow['rulename'] ||
          cleanRow['name'] ||
          cleanRow['gatename'] ||
          cleanRow['title'] ||
          '';

        if (!rowName) {
          errors.push(`Row ${rowNum}: Skipped because "Rule Name" column is empty.`);
          return;
        }

        let rowKey =
          cleanRow['rulekey'] ||
          cleanRow['key'] ||
          rowName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');

        let rowMedia: 'image' | 'video' | 'document' = 'image';
        const mediaVal = String(cleanRow['mediatype'] || cleanRow['media'] || cleanRow['type'] || '').toLowerCase();
        if (mediaVal.includes('vid')) rowMedia = 'video';
        else if (mediaVal.includes('doc') || mediaVal.includes('pdf') || mediaVal.includes('dtc')) rowMedia = 'document';

        const tierVal = Number(cleanRow['tier'] || cleanRow['level'] || 1) === 2 ? 2 : 1;

        const mandValRaw = String(cleanRow['mandatory'] || cleanRow['ismandatory'] || cleanRow['required'] || 'true').toLowerCase();
        const rowMandatory = mandValRaw === 'true' || mandValRaw === 'yes' || mandValRaw === '1' || mandValRaw === 'y';

        const ext = rowMedia === 'video' ? '.mp4' : rowMedia === 'document' ? '.pdf' : '.jpg';
        const defaultNaming = `[DealerRONumber]${rowName.replace(/[^a-zA-Z0-9]/g, '') || 'Proof'}${ext}`;
        const rowNaming = cleanRow['namingconvention'] || cleanRow['naming'] || cleanRow['filename'] || defaultNaming;

        const rowGuidance = cleanRow['viewfinderguidance'] || cleanRow['guidance'] || cleanRow['description'] || cleanRow['hud'] || '';

        const triggerVal = String(cleanRow['trigger'] || cleanRow['triggercondition'] || '').toLowerCase();
        const faultCategorySpecific: string[] = [];
        if (triggerVal.includes('hv') || triggerVal.includes('battery')) {
          faultCategorySpecific.push('Battery and high-voltage (HV) components');
        }

        parsed.push({
          ruleKey: String(rowKey).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
          name: String(rowName).trim(),
          description: String(rowGuidance || rowName).trim(),
          mediaType: rowMedia,
          tier: tierVal,
          isMandatory: rowMandatory,
          namingConvention: String(rowNaming).trim(),
          guidanceText: String(rowGuidance).trim(),
          faultCategorySpecific,
        });
      });

      setParsedRules(parsed);
      setParseErrors(errors);

      if (parsed.length > 0) {
        showToast(`Parsed ${parsed.length} rules from ${file.name}!`, 'info');
      } else {
        showToast('No valid rule rows could be extracted.', 'error');
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      setParseErrors([`Failed to read spreadsheet: ${err.message || 'Invalid format'}`]);
    }
  }

  // Download Sample Template (.xlsx or .csv)
  function handleDownloadTemplate(format: 'xlsx' | 'csv') {
    const sampleData = [
      {
        'Rule Name': 'Inverter Coolant Flow Rate Photo',
        'Rule Key': 'inverter_coolant_flow',
        'Media Type': 'image',
        'Tier': 1,
        'Mandatory': 'TRUE',
        'Naming Convention': '[DealerRONumber]InverterCoolant.jpg',
        'Viewfinder Guidance': 'Clear photo showing flow gauge needle or reservoir level with zero reflections.',
        'Trigger': 'None',
      },
      {
        'Rule Name': 'Regenerative Braking Deceleration Audio Video',
        'Rule Key': 'regen_braking_sweep',
        'Media Type': 'video',
        'Tier': 2,
        'Mandatory': 'FALSE',
        'Naming Convention': '[DealerRONumber]RegenSweep.mp4',
        'Viewfinder Guidance': '15-second road test video capturing deceleration motor whine under regen.',
        'Trigger': 'Noise / Rattle',
      },
      {
        'Rule Name': 'High Voltage Battery Enclosure Gasket Seal',
        'Rule Key': 'hv_battery_gasket_seal',
        'Media Type': 'image',
        'Tier': 2,
        'Mandatory': 'TRUE',
        'Naming Convention': '[DealerRONumber]HVGasketSeal.jpg',
        'Viewfinder Guidance': 'Perimeter macro photo showing seal bead continuous with no pinch defects.',
        'Trigger': 'HV Battery Component',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Evidence Rules');

    if (format === 'csv') {
      XLSX.writeFile(workbook, 'Booran_OEM_Evidence_Rules_Template.csv', { bookType: 'csv' });
    } else {
      XLSX.writeFile(workbook, 'Booran_OEM_Evidence_Rules_Template.xlsx', { bookType: 'xlsx' });
    }
    showToast(`Downloaded sample rules template (${format.toUpperCase()})`, 'info');
  }

  // Handle Batch Import Submission
  async function handleBatchSubmit() {
    if (!selectedPackId) {
      showToast('Please select a target Brand Pack', 'error');
      return;
    }
    if (parsedRules.length === 0) {
      showToast('No rules to import. Please upload a spreadsheet.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const updated = await api.batchAddBrandPackRules(selectedPackId, parsedRules);
      showToast(
        `Successfully imported ${parsedRules.length} rules into ${updated.name}!`,
        'success'
      );
      onSuccess?.(updated);
      handleReset();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Batch import failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setName('');
    setRuleKey('');
    setMediaType('image');
    setTier(1);
    setIsMandatory(true);
    setNamingConvention('');
    setGuidanceText('');
    setTriggerType('NONE');
    setImportFile(null);
    setParsedRules([]);
    setParseErrors([]);
  }

  const selectedPack = packs.find((p) => p.id === selectedPackId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="OEM Evidence Rules Engine — Add & Import Rules"
      maxWidth="4xl"
    >
      <div className="space-y-5">
        {/* Top Control Bar: Brand Pack Selector + Mode Switcher */}
        <div className="p-4 rounded-xl bg-[#081225] border border-[#1a56db]/25 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                Target Brand Pack:
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedPackId}
                  onChange={(e) => setSelectedPackId(e.target.value)}
                  disabled={loadingPacks}
                  className="bg-[#0d1b3e] border border-[#1a56db]/40 rounded-lg px-3 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-[#00f0ff] min-w-[260px]"
                >
                  {packs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.brandName || 'Multi-Brand'} — {p.name} (v{p.version} · {p.status || 'Active'})
                    </option>
                  ))}
                </select>
                {selectedPack && (
                  <span className="px-2 py-0.5 rounded bg-[#00f0ff]/10 text-[#00f0ff] text-[10px] font-mono font-bold border border-[#00f0ff]/30">
                    {selectedPack.rules?.length || 0} Current Rules
                  </span>
                )}
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex rounded-lg bg-[#0d1b3e] p-1 border border-[#1a56db]/30 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setMode('MANUAL')}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'MANUAL'
                    ? 'bg-[#1a56db] text-white shadow-md'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <span>➕ Add Single Rule</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('IMPORT')}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'IMPORT'
                    ? 'bg-[#1a56db] text-white shadow-md'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <span>📁 Upload CSV / Excel</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── MODE 1: MANUAL ADD SINGLE RULE ── */}
        {mode === 'MANUAL' && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Rule Name */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-white font-bold flex items-center justify-between">
                  <span>Evidence Rule Name *</span>
                  <span className="text-[10px] text-[#64748b] font-normal">
                    Displayed in technician mobile camera & checklist
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inverter Coolant Flow Rate Photo"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#081225] border border-[#1a56db]/30 text-white placeholder-[#64748b] focus:outline-none focus:border-[#00f0ff]"
                />
              </div>

              {/* Rule Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-white font-bold">Rule Identifier Key *</label>
                  <label className="text-[10px] text-[#00f0ff] flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoKey}
                      onChange={(e) => setAutoKey(e.target.checked)}
                      className="rounded"
                    />
                    <span>Auto-slug</span>
                  </label>
                </div>
                <input
                  type="text"
                  required
                  placeholder="inverter_coolant_flow"
                  value={ruleKey}
                  readOnly={autoKey}
                  onChange={(e) => setRuleKey(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl bg-[#081225] border border-[#1a56db]/30 font-mono text-xs text-[#00f0ff] focus:outline-none focus:border-[#00f0ff] ${
                    autoKey ? 'opacity-80' : ''
                  }`}
                />
              </div>

              {/* Media Type */}
              <div className="space-y-1.5">
                <label className="text-white font-bold">Media Type *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleMediaTypeChange('image')}
                    className={`py-2 px-2 rounded-xl text-center font-bold text-xs transition-all border cursor-pointer ${
                      mediaType === 'image'
                        ? 'bg-[#1a56db]/40 border-[#00f0ff] text-white shadow-[0_0_15px_rgba(0,240,255,0.25)]'
                        : 'bg-[#081225] border-[#1a56db]/20 text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    📷 Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMediaTypeChange('video')}
                    className={`py-2 px-2 rounded-xl text-center font-bold text-xs transition-all border cursor-pointer ${
                      mediaType === 'video'
                        ? 'bg-[#1a56db]/40 border-[#00f0ff] text-white shadow-[0_0_15px_rgba(0,240,255,0.25)]'
                        : 'bg-[#081225] border-[#1a56db]/20 text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    📹 Video
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMediaTypeChange('document')}
                    className={`py-2 px-2 rounded-xl text-center font-bold text-xs transition-all border cursor-pointer ${
                      mediaType === 'document'
                        ? 'bg-[#1a56db]/40 border-[#00f0ff] text-white shadow-[0_0_15px_rgba(0,240,255,0.25)]'
                        : 'bg-[#081225] border-[#1a56db]/20 text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    📄 DTC / PDF
                  </button>
                </div>
              </div>

              {/* Tier & Mandatory */}
              <div className="space-y-1.5">
                <label className="text-white font-bold">Evidence Standard Tier</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTier(1)}
                    className={`py-2 px-3 rounded-xl text-center font-bold text-xs border cursor-pointer transition-all ${
                      tier === 1
                        ? 'bg-[#10b981]/20 border-[#10b981] text-[#10b981]'
                        : 'bg-[#081225] border-[#1a56db]/20 text-[#64748b]'
                    }`}
                  >
                    Tier 1 Core Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setTier(2)}
                    className={`py-2 px-3 rounded-xl text-center font-bold text-xs border cursor-pointer transition-all ${
                      tier === 2
                        ? 'bg-[#f59e0b]/20 border-[#f59e0b] text-[#f59e0b]'
                        : 'bg-[#081225] border-[#1a56db]/20 text-[#64748b]'
                    }`}
                  >
                    Tier 2 Defect Specific
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-white font-bold">Gate Enforcement</label>
                <div
                  onClick={() => setIsMandatory(!isMandatory)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    isMandatory
                      ? 'bg-red-950/20 border-red-500/40 text-red-300'
                      : 'bg-[#081225] border-[#1a56db]/20 text-[#94a3b8]'
                  }`}
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-xs">
                      {isMandatory ? 'Mandatory Gate (Blocks submission)' : 'Optional Recommendation'}
                    </p>
                    <p className="text-[10px] text-[#64748b]">
                      {isMandatory ? 'Tech must submit before repair start' : 'Suggested for clerk review'}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center font-bold text-xs ${
                      isMandatory ? 'bg-red-500 text-white' : 'bg-[#132952] text-[#64748b]'
                    }`}
                  >
                    {isMandatory ? '✓' : ''}
                  </div>
                </div>
              </div>

              {/* Dynamic Trigger */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-white font-bold flex items-center justify-between">
                  <span>Dynamic Trigger Condition</span>
                  <span className="text-[10px] text-[#94a3b8]">When should this rule appear in mobile wizard?</span>
                </label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-[#081225] border border-[#1a56db]/30 text-white focus:outline-none focus:border-[#00f0ff]"
                >
                  <option value="NONE">Universal (Always required for all jobs)</option>
                  <option value="PART_REPLACED">Trigger: Part Replaced (Serial / Part tags)</option>
                  <option value="NOISE">Trigger: Noise / Vibration / Rattle symptom reported</option>
                  <option value="DIAGNOSTIC">Trigger: Diagnostic Scanner DTC available</option>
                  <option value="HV_BATTERY">Trigger: High-Voltage (HV) / Traction Battery Component fault</option>
                </select>
              </div>

              {/* Target OEM Filename */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-white font-bold flex items-center justify-between">
                  <span>Target OEM ZIP Filename Convention *</span>
                  <span className="text-[10px] text-[#64748b] font-mono">[DealerRONumber] will be replaced</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="[DealerRONumber]InverterCoolant.jpg"
                  value={namingConvention}
                  onChange={(e) => setNamingConvention(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#081225] border border-[#1a56db]/30 text-white font-mono text-xs focus:outline-none focus:border-[#00f0ff]"
                />
              </div>

              {/* Viewfinder Guidance HUD */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-white font-bold">Mobile Viewfinder HUD Instructions</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Ensure barcode and stamped numbers fill 70%+ of viewfinder. Avoid glare."
                  value={guidanceText}
                  onChange={(e) => setGuidanceText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#081225] border border-[#1a56db]/30 text-white placeholder-[#64748b] focus:outline-none focus:border-[#00f0ff]"
                />
              </div>
            </div>

            {/* Footer Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1a56db]/20">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost text-xs py-2 px-4 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary text-xs py-2 px-6 shadow-[0_0_20px_rgba(26,86,219,0.4)] cursor-pointer flex items-center gap-1.5"
              >
                {submitting ? (
                  <span>Saving Rule...</span>
                ) : (
                  <>
                    <span>Save Rule to Brand Pack</span>
                    <span>➔</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ── MODE 2: SPREADSHEET IMPORT (CSV & EXCEL) ── */}
        {mode === 'IMPORT' && (
          <div className="space-y-4">
            {/* Template Download & Drag-and-Drop Uploader */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#081225] border border-[#1a56db]/20 text-xs">
              <div>
                <p className="font-bold text-white">Need the correct column format?</p>
                <p className="text-[#94a3b8] text-[11px]">
                  Download our pre-formatted spreadsheet template with sample automotive gates.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('xlsx')}
                  className="px-3 py-1.5 rounded-lg bg-[#10b981]/20 hover:bg-[#10b981]/30 text-[#10b981] font-bold border border-[#10b981]/40 flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <span>📊 Template (.XLSX)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('csv')}
                  className="px-3 py-1.5 rounded-lg bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] font-bold border border-[#00f0ff]/30 flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <span>📄 Template (.CSV)</span>
                </button>
              </div>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  processSpreadsheetFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-[#00f0ff] bg-[#00f0ff]/10'
                  : 'border-[#1a56db]/40 bg-[#081225]/60 hover:border-[#00f0ff]/60 hover:bg-[#081225]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    processSpreadsheetFile(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 rounded-2xl bg-[#1a56db]/20 border border-[#1a56db]/40 text-[#00f0ff] flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="font-bold text-white text-sm">
                {importFile ? importFile.name : 'Click to Browse or Drag & Drop Spreadsheet'}
              </p>
              <p className="text-xs text-[#64748b] mt-1">
                Supports Microsoft Excel (<strong>.xlsx, .xls</strong>) and Comma-Separated Values (<strong>.csv</strong>)
              </p>
            </div>

            {/* Error Messages */}
            {parseErrors.length > 0 && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/40 text-xs text-red-200 space-y-1">
                <p className="font-bold text-red-300">Spreadsheet Validation Warnings:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  {parseErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Live Parsed Preview Table */}
            {parsedRules.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">Parsed Evidence Gates Preview:</span>
                    <span className="px-2 py-0.5 rounded bg-[#10b981]/20 text-[#10b981] font-mono font-bold text-[11px] border border-[#10b981]/30">
                      {parsedRules.length} Rules Ready
                    </span>
                    <span className="text-[#94a3b8] text-[11px]">
                      ({parsedRules.filter((r) => r.isMandatory).length} Mandatory)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setImportFile(null);
                      setParsedRules([]);
                    }}
                    className="text-[#ef4444] hover:underline text-[11px] font-semibold cursor-pointer"
                  >
                    Clear Spreadsheet
                  </button>
                </div>

                <div className="max-h-[220px] overflow-y-auto border border-[#1a56db]/20 rounded-xl bg-[#081225]">
                  <table className="w-full text-left text-xs text-[#cbd5e1]">
                    <thead className="border-b border-[#1a56db]/20 text-[#64748b] uppercase tracking-wider font-semibold bg-[#0d1b3e] sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Rule Name</th>
                        <th className="py-2.5 px-3">Identifier Key</th>
                        <th className="py-2.5 px-3 text-center">Media</th>
                        <th className="py-2.5 px-3 text-center">Tier</th>
                        <th className="py-2.5 px-3 text-center">Gate</th>
                        <th className="py-2.5 px-3">Naming Convention</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a56db]/10">
                      {parsedRules.map((rule, idx) => (
                        <tr key={idx} className="hover:bg-[#132952]/40 transition-colors">
                          <td className="py-2 px-3 font-semibold text-white">
                            {rule.name}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-[#00f0ff]">
                            {rule.ruleKey}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-1.5 py-0.5 rounded bg-[#132952] text-[10px] font-mono uppercase text-[#cbd5e1]">
                              {rule.mediaType === 'video' ? '📹 Video' : rule.mediaType === 'document' ? '📄 DTC' : '📷 Photo'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-[10px]">
                            Tier {rule.tier}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {rule.isMandatory ? (
                              <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold text-[9px] border border-red-500/40">
                                Mandatory
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-[#64748b]/20 text-[#cbd5e1] text-[9px]">
                                Optional
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-[10px] text-[#94a3b8] truncate max-w-[180px]">
                            {rule.namingConvention}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Import Footer Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#1a56db]/20 text-xs">
              <p className="text-[#64748b]">
                Target: <strong className="text-white">{selectedPack?.name || 'Selected Brand Pack'}</strong>
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-ghost text-xs py-2 px-4 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting || parsedRules.length === 0}
                  onClick={handleBatchSubmit}
                  className={`text-xs py-2 px-6 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                    parsedRules.length > 0
                      ? 'btn-primary shadow-[0_0_20px_rgba(26,86,219,0.4)]'
                      : 'bg-[#132952] text-[#64748b] cursor-not-allowed'
                  }`}
                >
                  {submitting ? (
                    <span>Importing Rules...</span>
                  ) : (
                    <>
                      <span>Import {parsedRules.length} Rules into Pack</span>
                      <span>➔</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
