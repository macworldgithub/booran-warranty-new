'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '../../../../components/header';
import { StatusBadge } from '../../../../components/status-badge';
import { Modal } from '../../../../components/modal';
import { useToast } from '../../../../components/toast';
import { api } from '../../../../lib/api';
import { WarrantyCase, FlagReasonCode, SubmissionPackResponse } from '../../../../lib/types';

const RULE_NAMES: Record<string, string> = {
  vin_photo: 'VIN Plate Photo',
  odometer_photo: 'Odometer Cluster Photo',
  front_vehicle_photo: 'Front of Vehicle Reference',
  fault_closeup: 'Fault Close-up Photo',
  fault_location: 'Defect / Fault Location Photo',
  old_part_serial: 'Old Part Serial Barcode',
  new_part_serial: 'New Part Serial Barcode',
  before_repair: 'Before Repair Photo',
  after_repair: 'After Repair Photo',
  diagnostic_evidence: 'Diagnostic / DTC Screenshot',
  noise_video: 'Noise / Audio Recording (.mp4)',
  tier2_hv_isolation: 'HV Battery Isolation Test Proof',
};

const REASON_DESCRIPTIONS: Record<string, string> = {
  POOR_LIGHTING_BLUR: 'Blurry, dark, or glare obscuring defect',
  WRONG_ANGLE: 'Too close or missing assembly context',
  UNREADABLE_VIN: 'VIN characters obscured or unreadable',
  NO_SERIAL: 'Part barcode / serial number missing',
  NO_DTC: 'Diagnostic scan / DTC report missing',
  VIDEO_TOO_SHORT: 'Under minimum required duration',
  MISSING_SHOT: 'Mandatory OEM shot was omitted',
  INCORRECT_MEDIA_TYPE: 'Wrong file format or missing audio',
  OTHER: 'Discrepancy noted by warranty clerk',
};

const REASON_TIPS: Record<string, string> = {
  POOR_LIGHTING_BLUR: 'Clean workshop grime off camera lens and use a workshop torch or flash to illuminate the defect.',
  WRONG_ANGLE: 'Step back approximately 1 meter to capture the surrounding subframe or assembly context.',
  UNREADABLE_VIN: 'Ensure all 17 VIN characters are square in frame with no reflections or shadows.',
  NO_SERIAL: 'Capture a clear macro photo of both the barcode/QR code and human-readable serial numbers.',
  NO_DTC: 'Capture diagnostic scanner screen showing active DTC codes and freeze-frame parameters.',
  VIDEO_TOO_SHORT: 'Capture at least 15–30 seconds of audio/video demonstrating the operational or noise concern.',
  MISSING_SHOT: 'Capture the missing mandatory shot in accordance with BYD-WB-2602-02 Attachment A rules.',
  INCORRECT_MEDIA_TYPE: 'Ensure container is an MP4 video or JPEG image as specified by OEM rules.',
};

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const caseId = params?.id as string;

  const [caseData, setCaseData] = useState<WarrantyCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [userName, setUserName] = useState<string>('');

  // Modals
  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [packModalOpen, setPackModalOpen] = useState(false);
  const [packData, setPackData] = useState<SubmissionPackResponse | null>(null);

  // Flag Form
  const [flagRuleKey, setFlagRuleKey] = useState('');
  const [flagReason, setFlagReason] = useState<FlagReasonCode>('WRONG_ANGLE');
  const [flagInstruction, setFlagInstruction] = useState('');

  // Submit Form
  const [claimNumber, setClaimNumber] = useState('');
  const [clerkNote, setClerkNote] = useState('');

  // Retake & Evidence Upload State
  const [retakeModalOpen, setRetakeModalOpen] = useState(false);
  const [uploadRuleKey, setUploadRuleKey] = useState('fault_location');
  const [uploadName, setUploadName] = useState('Defect / Fault Location Photo');
  const [uploadMediaType, setUploadMediaType] = useState<'image' | 'video' | 'document'>('image');
  const [uploadStorageUrl, setUploadStorageUrl] = useState('');
  const [uploadOcrText, setUploadOcrText] = useState('');
  const [uploadInstruction, setUploadInstruction] = useState('');
  const [uploadReasonCode, setUploadReasonCode] = useState('');
  const [uploadPreviousPhotoUrl, setUploadPreviousPhotoUrl] = useState('');
  const [uploadTechnicianNote, setUploadTechnicianNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [fixConfirmed, setFixConfirmed] = useState(false);
  // Selected File for real upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('booran_user') || localStorage.getItem('booran_user_profile');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          setUserRole(user.role || '');
          setUserName(user.name || '');
        } catch {
          // ignore
        }
      }
    }
  }, []);

  useEffect(() => {
    if (caseId) loadCase();
  }, [caseId]);

  // Check URL parameters for direct retake action prompt (e.g. ?retake=true or ?retakeRule=...)
  // Check URL parameters for direct retake action prompt (e.g. ?retake=true or ?retakeRule=...)
  useEffect(() => {
    if (caseData && typeof window !== 'undefined') {
      // Admins and Clerks are only supposed to flag, never re-upload or retake
      if (userRole !== 'TECHNICIAN') return;

      const urlParams = new URLSearchParams(window.location.search);
      const shouldRetake = urlParams.get('retake');
      const targetRule = urlParams.get('retakeRule');

      if (shouldRetake || targetRule) {
        const flags = caseData.flagHistory || caseData.flags || [];
        const activeFlags = flags.filter((f) => !f.resolvedAt);
        const targetFlag = targetRule
          ? activeFlags.find((f) => f.evidenceRuleKey === targetRule)
          : activeFlags[0];

        if (targetFlag) {
          const evidence = caseData.evidenceItems || caseData.evidence || [];
          const matchedEv = evidence.find((e) => e.ruleKey === targetFlag.evidenceRuleKey);
          handleOpenRetakeModal(
            targetFlag.evidenceRuleKey,
            matchedEv?.name,
            targetFlag.instruction,
            targetFlag.reasonCode,
            matchedEv?.storageUrl
          );
        }
      }
    }
  }, [caseData, userRole]);

  async function loadCase() {
    setLoading(true);
    try {
      const res = await api.getCase(caseId);
      setCaseData(res);
      if (res.claimNumber) setClaimNumber(res.claimNumber);
    } catch (err) {
      console.error('Failed to load case:', err);
      showToast('Case not found', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleFlagSubmit() {
    if (!flagInstruction.trim()) {
      showToast('Please provide instructions for the technician', 'error');
      return;
    }
    try {
      const adminName = userName ? `${userName} (Warranty Admin)` : 'Warranty Admin';
      const updated = await api.flagCase(caseId, {
        evidenceRuleKey: flagRuleKey || 'fault_location',
        reasonCode: flagReason,
        instruction: flagInstruction,
        flaggedBy: adminName,
      });
      setCaseData(updated);
      setFlagModalOpen(false);
      showToast('Case flagged and returned to technician queue', 'error');
    } catch (err: any) {
      showToast(err.message || 'Flag failed', 'error');
    }
  }

  async function handleMarkSubmitted() {
    const flags = caseData?.flagHistory || caseData?.flags || [];
    const unresolved = flags.filter((f) => !f.resolvedAt);
    if (unresolved.length > 0) {
      showToast(
        `Cannot approve & submit: Case has ${unresolved.length} unresolved reject reason(s). All rejected evidence must be retaken and fixed first.`,
        'error'
      );
      return;
    }
    if (!claimNumber.trim()) {
      showToast('Please enter the OEM Claim / Approval number', 'error');
      return;
    }
    try {
      const updated = await api.markSubmitted(caseId, {
        claimNumber,
        clerkNote,
      });
      setCaseData(updated);
      setSubmitModalOpen(false);
      showToast('Case marked as Submitted to OEM Portal!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Submission failed', 'error');
    }
  }

  async function handleGeneratePack() {
    try {
      const pack = await api.getSubmissionPack(caseId);
      setPackData(pack);
      setPackModalOpen(true);
      showToast('OEM Submission ZIP & Summary PDF prepared!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate pack', 'error');
    }
  }

  async function handleSubmitFromWorkshop() {
    const flags = caseData?.flagHistory || caseData?.flags || [];
    const unresolved = flags.filter((f) => !f.resolvedAt);
    if (unresolved.length > 0) {
      const reasons = unresolved
        .map((f) => `"${RULE_NAMES[f.evidenceRuleKey] || f.evidenceRuleKey}" (${f.reasonCode})`)
        .join(', ');
      showToast(
        `Cannot submit: Reject reason (${reasons}) must be fixed first by retaking the photo.`,
        'error'
      );
      return;
    }
    try {
      const updated = await api.submitFromWorkshop(caseId);
      setCaseData(updated);
      showToast('Case successfully submitted to Warranty Clerk Review Queue!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Submission failed', 'error');
    }
  }

  function handleOpenRetakeModal(
    ruleKey: string,
    name?: string,
    instruction?: string,
    reasonCode?: string,
    prevPhotoUrl?: string
  ) {
    if (userRole !== 'TECHNICIAN') {
      showToast('Admin and Clerks are only authorized to review and flag cases, not upload or retake images.', 'error');
      return;
    }

    setUploadRuleKey(ruleKey);
    const resolvedName = name || RULE_NAMES[ruleKey] || ruleKey.replace(/_/g, ' ').toUpperCase();
    setUploadName(resolvedName);
    setUploadInstruction(instruction || '');
    setUploadReasonCode(reasonCode || '');

    if (prevPhotoUrl) {
      setUploadPreviousPhotoUrl(prevPhotoUrl);
    } else {
      const items = caseData?.evidenceItems || caseData?.evidence || [];
      const match = items.find((e) => e.ruleKey === ruleKey);
      setUploadPreviousPhotoUrl(match?.storageUrl || '');
    }

    setUploadStorageUrl('');
    setUploadOcrText('');
    setUploadTechnicianNote('');
    setFixConfirmed(false);
    setSelectedFile(null);
    setPreviewUrl('');
    setRetakeModalOpen(true);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    // Generate local preview URL for the UI (does not go to server)
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    // Keep uploadStorageUrl non-empty so submit button knows a file is ready
    setUploadStorageUrl(objectUrl);
  }

  async function handleSubmitRetake() {
    if (!selectedFile) {
      showToast('Please select a file to upload', 'error');
      return;
    }

    if (uploadReasonCode && !fixConfirmed) {
      showToast('Please check the confirmation box verifying that this new photo fixes the rejection reason.', 'error');
      return;
    }

    setUploading(true);
    try {
      const updated = await api.uploadEvidenceFile(
        caseId,
        selectedFile,
        uploadRuleKey,
        uploadName,
        uploadOcrText || undefined,
      );
      setCaseData(updated);
      // Release the object URL to free memory
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setRetakeModalOpen(false);
      showToast(
        uploadReasonCode
          ? `Evidence replaced for "${uploadName}"! Reject reason resolved and ticket returned to Review.`
          : `Evidence for "${uploadName}" uploaded successfully.`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to upload evidence', 'error');
    } finally {
      setUploading(false);
    }
  }

  if (loading || !caseData) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-[#00f0ff]/30 border-t-[#00f0ff] rounded-full animate-spin" />
        <p className="text-xs text-[#64748b]">Loading case details...</p>
      </div>
    );
  }

  const completedMandatory = caseData.checklistSummary?.completedMandatory ?? 0;
  const totalMandatory = caseData.checklistSummary?.totalMandatory ?? 1;
  const gatePercent = Math.round((completedMandatory / (totalMandatory || 1)) * 100);

  const evidenceList = caseData.evidenceItems || caseData.evidence || [];
  const flagsList = caseData.flagHistory || caseData.flags || [];
  const unresolvedFlags = flagsList.filter((f) => !f.resolvedAt);
  const hasUnresolvedFlags = unresolvedFlags.length > 0;

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title={`Case: ${caseData.roNumber}`}
        subtitle={`${caseData.brandName} · ${caseData.siteName} · Tech: ${caseData.technicianName}`}
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/cases"
              className="btn-ghost text-xs py-2 px-3"
            >
              ← Back to Queue
            </Link>

            {/* Clerk & Admin Review Controls - NOT shown on Technician Role */}
            {userRole !== 'TECHNICIAN' && (
              <>
                <button
                  onClick={handleGeneratePack}
                  className="btn-ghost text-xs py-2 px-3 border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/10 flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Export OEM ZIP Pack</span>
                </button>
                {caseData.status !== 'Submitted' && (
                  <>
                    <button
                      onClick={() => setFlagModalOpen(true)}
                      className="btn-danger text-xs py-2 px-3 flex items-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>Flag for Retake</span>
                    </button>
                    <button
                      onClick={() => {
                        if (hasUnresolvedFlags) {
                          showToast(`Cannot approve case: ${unresolvedFlags.length} reject reason(s) must be fixed first.`, 'error');
                          return;
                        }
                        setSubmitModalOpen(true);
                      }}
                      disabled={hasUnresolvedFlags}
                      className={`text-xs py-2 px-4 flex items-center gap-1.5 rounded-xl font-bold transition-all ${
                        hasUnresolvedFlags
                          ? 'opacity-50 cursor-not-allowed bg-gray-800 text-gray-400 border border-gray-700'
                          : 'btn-success shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                      }`}
                      title={hasUnresolvedFlags ? `Approval blocked: ${unresolvedFlags.length} reject reason(s) pending retake` : 'Approve and submit to OEM'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={hasUnresolvedFlags ? "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" : "M5 13l4 4L19 7"} />
                      </svg>
                      <span>{hasUnresolvedFlags ? '🔒 Approve Blocked (Flagged)' : 'Approve & Submit'}</span>
                    </button>
                  </>
                )}
              </>
            )}

            {/* Technician Workshop Control - Submit to clerk when ready */}
            {userRole === 'TECHNICIAN' && (caseData.status === 'Draft' || caseData.status === 'Flagged') && (
              <button
                onClick={handleSubmitFromWorkshop}
                disabled={hasUnresolvedFlags}
                className={`text-xs py-2 px-4 flex items-center gap-1.5 rounded-xl font-bold transition-all ${
                  hasUnresolvedFlags
                    ? 'bg-red-950/80 text-red-300 border border-red-500/50 cursor-not-allowed opacity-90 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                    : 'btn-primary shadow-[0_0_20px_rgba(0,240,255,0.3)]'
                }`}
                title={hasUnresolvedFlags ? `Submit locked: ${unresolvedFlags.length} reject reason(s) must be retaken first` : 'Submit to Clerk Review'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={hasUnresolvedFlags ? "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" : "M5 13l4 4L19 7"} />
                </svg>
                <span>{hasUnresolvedFlags ? `🔒 Submit Locked (${unresolvedFlags.length} Reject Reasons)` : 'Submit to Clerk Review'}</span>
              </button>
            )}
          </div>
        }
      />

      <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
        {/* Dedicated Workshop Retake Alert (Spec §6, §8.3) */}
        {flagsList.filter((f) => !f.resolvedAt).length > 0 && (
          <div className="p-6 rounded-2xl bg-gradient-to-r from-red-950/90 via-[#1c080e] to-[#081225] border-2 border-red-500/80 shadow-[0_0_35px_rgba(239,68,68,0.35)] space-y-4 animate-slideInLeft">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-500/30 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-red-600/30 border border-red-500 flex items-center justify-center text-red-400 animate-pulse">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white font-mono text-[10px] font-extrabold uppercase tracking-wider shadow">
                      {userRole === 'TECHNICIAN' ? 'ACTION REQUIRED · SPEC §6 / §8.3' : 'WORKSHOP ACTION PENDING'}
                    </span>
                    <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                      {userRole === 'TECHNICIAN' ? 'Warranty Clerk Flagged Evidence For Retake' : 'Flagged Discrepancies Pending Workshop Retake'}
                    </h2>
                  </div>
                  <p className="text-xs text-red-200/90 mt-0.5">
                    {userRole === 'TECHNICIAN'
                      ? `Clerk noted discrepancies on ${flagsList.filter((f) => !f.resolvedAt).length} item(s). Follow instructions below to retake photos. Uploading replacement automatically resolves the flag and resubmits to clerk review queue.`
                      : `Discrepancies flagged on ${flagsList.filter((f) => !f.resolvedAt).length} item(s). The workshop technician must capture and upload replacement evidence to resolve the reject reason(s).`}
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 text-xs font-bold font-mono">
                {flagsList.filter((f) => !f.resolvedAt).length} Action(s) Required
              </span>
            </div>

            <div className="space-y-3">
              {flagsList
                .filter((f) => !f.resolvedAt)
                .map((flag, idx) => {
                  const matchingItem = evidenceList.find((e) => e.ruleKey === flag.evidenceRuleKey);
                  const itemName = matchingItem?.name || RULE_NAMES[flag.evidenceRuleKey] || flag.evidenceRuleKey;
                  const reasonLabel = REASON_DESCRIPTIONS[flag.reasonCode] || flag.reasonCode;

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-black/40 border border-red-500/50 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-red-400"
                    >
                      <div className="flex items-start gap-3.5">
                        {matchingItem?.storageUrl && (
                          <div className="w-16 h-16 rounded-lg overflow-hidden border border-red-500/50 bg-black flex-shrink-0 relative">
                            <img src={matchingItem.storageUrl} alt={itemName} className="w-full h-full object-cover opacity-80" />
                            <span className="absolute inset-0 bg-red-950/60 flex items-center justify-center text-[9px] font-bold text-red-300 uppercase">
                              Flagged
                            </span>
                          </div>
                        )}
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-white">{itemName}</span>
                            <span className="px-2 py-0.5 rounded bg-red-900/70 border border-red-500/50 text-red-300 font-mono text-[11px] font-semibold">
                              {flag.reasonCode}
                            </span>
                            <span className="text-[11px] text-gray-400">({reasonLabel})</span>
                          </div>
                          <div className="text-xs text-white bg-red-950/50 border-l-2 border-red-500 px-3 py-1.5 rounded-r">
                            <span className="text-red-300 font-semibold block text-[10px] uppercase tracking-wider">
                              Clerk Instruction:
                            </span>
                            <p className="italic font-medium">"{flag.instruction}"</p>
                          </div>
                          <p className="text-[10px] text-gray-400">
                            Flagged by <strong className="text-gray-200">{flag.flaggedBy}</strong> · {new Date(flag.flaggedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {userRole === 'TECHNICIAN' ? (
                          <button
                            type="button"
                            onClick={() => handleOpenRetakeModal(flag.evidenceRuleKey, itemName, flag.instruction, flag.reasonCode, matchingItem?.storageUrl)}
                            className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all transform hover:scale-[1.02]"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>Retake / Replace Photo</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold font-mono">
                            ⏳ Waiting for Technician Retake
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Top Summary Banner */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Vehicle Info */}
          <div className="glass-card-static p-5 border border-[#1a56db]/20 space-y-2">
            <span className="text-[10px] text-[#64748b] font-bold uppercase tracking-wider">Vehicle Details</span>
            <p className="text-base font-extrabold text-white">
              {caseData.year} {caseData.make} {caseData.model}
            </p>
            <div className="space-y-1 font-mono text-xs">
              <p className="text-[#cbd5e1] flex justify-between">
                <span className="text-[#64748b]">VIN:</span>
                <strong className="text-white tracking-wider">{caseData.vin}</strong>
              </p>
              <p className="text-[#cbd5e1] flex justify-between">
                <span className="text-[#64748b]">Odometer:</span>
                <span>{(caseData.odometer ?? caseData.vehicle?.odometer ?? 0).toLocaleString()} km</span>
              </p>
              <p className="text-[#cbd5e1] flex justify-between">
                <span className="text-[#64748b]">Powertrain:</span>
                <span className="px-1.5 py-0.2 rounded bg-[#1a56db]/20 text-[#00f0ff] font-sans font-semibold">
                  {caseData.powertrain}
                </span>
              </p>
            </div>
          </div>

          {/* Fault Category & Concern */}
          <div className="glass-card-static p-5 border border-[#1a56db]/20 space-y-2 lg:col-span-2">
            <span className="text-[10px] text-[#64748b] font-bold uppercase tracking-wider">Technician Concern & Scope</span>
            <p className="text-base font-bold text-white leading-snug">{caseData.concernTitle}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="px-2 py-0.5 rounded bg-[#1a56db]/20 text-[#00f0ff] font-semibold">
                {caseData.faultCategory}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#132952] text-[#cbd5e1]">
                Stage: {caseData.repairStage}
              </span>
              {caseData.partReplaced && (
                <span className="px-2 py-0.5 rounded bg-[#f59e0b]/20 text-[#f59e0b] font-semibold">
                  Part Replaced
                </span>
              )}
              {caseData.noiseFault && (
                <span className="px-2 py-0.5 rounded bg-[#ef4444]/20 text-[#ef4444] font-semibold">
                  Audio/Noise Fault
                </span>
              )}
            </div>
          </div>

          {/* Gates Progress Box */}
          <div className="glass-card-static p-5 border border-[#1a56db]/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#64748b] font-bold uppercase tracking-wider">Mandatory Gates</span>
                <StatusBadge status={caseData.status} size="sm" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-white">
                  {completedMandatory} / {totalMandatory}
                </span>
                <span className="text-xs font-bold text-[#00f0ff]">({gatePercent}%)</span>
              </div>
              <div className="h-2 w-full bg-[#081225] rounded-full overflow-hidden border border-[#1a56db]/20 mt-2">
                <div
                  className={`h-full rounded-full ${
                    gatePercent === 100 ? 'bg-[#10b981]' : 'bg-gradient-to-r from-[#1a56db] to-[#00f0ff]'
                  }`}
                  style={{ width: `${gatePercent}%` }}
                />
              </div>
            </div>
            {hasUnresolvedFlags && (
              <div className="mt-3 p-2.5 rounded-lg bg-red-950/70 border border-red-500/50 flex items-center gap-2 text-red-300 text-[11px] font-bold">
                <svg className="w-4 h-4 text-red-400 flex-shrink-0 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Submit Blocked: {unresolvedFlags.length} reject reason(s) pending retake</span>
              </div>
            )}
            {caseData.claimNumber && (
              <p className="text-[11px] text-[#10b981] font-mono mt-2 pt-2 border-t border-[#1a56db]/10">
                Claim #: <strong>{caseData.claimNumber}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Flag History & Discrepancy Log Section */}
        {flagsList.length > 0 && (
          <div className="p-5 rounded-2xl bg-[#ef4444]/10 border border-[#ef4444]/30 space-y-3 shadow-[0_0_25px_rgba(239,68,68,0.15)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-extrabold text-[#ef4444] uppercase tracking-wider">
                <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Warranty Clerk Discrepancy & Flag Log</span>
              </div>
              <span className="text-[11px] font-semibold text-gray-300">
                {flagsList.filter((f) => !f.resolvedAt).length} Action(s) Required
              </span>
            </div>

            <div className="space-y-2.5">
              {flagsList.map((flag, idx) => {
                const isResolved = Boolean(flag.resolvedAt);
                const matchingItem = evidenceList.find((e) => e.ruleKey === flag.evidenceRuleKey);
                const itemName = matchingItem?.name || RULE_NAMES[flag.evidenceRuleKey] || flag.evidenceRuleKey;

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border transition-all ${
                      isResolved
                        ? 'bg-[#081225]/60 border-[#10b981]/30 opacity-85'
                        : 'bg-[#0d1b3e] border-[#ef4444]/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${
                          isResolved
                            ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40'
                            : 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/40 animate-pulse'
                        }`}>
                          {isResolved ? '✓ Resolved' : 'Action Required · Retake'}
                        </span>
                        <span className="font-bold text-white">{itemName}</span>
                        <span className="text-gray-300 font-mono text-[11px]">Reason: {flag.reasonCode}</span>
                        <span className="text-gray-400 font-mono text-[11px]">(Rule: {flag.evidenceRuleKey})</span>
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {new Date(flag.flaggedAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-white italic bg-[#081225] p-2.5 rounded-lg border border-white/5 my-2">
                      "{flag.instruction}"
                    </p>

                    {flag.technicianNote && (
                      <p className="text-xs text-emerald-300 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-500/20 my-2">
                        <strong className="text-emerald-400 block text-[10px] uppercase tracking-wider mb-0.5">Technician Resolution Note:</strong>
                        "{flag.technicianNote}"
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-gray-400">
                        — Flagged by <strong className="text-gray-200">{flag.flaggedBy}</strong>
                        {isResolved && <span className="text-[#10b981] ml-2">· Resolved {new Date(flag.resolvedAt!).toLocaleTimeString()}</span>}
                      </span>

                      {!isResolved && (
                        userRole === 'TECHNICIAN' ? (
                          <button
                            type="button"
                            onClick={() => handleOpenRetakeModal(flag.evidenceRuleKey, itemName, flag.instruction, flag.reasonCode, matchingItem?.storageUrl)}
                            className="btn-danger text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>Retake / Replace Photo</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-amber-400 font-mono font-semibold">
                            ⏳ Awaiting Tech Retake
                          </span>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Evidence Gallery Section */}
        <div className="glass-card-static p-6 border border-[#1a56db]/20 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Audit Evidence Pack Gallery</h3>
              <p className="text-xs text-[#cbd5e1]/70">BYD-WB-2602-02 Attachment A standardized shots & videos</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#00f0ff] font-semibold">
                {evidenceList.length} Captured Items
              </span>
              {userRole === 'TECHNICIAN' && (
                <button
                  type="button"
                  onClick={() => handleOpenRetakeModal('fault_location', 'Additional Defect Evidence')}
                  className="btn-ghost text-xs py-1.5 px-3 border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/10 flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>+ Upload / Add Evidence</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {evidenceList.map((item) => {
              const activeFlag = flagsList.find((f) => f.evidenceRuleKey === item.ruleKey && !f.resolvedAt);

              return (
                <div
                  key={item.id}
                  className={`rounded-xl bg-[#081225]/90 border overflow-hidden transition-all group flex flex-col justify-between ${
                    activeFlag
                      ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.35)]'
                      : 'border-[#1a56db]/20 hover:border-[#00f0ff]/50'
                  }`}
                >
                  {/* Media preview */}
                  <div
                    onClick={() => setSelectedMedia(item.storageUrl)}
                    className="h-44 bg-[#0d1b3e] relative cursor-pointer overflow-hidden flex items-center justify-center"
                  >
                    <img
                      src={item.storageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="px-3 py-1.5 rounded-lg bg-black/80 text-white text-xs font-semibold backdrop-blur-sm">
                        Click to Expand
                      </span>
                    </div>

                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono text-[#00f0ff] uppercase backdrop-blur-sm">
                      {item.mediaType}
                    </span>

                    {activeFlag && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-red-600/90 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm animate-pulse shadow-md">
                        ⚠️ FLAGGED
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-3.5 space-y-1.5 text-xs">
                    <p className="font-bold text-white truncate" title={item.name}>
                      {item.name}
                    </p>
                    <p className="font-mono text-[10px] text-[#64748b]">Key: {item.ruleKey}</p>
                    {item.ocrExtractedText && (
                      <div className="p-2 rounded bg-[#132952]/50 border border-[#1a56db]/10 text-[10px]">
                        <span className="text-[#00f0ff] font-semibold block">OCR Verified:</span>
                        <span className="font-mono text-white font-bold">{item.ocrExtractedText}</span>
                        {item.ocrConfidence && (
                          <span className="text-[#10b981] ml-2">({item.ocrConfidence}% conf)</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Flagged Alert Banner or Action Footer */}
                  {activeFlag && (
                    <div className="p-2.5 bg-red-950/50 border-t border-red-500/40 space-y-2">
                      <p className="text-[10px] text-red-300 font-semibold line-clamp-2">
                        Clerk: "{activeFlag.instruction}"
                      </p>
                      {userRole === 'TECHNICIAN' ? (
                        <button
                          type="button"
                          onClick={() => handleOpenRetakeModal(item.ruleKey, item.name, activeFlag.instruction, activeFlag.reasonCode, item.storageUrl)}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Retake Photo</span>
                        </button>
                      ) : (
                        <div className="text-center py-1.5 px-2 rounded bg-amber-950/40 border border-amber-500/30 text-[10px] text-amber-300 font-bold font-mono">
                          Flagged · Awaiting Tech Retake
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Voice to Tech Dictation Section */}
        <div className="glass-card-static p-6 border border-[#1a56db]/20 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#00f0ff]/10 border border-[#00f0ff]/30 flex items-center justify-center text-[#00f0ff]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Voice to Tech Workshop Transcripts</h3>
                <p className="text-xs text-[#cbd5e1]/70">OmniSuiteAI Australian Automotive Speech-to-Text Model</p>
              </div>
            </div>
            <span className="text-xs text-[#10b981] font-semibold">Live Dictation Verified</span>
          </div>

          {caseData.voiceNotes && caseData.voiceNotes.length > 0 ? (
            <div className="space-y-3">
              {caseData.voiceNotes.map((vn) => (
                <div key={vn.id} className="p-4 rounded-xl bg-[#081225]/80 border border-[#1a56db]/20 space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#64748b]">
                    <span className="font-semibold text-[#00f0ff]">Recorded by {vn.recordedBy}</span>
                    <span className="font-mono">{vn.durationSeconds}s duration · {new Date(vn.recordedAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-white font-medium italic">"{vn.transcript}"</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#64748b] italic">No audio dictation notes recorded for this ticket.</p>
          )}
        </div>
      </div>

      {/* Media Lightbox Modal */}
      {selectedMedia && (
        <div
          onClick={() => setSelectedMedia(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-md cursor-pointer animate-fadeIn"
        >
          <div className="max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl border border-[#00f0ff]/30 shadow-2xl">
            <img src={selectedMedia} alt="Evidence" className="w-full h-full object-contain" />
          </div>
        </div>
      )}

      {/* Flag Retake Modal */}
      <Modal
        isOpen={flagModalOpen}
        onClose={() => setFlagModalOpen(false)}
        title="Flag Case Discrepancy & Return to Workshop"
        maxWidth="md"
        footer={
          <>
            <button onClick={() => setFlagModalOpen(false)} className="btn-ghost text-xs">
              Cancel
            </button>
            <button onClick={handleFlagSubmit} className="btn-danger text-xs">
              Confirm Flag & Notify Tech
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-[#cbd5e1] mb-1">Select Discrepancy Rule</label>
            <select
              value={flagRuleKey}
              onChange={(e) => setFlagRuleKey(e.target.value)}
              className="input-field text-xs"
            >
              <option value="vin_photo">VIN Plate Photo</option>
              <option value="odometer_photo">Odometer Cluster Photo</option>
              <option value="fault_location">Defect / Fault Location Photo</option>
              <option value="tier2_hv_isolation">HV Battery Isolation Test</option>
              <option value="noise_video">Audio / Vibration Recording</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#cbd5e1] mb-1">Standardized Reason Code</label>
            <select
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value as FlagReasonCode)}
              className="input-field text-xs"
            >
              <option value="POOR_LIGHTING_BLUR">POOR_LIGHTING_BLUR (Blurry or dark)</option>
              <option value="WRONG_ANGLE">WRONG_ANGLE (Too close / missed context)</option>
              <option value="UNREADABLE_VIN">UNREADABLE_VIN (VIN numbers obscured)</option>
              <option value="NO_SERIAL">NO_SERIAL (Old/New part serial missing)</option>
              <option value="NO_DTC">NO_DTC (Diagnostic DTC report missing)</option>
              <option value="VIDEO_TOO_SHORT">VIDEO_TOO_SHORT (Under min duration)</option>
              <option value="MISSING_SHOT">MISSING_SHOT (Mandatory shot omitted)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#cbd5e1] mb-1">Technician Retake Instruction</label>
            <textarea
              rows={3}
              value={flagInstruction}
              onChange={(e) => setFlagInstruction(e.target.value)}
              placeholder="E.g., Please step back 1 meter to capture the subframe context..."
              className="input-field text-xs"
            />
          </div>
        </div>
      </Modal>

      {/* Approve & Submit Modal */}
      <Modal
        isOpen={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
        title="Approve & Mark Case Submitted to OEM Portal"
        maxWidth="md"
        footer={
          <>
            <button onClick={() => setSubmitModalOpen(false)} className="btn-ghost text-xs">
              Cancel
            </button>
            <button
              onClick={handleMarkSubmitted}
              disabled={hasUnresolvedFlags}
              className={`text-xs ${
                hasUnresolvedFlags ? 'opacity-50 cursor-not-allowed bg-gray-800 text-gray-400' : 'btn-success'
              }`}
            >
              Record Approval & Lock Case
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          {hasUnresolvedFlags && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-500 text-red-300 text-xs font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Case cannot be submitted to OEM: {unresolvedFlags.length} reject reason(s) must be retaken first.</span>
            </div>
          )}
          <div>
            <label className="block font-semibold text-[#cbd5e1] mb-1">OEM Claim / Reference #</label>
            <input
              type="text"
              required
              value={claimNumber}
              onChange={(e) => setClaimNumber(e.target.value)}
              placeholder="E.g., BYD-CLM-2026-9841"
              className="input-field text-xs font-mono"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#cbd5e1] mb-1">Internal Clerk Verification Notes</label>
            <textarea
              rows={3}
              value={clerkNote}
              onChange={(e) => setClerkNote(e.target.value)}
              placeholder="Verified all 8 Attachment A photos. Submitted into BYD dealer portal."
              className="input-field text-xs"
            />
          </div>
        </div>
      </Modal>

      {/* Submission Pack Modal */}
      <Modal
        isOpen={packModalOpen}
        onClose={() => setPackModalOpen(false)}
        title="OEM Standardized Submission Package"
        maxWidth="lg"
        footer={
          <button onClick={() => setPackModalOpen(false)} className="btn-primary text-xs">
            Done
          </button>
        }
      >
        {packData && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-[#081225]/80 border border-[#1a56db]/20 space-y-2">
              <p className="text-white font-bold text-sm">Download Ready Package</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={packData.zipDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary text-xs py-2 px-4 shadow-[0_0_15px_rgba(26,86,219,0.4)]"
                >
                  Download {packData.zipFileName}
                </a>
                <a
                  href={packData.pdfSummaryDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost text-xs py-2 px-4 border-[#00f0ff]/30 text-[#00f0ff]"
                >
                  Download One-Page Case Summary PDF
                </a>
              </div>
            </div>

            <div>
              <p className="font-semibold text-white mb-2">OEM-Named File Manifest (BYD Convention):</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {(packData.includedFiles || packData.fileManifest || []).map((file: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-[#081225] border border-[#1a56db]/10 flex items-center justify-between font-mono text-[11px]"
                  >
                    <span className="text-[#00f0ff]">{file.oemFileName || file.standardizedName || file.filename || `Evidence_${idx + 1}`}</span>
                    <span className="text-[#64748b]">{((file.sizeBytes || 0) / 1024).toFixed(0)} KB</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Dedicated Technician Retake & Evidence Upload Modal (Spec §6, §8.3) */}
      <Modal
        isOpen={retakeModalOpen && userRole === 'TECHNICIAN'}
        onClose={() => setRetakeModalOpen(false)}
        title={uploadReasonCode ? `📸 Retake Evidence: ${uploadName}` : `Upload Evidence: ${uploadName}`}
        maxWidth="lg"
        footer={
          <>
            <button
              onClick={() => setRetakeModalOpen(false)}
              className="btn-ghost text-xs"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitRetake}
              disabled={
                uploading ||
                !selectedFile ||
                Boolean(uploadReasonCode && !fixConfirmed)
              }
              className={`text-xs py-2.5 px-5 flex items-center gap-1.5 font-bold transition-all rounded-xl ${
                uploading ||
                !selectedFile ||
                (uploadReasonCode && !fixConfirmed)
                  ? 'opacity-50 cursor-not-allowed bg-gray-800 text-gray-400 border border-gray-700'
                  : uploadReasonCode
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                  : 'btn-primary shadow-[0_0_20px_rgba(0,240,255,0.4)]'
              }`}
            >
              {uploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Uploading & Auto-Resolving Flag...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{uploadReasonCode ? 'Submit Replacement & Auto-Resolve Flag' : 'Save Evidence to Case'}</span>
                </>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Clerk Feedback Callout & Guidance (for retakes) */}
          {uploadReasonCode && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-red-950/70 to-[#1c080e] border border-red-500/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-400 font-bold">
                  <svg className="w-4 h-4 text-red-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="font-mono text-xs tracking-wide">
                    DISCREPANCY: {uploadReasonCode}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400 font-mono">Rule: {uploadRuleKey}</span>
              </div>

              {uploadInstruction && (
                <div className="bg-[#081225]/80 p-3 rounded-lg border border-red-500/20">
                  <span className="text-[10px] text-red-400 font-semibold block uppercase tracking-wider mb-1">
                    Warranty Clerk Instructions:
                  </span>
                  <p className="text-white text-sm font-medium italic">"{uploadInstruction}"</p>
                </div>
              )}

              {REASON_TIPS[uploadReasonCode] && (
                <div className="flex items-start gap-1.5 text-[#00f0ff] text-[11px] pt-0.5">
                  <span className="font-bold flex-shrink-0">💡 Workshop Tip:</span>
                  <span>{REASON_TIPS[uploadReasonCode]}</span>
                </div>
              )}
            </div>
          )}

          {/* Rule Selector (General upload only) */}
          {!uploadReasonCode && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#cbd5e1] mb-1">Evidence Gate / Rule</label>
                <select
                  value={uploadRuleKey}
                  onChange={(e) => {
                    setUploadRuleKey(e.target.value);
                    const opt = e.target.options[e.target.selectedIndex].text;
                    setUploadName(opt);
                  }}
                  className="input-field text-xs"
                >
                  <option value="fault_location">Defect / Fault Location Photo</option>
                  <option value="fault_closeup">Fault Close-up Photo</option>
                  <option value="vin_photo">VIN Plate Photo</option>
                  <option value="odometer_photo">Odometer Cluster Photo</option>
                  <option value="front_vehicle_photo">Front of Vehicle Reference</option>
                  <option value="tier2_hv_isolation">HV Battery Isolation Test</option>
                  <option value="old_part_serial">Old Part Serial Barcode</option>
                  <option value="new_part_serial">New Part Serial Barcode</option>
                  <option value="noise_video">Noise Recording (.mp4)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#cbd5e1] mb-1">Item Title / Descriptor</label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="input-field text-xs"
                />
              </div>
            </div>
          )}

          {/* Side-by-Side Comparison Box (If retaking an existing flagged photo) */}
          {uploadReasonCode && uploadPreviousPhotoUrl && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Left: Previous Rejected Photo */}
              <div className="p-3 rounded-xl bg-[#081225] border-2 border-dashed border-red-500/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider">
                    Previous Photo (Rejected)
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-600/30 text-red-300 font-bold font-mono">
                    FLAGGED
                  </span>
                </div>
                <div className="h-36 rounded-lg overflow-hidden bg-black flex items-center justify-center relative group">
                  <img
                    src={uploadPreviousPhotoUrl}
                    alt="Previous Rejected"
                    className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="absolute inset-0 bg-red-950/20 pointer-events-none" />
                </div>
                <p className="text-[10px] text-gray-400 text-center italic">Requires replacement per clerk note</p>
              </div>

              {/* Right: New Replacement Photo Preview */}
              <div className="p-3 rounded-xl bg-[#081225] border-2 border-emerald-500/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                    New Replacement Shot
                  </span>
                  {uploadStorageUrl ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-600/30 text-emerald-300 font-bold font-mono">
                      READY TO UPLOAD
                    </span>
                  ) : (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-bold font-mono">
                      PENDING
                    </span>
                  )}
                </div>
                <div className="h-36 rounded-lg overflow-hidden bg-black flex items-center justify-center">
                  {uploadStorageUrl ? (
                    <img src={uploadStorageUrl} alt="New Preview" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-center p-3 text-gray-500 text-xs">
                      <svg className="w-8 h-8 mx-auto mb-1 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p>Capture photo or pick preset below to preview</p>
                    </div>
                  )}
                </div>
                {uploadOcrText ? (
                  <p className="text-[10px] text-emerald-400 font-mono text-center">
                    OCR Text: <strong>{uploadOcrText}</strong>
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-400 text-center italic">Will overwrite flagged item</p>
                )}
              </div>
            </div>
          )}

          {/* Single Preview Box (For general upload or if no previous photo) */}
          {(!uploadReasonCode || !uploadPreviousPhotoUrl) && (
            <div>
              {uploadStorageUrl ? (
                <div className="p-3 rounded-xl bg-[#081225] border border-[#00f0ff]/30 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-[#00f0ff] tracking-wider">
                    Captured Evidence Preview
                  </span>
                  <div className="h-44 rounded-lg overflow-hidden bg-black flex items-center justify-center">
                    <img src={uploadStorageUrl} alt="Preview" className="w-full h-full object-contain" />
                  </div>
                  {uploadOcrText && (
                    <p className="text-[11px] text-emerald-400 font-mono">
                      OCR Text: <strong>{uploadOcrText}</strong>
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-dashed border-gray-700 text-center text-gray-500">
                  Select an image file or choose a workshop demo shot below to preview.
                </div>
              )}
            </div>
          )}

          {/* Workshop Camera / File Trigger */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-[#cbd5e1]">
              Capture New Shot (Workshop Camera / Device)
            </label>
            <input
              type="file"
              accept="image/*,video/mp4"
              capture="environment"
              onChange={handleFileSelect}
              className="block w-full text-xs text-gray-400 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-gradient-to-r file:from-[#1a56db] file:to-[#00f0ff] file:text-white hover:file:opacity-90 file:cursor-pointer border border-[#1a56db]/30 rounded-xl p-2 bg-[#081225]"
            />
          </div>

          {/* Technician Explanation Note (Spec §5.6 / §8.3) */}
          {uploadReasonCode && (
            <div>
              <label className="block font-semibold text-[#cbd5e1] mb-1">
                Technician Clarification Note (Optional — visible to Clerk)
              </label>
              <input
                type="text"
                value={uploadTechnicianNote}
                onChange={(e) => setUploadTechnicianNote(e.target.value)}
                placeholder="E.g. Cleaned lens, workshop spotlight positioned on defect, retaken with clear 1m context..."
                className="input-field text-xs"
              />
            </div>
          )}

          {/* Warning if previous rejected photo is re-selected */}
          {uploadReasonCode && uploadPreviousPhotoUrl && uploadStorageUrl === uploadPreviousPhotoUrl && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-500 text-red-300 text-xs font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Cannot re-submit the same rejected photo. A new replacement photo is required to fix the reject reason.</span>
            </div>
          )}

          {/* Mandatory Confirmation Checkbox */}
          {uploadReasonCode && (
            <label className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#081225] border-2 border-red-500/50 hover:border-red-500/80 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={fixConfirmed}
                onChange={(e) => setFixConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-600 text-red-600 focus:ring-red-500 bg-gray-900 cursor-pointer"
              />
              <div className="space-y-0.5">
                <span className="text-white font-bold text-xs block">
                  I confirm this replacement evidence fixes the rejection reason ({uploadReasonCode})
                </span>
                <span className="text-[11px] text-gray-400 block">
                  Mandatory: Retake must address clerk instructions before submission is unlocked.
                </span>
              </div>
            </label>
          )}

          {/* Quick Workshop Capture Presets */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold text-[#00f0ff] uppercase tracking-wider block">
              Or Choose Verified Workshop Demo Shot (Instant Retake Test)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  setUploadStorageUrl('https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80');
                  setUploadName(RULE_NAMES[uploadRuleKey] || 'Defect Context Retake (1m Step-Back)');
                }}
                className="p-2.5 rounded-xl bg-[#081225] hover:bg-[#1a56db]/20 border border-[#1a56db]/30 text-left transition-all text-[11px]"
              >
                <span className="font-bold text-white block">Defect Context</span>
                <span className="text-[10px] text-gray-400">1m clear step-back</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadStorageUrl('https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80');
                  setUploadName('VIN Plate Photo — Readable Characters');
                  setUploadOcrText('LGXCE4C86P0019283');
                }}
                className="p-2.5 rounded-xl bg-[#081225] hover:bg-[#1a56db]/20 border border-[#1a56db]/30 text-left transition-all text-[11px]"
              >
                <span className="font-bold text-white block">Sharp VIN Plate</span>
                <span className="text-[10px] text-gray-400">OCR LGXCE4...</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadStorageUrl('https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=80');
                  setUploadName('Odometer Cluster Reading');
                  setUploadOcrText('14250 km');
                }}
                className="p-2.5 rounded-xl bg-[#081225] hover:bg-[#1a56db]/20 border border-[#1a56db]/30 text-left transition-all text-[11px]"
              >
                <span className="font-bold text-white block">Odometer Cluster</span>
                <span className="text-[10px] text-gray-400">14,250 km clear</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadStorageUrl('https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80');
                  setUploadName('HV Battery Isolation Test Proof');
                }}
                className="p-2.5 rounded-xl bg-[#081225] hover:bg-[#1a56db]/20 border border-[#1a56db]/30 text-left transition-all text-[11px]"
              >
                <span className="font-bold text-white block">HV Safety Test</span>
                <span className="text-[10px] text-gray-400">0.0V measured</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
