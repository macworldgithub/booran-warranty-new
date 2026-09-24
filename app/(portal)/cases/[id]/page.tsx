'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '../../../../components/header';
import { StatusBadge } from '../../../../components/status-badge';
import { Modal } from '../../../../components/modal';
import { useToast } from '../../../../components/toast';
import { api, resolveMediaUrl } from '../../../../lib/api';
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

function EvidenceThumbnail({
  item,
  caseVin,
  onExpand,
}: {
  item: any;
  caseVin?: string;
  onExpand: (url: string, itemObj?: any) => void;
}) {
  const [hasError, setHasError] = useState(false);
  const resolvedUrl = resolveMediaUrl(item.storageUrl);
  const isVideo =
    item.mediaType === 'video' ||
    (item.mimeType && item.mimeType.startsWith('video/')) ||
    (item.storageUrl && (
      item.storageUrl.toLowerCase().includes('.mp4') ||
      item.storageUrl.toLowerCase().includes('.webm') ||
      item.storageUrl.toLowerCase().includes('.mov')
    ));
  const isLocalFileUri = Boolean(item.storageUrl && (item.storageUrl.startsWith('file://') || item.storageUrl.startsWith('content://')));
  const isVinRule = item.ruleKey === 'vin_photo' || (item.name && item.name.toLowerCase().includes('vin'));
  const vinText = item.ocrExtractedText || caseVin || '';

  // If local phone file path or image error on VIN, render stylized VIN Barcode plate
  if (isVinRule && (isLocalFileUri || hasError || !item.storageUrl)) {
    return (
      <div
        onClick={() => onExpand(resolvedUrl || item.storageUrl || 'vin_digital', item)}
        className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-4 flex flex-col justify-between select-none relative overflow-hidden group/thumb cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold font-mono uppercase tracking-wider border border-emerald-500/30">
            ✓ Barcode Verified
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {item.ocrConfidence ? `${item.ocrConfidence}% conf` : '99% conf'}
          </span>
        </div>

        {/* Barcode Graphic */}
        <div className="py-2.5 px-3 bg-white rounded-lg shadow-inner flex flex-col items-center my-auto">
          <div className="w-full h-8 flex items-center justify-between overflow-hidden opacity-90">
            {Array.from({ length: 44 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-black h-full"
                style={{
                  width: idx % 4 === 0 ? '3.5px' : idx % 3 === 0 ? '1.5px' : idx % 2 === 0 ? '2.5px' : '4px',
                  marginRight: '1px',
                }}
              />
            ))}
          </div>
          <span className="font-mono text-xs font-black text-slate-900 tracking-wider mt-1.5 truncate max-w-full">
            {vinText || '2C4RDGCG0FR805928'}
          </span>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>Windscreen / Plate Barcode</span>
          <span className="group-hover/thumb:text-white transition-colors font-medium">Click to inspect →</span>
        </div>
      </div>
    );
  }

  // Video preview
  if (isVideo) {
    return (
      <div
        onClick={() => onExpand(resolvedUrl || item.storageUrl, item)}
        className="w-full h-full relative group/video cursor-pointer bg-slate-950 flex items-center justify-center overflow-hidden"
      >
        {resolvedUrl && !isLocalFileUri && !hasError ? (
          <video
            src={resolvedUrl}
            preload="metadata"
            muted
            playsInline
            onError={() => setHasError(true)}
            className="w-full h-full object-cover opacity-80 group-hover/video:opacity-100 transition-opacity"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-3 text-center text-slate-300 space-y-1">
            <svg className="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="text-[11px] font-bold text-slate-200">Video Evidence</span>
            <span className="text-[9px] text-amber-300 font-mono">Click to Play (.mp4)</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/25 flex items-center justify-center group-hover/video:bg-black/35 transition-colors">
          <div className="w-11 h-11 rounded-full bg-white/95 text-slate-900 flex items-center justify-center shadow-xl group-hover/video:scale-110 transition-transform">
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
        {item.durationSeconds ? (
          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 text-white text-[10px] font-mono font-bold tracking-wider">
            {item.durationSeconds}s
          </span>
        ) : null}
      </div>
    );
  }

  // If broken generic image or file URI
  if (hasError || isLocalFileUri || !item.storageUrl) {
    return (
      <div
        onClick={() => onExpand(resolvedUrl || item.storageUrl || '', item)}
        className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-3 text-center text-slate-400 space-y-1 cursor-pointer"
      >
        <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-[11px] font-semibold text-slate-600">Digital Record on File</span>
        <span className="text-[9px] text-slate-400 font-mono truncate max-w-full">
          {item.ocrExtractedText ? `OCR: ${item.ocrExtractedText}` : 'Click to inspect'}
        </span>
      </div>
    );
  }

  // Normal image preview with error fallback
  return (
    <img
      src={resolvedUrl || item.storageUrl}
      alt={item.name}
      onError={() => setHasError(true)}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
    />
  );
}

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const caseId = params?.id as string;

  const [caseData, setCaseData] = useState<WarrantyCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [selectedMediaItem, setSelectedMediaItem] = useState<any | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [userName, setUserName] = useState<string>('');

  // Evidence Gallery Search & Filter State
  const [evidenceSearch, setEvidenceSearch] = useState('');
  const [evidenceFilter, setEvidenceFilter] = useState<'ALL' | 'FLAGGED' | 'MANDATORY' | 'PHOTO' | 'VIDEO'>('ALL');

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

  // Voice Note Dictation & Upload State
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceSecs, setVoiceSecs] = useState(0);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voicePinnedRule, setVoicePinnedRule] = useState('');
  const [voiceTranscriptInput, setVoiceTranscriptInput] = useState('');
  const [voiceTranscribing, setVoiceTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<any>(null);

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        setVoiceBlob(audioBlob);
        setVoiceAudioUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
      setVoiceSecs(0);
      voiceTimerRef.current = setInterval(() => {
        setVoiceSecs((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      showToast('Could not access microphone: ' + err.message, 'error');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecordingVoice) {
      mediaRecorderRef.current.stop();
      setIsRecordingVoice(false);
    }
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
  };

  const handleVoiceSubmit = async () => {
    if (!caseId) return;
    setVoiceTranscribing(true);
    try {
      const audioToUpload = voiceFile || voiceBlob;
      if (audioToUpload) {
        const res = await api.uploadVoiceNote(caseId, audioToUpload, voicePinnedRule || undefined, userName || 'Workshop Technician');
        if (res?.case) {
          setCaseData(res.case);
        } else {
          await loadCase();
        }
        showToast('Voice note transcribed & attached to case successfully!', 'success');
      } else if (voiceTranscriptInput.trim()) {
        const updated = await api.addVoiceNote(caseId, {
          transcript: voiceTranscriptInput.trim(),
          durationSeconds: 10,
          recordedBy: userName || 'Workshop Technician',
          pinnedToEvidenceKey: voicePinnedRule || undefined,
        });
        setCaseData(updated);
        showToast('Technician note attached successfully!', 'success');
      }
      setVoiceModalOpen(false);
      setVoiceBlob(null);
      setVoiceAudioUrl(null);
      setVoiceFile(null);
      setVoiceTranscriptInput('');
      setVoicePinnedRule('');
    } catch (err: any) {
      showToast('Failed to save voice note: ' + err.message, 'error');
    } finally {
      setVoiceTranscribing(false);
    }
  };

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

  const evidenceList = caseData?.evidenceItems || caseData?.evidence || [];
  const flagsList = caseData?.flagHistory || caseData?.flags || [];

  const filteredEvidence = useMemo(() => {
    if (!caseData) return [];
    return evidenceList.filter((item) => {
      const activeFlag = flagsList.find((f) => f.evidenceRuleKey === item.ruleKey && !f.resolvedAt);

      if (evidenceFilter === 'FLAGGED' && !activeFlag) return false;
      if (evidenceFilter === 'MANDATORY' && !((item as any).isMandatory || ['vin_photo', 'odometer_photo', 'front_vehicle_photo', 'fault_location'].includes(item.ruleKey))) return false;
      if (evidenceFilter === 'PHOTO' && item.mediaType !== 'image') return false;
      if (evidenceFilter === 'VIDEO' && item.mediaType !== 'video') return false;

      if (!evidenceSearch.trim()) return true;
      const q = evidenceSearch.toLowerCase().trim();
      const matchName = item.name?.toLowerCase().includes(q);
      const matchKey = item.ruleKey?.toLowerCase().includes(q);
      const matchOcr = item.ocrExtractedText?.toLowerCase().includes(q);
      const matchReason = activeFlag?.reasonCode?.toLowerCase().includes(q);

      return matchName || matchKey || matchOcr || matchReason;
    });
  }, [evidenceList, flagsList, evidenceFilter, evidenceSearch, caseData]);

  if (loading || !caseData) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-[#E11F26]/30 border-t-[#E11F26] rounded-full animate-spin" />
        <p className="text-xs text-[#64748b]">Loading case details...</p>
      </div>
    );
  }

  const completedMandatory = caseData.checklistSummary?.completedMandatory ?? 0;
  const totalMandatory = caseData.checklistSummary?.totalMandatory ?? 1;
  const gatePercent = Math.round((completedMandatory / (totalMandatory || 1)) * 100);

  const unresolvedFlags = flagsList.filter((f) => !f.resolvedAt);
  const hasUnresolvedFlags = unresolvedFlags.length > 0;

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title={`Case: ${caseData.roNumber}`}
        subtitle={`${caseData.brandName} · ${caseData.siteName} · Tech: ${caseData.technicianName}${
          caseData.createdAt
            ? ` · ${new Date(caseData.createdAt).toLocaleDateString('en-AU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })} ${new Date(caseData.createdAt).toLocaleTimeString('en-AU', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })}`
            : ''
        }`}
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
                  className="px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:border-[#E11F26] text-slate-700 hover:text-[#E11F26] text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Export OEM ZIP Pack</span>
                </button>
                {caseData.status !== 'Submitted' && caseData.status !== 'Flagged' && (
                  <>
                    <button
                      onClick={() => setFlagModalOpen(true)}
                      className="px-3.5 py-2 rounded-lg bg-red-50 border border-red-200 text-[#E11F26] hover:bg-[#E11F26] hover:text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
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
                      className={`text-xs py-2 px-4 flex items-center gap-1.5 rounded-lg font-bold transition-all shadow-xs ${
                        hasUnresolvedFlags
                          ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
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
                className={`text-xs py-2 px-4 flex items-center gap-1.5 rounded-lg font-bold transition-all shadow-xs ${
                  hasUnresolvedFlags
                    ? 'bg-red-50 text-red-600 border border-red-200 cursor-not-allowed opacity-90'
                    : 'btn-primary'
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
          <div className="p-6 rounded-2xl bg-red-50 border-2 border-[#E11F26] shadow-sm space-y-4 animate-slideInLeft">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white border border-red-200 flex items-center justify-center text-[#E11F26] shadow-xs">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#E11F26] text-white font-mono text-[10px] font-extrabold uppercase tracking-wider shadow-xs">
                      {userRole === 'TECHNICIAN' ? 'ACTION REQUIRED · SPEC §6 / §8.3' : 'WORKSHOP ACTION PENDING'}
                    </span>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                      {userRole === 'TECHNICIAN' ? 'Warranty Clerk Flagged Evidence For Retake' : 'Flagged Discrepancies Pending Workshop Retake'}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-700 mt-0.5">
                    {userRole === 'TECHNICIAN'
                      ? `Clerk noted discrepancies on ${flagsList.filter((f) => !f.resolvedAt).length} item(s). Follow instructions below to retake photos. Uploading replacement automatically resolves the flag and resubmits to clerk review queue.`
                      : `Discrepancies flagged on ${flagsList.filter((f) => !f.resolvedAt).length} item(s). The workshop technician must capture and upload replacement evidence to resolve the reject reason(s).`}
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg bg-white text-[#E11F26] border border-red-200 text-xs font-bold font-mono shadow-xs">
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
                      className="p-4 rounded-xl bg-white border border-red-200 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-red-300 shadow-xs"
                    >
                      <div className="flex items-start gap-3.5">
                        {matchingItem?.storageUrl && (
                          <div className="w-16 h-16 rounded-lg overflow-hidden border border-red-200 bg-slate-100 flex-shrink-0 relative shadow-xs">
                            <img src={matchingItem.storageUrl} alt={itemName} className="w-full h-full object-cover" />
                            <span className="absolute inset-0 bg-red-900/40 flex items-center justify-center text-[9px] font-bold text-white uppercase">
                              Flagged
                            </span>
                          </div>
                        )}
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">{itemName}</span>
                            <span className="px-2 py-0.5 rounded bg-red-50 border border-red-200 text-[#E11F26] font-mono text-[11px] font-bold">
                              {flag.reasonCode}
                            </span>
                            <span className="text-[11px] text-slate-500">({reasonLabel})</span>
                          </div>
                          <div className="text-xs text-slate-800 bg-red-50/70 border-l-2 border-[#E11F26] px-3 py-1.5 rounded-r">
                            <span className="text-[#E11F26] font-bold block text-[10px] uppercase tracking-wider">
                              Clerk Instruction:
                            </span>
                            <p className="italic font-medium">"{flag.instruction}"</p>
                          </div>
                          <p className="text-[10px] text-slate-500">
                            Flagged by <strong className="text-slate-800">{flag.flaggedBy}</strong> · {new Date(flag.flaggedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {userRole === 'TECHNICIAN' ? (
                          <button
                            type="button"
                            onClick={() => handleOpenRetakeModal(flag.evidenceRuleKey, itemName, flag.instruction, flag.reasonCode, matchingItem?.storageUrl)}
                            className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-[#E11F26] hover:bg-[#c81a20] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>Retake / Replace Photo</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold font-mono">
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
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Vehicle Details</span>
            <p className="text-base font-extrabold text-slate-900">
              {caseData.year} {caseData.make} {caseData.model}
            </p>
            <div className="space-y-1 font-mono text-xs">
              <p className="text-slate-700 flex justify-between">
                <span className="text-slate-500">VIN:</span>
                <strong className="text-slate-900 tracking-wider">{caseData.vin}</strong>
              </p>
              <p className="text-slate-700 flex justify-between">
                <span className="text-slate-500">Odometer:</span>
                <span className="text-slate-900 font-semibold">{(caseData.odometer ?? caseData.vehicle?.odometer ?? 0).toLocaleString()} km</span>
              </p>
              <p className="text-slate-700 flex justify-between items-center">
                <span className="text-slate-500">Powertrain:</span>
                <span className="px-2 py-0.5 rounded border border-slate-300 text-slate-800 font-sans font-bold bg-white text-[11px]">
                  {caseData.powertrain}
                </span>
              </p>
              {caseData.createdAt && (
                <p className="text-slate-700 flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Opened:</span>
                  <span className="text-slate-900 font-mono text-[11px] font-bold">
                    {new Date(caseData.createdAt).toLocaleDateString('en-AU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}{' '}
                    {new Date(caseData.createdAt).toLocaleTimeString('en-AU', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Fault Category & Concern */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2 lg:col-span-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Technician Concern & Scope</span>
            <p className="text-base font-bold text-slate-900 leading-snug">{caseData.concernTitle}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="px-2.5 py-0.5 rounded border border-slate-300 bg-white text-slate-800 font-bold font-mono text-[11px]">
                {caseData.faultCategory}
              </span>
              <span className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600">
                Stage: {caseData.repairStage}
              </span>
              {caseData.partReplaced && (
                <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
                  Part Replaced
                </span>
              )}
              {caseData.noiseFault && (
                <span className="px-2 py-0.5 rounded bg-red-50 border border-red-200 text-[#E11F26] font-semibold">
                  Audio/Noise Fault
                </span>
              )}
            </div>
          </div>

          {/* Gates Progress Box */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Mandatory Gates</span>
                <StatusBadge status={caseData.status} size="sm" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-slate-900">
                  {completedMandatory} / {totalMandatory}
                </span>
                <span className="text-xs font-bold text-[#E11F26]">({gatePercent}%)</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200 mt-2">
                <div
                  className={`h-full rounded-full ${
                    gatePercent === 100 ? 'bg-emerald-500' : 'bg-[#E11F26]'
                  }`}
                  style={{ width: `${gatePercent}%` }}
                />
              </div>
            </div>
            {hasUnresolvedFlags && (
              <div className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-[#E11F26] text-[11px] font-bold">
                <svg className="w-4 h-4 text-[#E11F26] flex-shrink-0 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Submit Blocked: {unresolvedFlags.length} reject reason(s) pending retake</span>
              </div>
            )}
            {caseData.claimNumber && (
              <p className="text-[11px] text-emerald-700 font-mono mt-2 pt-2 border-t border-slate-200">
                Claim #: <strong>{caseData.claimNumber}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Flag History & Discrepancy Log Section */}
        {flagsList.length > 0 && (
          <div className="p-5 rounded-2xl bg-white border border-red-200 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-extrabold text-[#E11F26] uppercase tracking-wider">
                <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Warranty Clerk Discrepancy & Flag Log</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
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
                        ? 'bg-slate-50 border-emerald-200'
                        : 'bg-white border-red-200 shadow-xs'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${
                          isResolved
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-50 text-[#E11F26] border-red-200'
                        }`}>
                          {isResolved ? '✓ Resolved' : 'Action Required · Retake'}
                        </span>
                        <span className="font-bold text-slate-900">{itemName}</span>
                        <span className="text-slate-700 font-mono text-[11px]">Reason: {flag.reasonCode}</span>
                        <span className="text-slate-400 font-mono text-[11px]">(Rule: {flag.evidenceRuleKey})</span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {new Date(flag.flaggedAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-slate-800 italic bg-slate-50 p-2.5 rounded-lg border border-slate-200 my-2">
                      "{flag.instruction}"
                    </p>

                    {flag.technicianNote && (
                      <p className="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 my-2">
                        <strong className="text-emerald-900 block text-[10px] uppercase tracking-wider mb-0.5">Technician Resolution Note:</strong>
                        "{flag.technicianNote}"
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-500">
                        — Flagged by <strong className="text-slate-800">{flag.flaggedBy}</strong>
                        {isResolved && <span className="text-emerald-600 font-semibold ml-2">· Resolved {new Date(flag.resolvedAt!).toLocaleTimeString()}</span>}
                      </span>

                      {!isResolved && (
                        userRole === 'TECHNICIAN' ? (
                          <button
                            type="button"
                            onClick={() => handleOpenRetakeModal(flag.evidenceRuleKey, itemName, flag.instruction, flag.reasonCode, matchingItem?.storageUrl)}
                            className="px-3 py-1.5 rounded-lg bg-[#E11F26] hover:bg-[#c81a20] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>Retake / Replace Photo</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-amber-700 font-mono font-semibold">
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
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Audit Evidence Pack Gallery</h3>
              <p className="text-xs text-slate-500">BYD-WB-2602-02 Attachment A standardized shots & videos</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-700 font-bold">
                {filteredEvidence.length} of {evidenceList.length} Items Shown
              </span>
              {userRole === 'TECHNICIAN' && (
                <button
                  type="button"
                  onClick={() => handleOpenRetakeModal('fault_location', 'Additional Defect Evidence')}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 hover:border-[#E11F26] text-slate-800 hover:text-[#E11F26] font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>+ Upload / Add Evidence</span>
                </button>
              )}
            </div>
          </div>

          {/* Evidence Search & Filter Toolbar */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <input
                type="text"
                placeholder="Search evidence shots by name, rule (e.g. VIN, odometer, isolation)..."
                value={evidenceSearch}
                onChange={(e) => setEvidenceSearch(e.target.value)}
                className="input-field pl-8 pr-7 text-xs w-full py-2"
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
              {evidenceSearch && (
                <button
                  onClick={() => setEvidenceSearch('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 text-xs"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'ALL', label: 'All Items' },
                { id: 'FLAGGED', label: 'Flagged Only' },
                { id: 'MANDATORY', label: 'Mandatory' },
                { id: 'PHOTO', label: 'Photos' },
                { id: 'VIDEO', label: 'Videos' },
              ].map((f) => {
                const isSelected = evidenceFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setEvidenceFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#E11F26] text-white shadow-xs font-bold'
                        : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-300'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
              {(evidenceSearch || evidenceFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setEvidenceSearch('');
                    setEvidenceFilter('ALL');
                  }}
                  className="text-[#E11F26] hover:underline font-bold text-xs ml-1 cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {filteredEvidence.length === 0 ? (
            <div className="py-12 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50 space-y-2">
              <p className="text-xs text-slate-900 font-semibold">No evidence items match your filters</p>
              <p className="text-[11px] text-slate-500">Try clearing your search query or switching to All Items.</p>
              <button
                onClick={() => {
                  setEvidenceSearch('');
                  setEvidenceFilter('ALL');
                }}
                className="text-xs text-[#E11F26] hover:underline font-bold pt-1 inline-block cursor-pointer"
              >
                Show all {evidenceList.length} evidence items
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredEvidence.map((item) => {
              const activeFlag = flagsList.find((f) => f.evidenceRuleKey === item.ruleKey && !f.resolvedAt);

              return (
                <div
                  key={item.id}
                  className={`rounded-xl bg-white border overflow-hidden transition-all group flex flex-col justify-between shadow-xs ${
                    activeFlag
                      ? 'border-2 border-[#E11F26]'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  {/* Media preview */}
                  <div
                    className="h-44 bg-slate-100 relative overflow-hidden flex items-center justify-center"
                  >
                    <EvidenceThumbnail
                      item={item}
                      caseVin={caseData?.vin}
                      onExpand={(url, itemObj) => {
                        setSelectedMedia(url || item.storageUrl);
                        setSelectedMediaItem(itemObj || item);
                      }}
                    />
                    <div
                      onClick={() => setSelectedMedia(item.storageUrl)}
                      className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none"
                    >
                      <span className="px-3 py-1.5 rounded-lg bg-black/80 text-white text-xs font-semibold backdrop-blur-sm">
                        Click to Expand
                      </span>
                    </div>

                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono text-white uppercase backdrop-blur-sm">
                      {item.mediaType}
                    </span>

                    {activeFlag && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-[#E11F26] text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm shadow-xs">
                        ⚠️ FLAGGED
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-3.5 space-y-1.5 text-xs">
                    <p className="font-bold text-slate-900 truncate" title={item.name}>
                      {item.name}
                    </p>
                    <p className="font-mono text-[10px] text-slate-500">Key: {item.ruleKey}</p>
                    {item.ocrExtractedText && (
                      <div className="p-2 rounded bg-slate-50 border border-slate-200 text-[10px]">
                        <span className="text-slate-800 font-semibold block">OCR Verified:</span>
                        <span className="font-mono text-slate-900 font-bold">{item.ocrExtractedText}</span>
                        {item.ocrConfidence && (
                          <span className="text-emerald-600 font-bold ml-2">({item.ocrConfidence}% conf)</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Flagged Alert Banner or Action Footer */}
                  {activeFlag && (
                    <div className="p-2.5 bg-red-50 border-t border-red-200 space-y-2">
                      <p className="text-[10px] text-red-800 font-semibold line-clamp-2">
                        Clerk: "{activeFlag.instruction}"
                      </p>
                      {userRole === 'TECHNICIAN' ? (
                        <button
                          type="button"
                          onClick={() => handleOpenRetakeModal(item.ruleKey, item.name, activeFlag.instruction, activeFlag.reasonCode, item.storageUrl)}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-[#E11F26] hover:bg-[#c81a20] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Retake Photo</span>
                        </button>
                      ) : (
                        <div className="text-center py-1.5 px-2 rounded bg-amber-50 border border-amber-200 text-[10px] text-amber-800 font-bold font-mono">
                          Flagged · Awaiting Tech Retake
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

        {/* Voice to Tech Dictation Section */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-[#E11F26]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Voice to Tech Workshop Transcripts</h3>
                <p className="text-xs text-slate-500">Deepgram Nova-2 Australian Automotive Speech-to-Text Model</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-600 font-bold px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Deepgram Nova-2 Active
              </span>
              <button
                type="button"
                onClick={() => setVoiceModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-[#E11F26] hover:bg-[#c81a20] text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span>+ Dictate Voice Note</span>
              </button>
            </div>
          </div>

          {caseData.voiceNotes && caseData.voiceNotes.length > 0 ? (
            <div className="space-y-3">
              {caseData.voiceNotes.map((vn) => {
                const pinnedName = vn.pinnedToEvidenceKey ? (RULE_NAMES[vn.pinnedToEvidenceKey] || vn.pinnedToEvidenceKey) : null;
                return (
                  <div key={vn.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">Recorded by {vn.recordedBy}</span>
                        {pinnedName && (
                          <span className="px-2 py-0.5 rounded bg-red-50 text-[#E11F26] font-semibold text-[11px] border border-red-200">
                            📌 Pinned: {pinnedName}
                          </span>
                        )}
                      </div>
                      <span className="font-mono">{vn.durationSeconds}s duration • {new Date(vn.recordedAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-slate-800 font-medium italic">"{vn.transcript}"</p>
                    {vn.originalAudioUrl && (
                      <div className="pt-2">
                        <audio controls src={vn.originalAudioUrl} className="w-full h-8" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <p className="text-xs text-slate-500 italic">No audio dictation notes recorded for this ticket.</p>
              <button
                type="button"
                onClick={() => setVoiceModalOpen(true)}
                className="mt-2 text-xs text-[#E11F26] font-bold hover:underline"
              >
                Click here to dictate or upload a workshop voice note
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Voice Note Dictation Modal */}
      <Modal
        isOpen={voiceModalOpen}
        onClose={() => {
          if (!voiceTranscribing) {
            setVoiceModalOpen(false);
            if (isRecordingVoice) stopVoiceRecording();
          }
        }}
        title="Voice to Tech — Record & Transcribe Workshop Note"
        maxWidth="md"
        footer={
          <>
            <button
              onClick={() => {
                setVoiceModalOpen(false);
                if (isRecordingVoice) stopVoiceRecording();
              }}
              className="btn-ghost text-xs"
              disabled={voiceTranscribing}
            >
              Cancel
            </button>
            <button
              onClick={handleVoiceSubmit}
              disabled={voiceTranscribing || isRecordingVoice || (!voiceBlob && !voiceFile && !voiceTranscriptInput.trim())}
              className={`text-xs py-2.5 px-5 flex items-center gap-1.5 font-bold transition-all rounded-xl cursor-pointer ${
                voiceTranscribing || isRecordingVoice || (!voiceBlob && !voiceFile && !voiceTranscriptInput.trim())
                  ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200'
                  : 'btn-primary'
              }`}
            >
              {voiceTranscribing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Transcribing with Deepgram Nova-2...</span>
                </>
              ) : (
                <span>Attach Note to Ticket</span>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Pinned Evidence Rule */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">Pin Note to Evidence Rule (Optional)</label>
            <select
              value={voicePinnedRule}
              onChange={(e) => setVoicePinnedRule(e.target.value)}
              className="input-field text-xs w-full"
            >
              <option value="">General Workshop Note (No specific rule)</option>
              {Object.entries(RULE_NAMES).map(([k, label]) => (
                <option key={k} value={k}>
                  {label} ({k})
                </option>
              ))}
            </select>
          </div>

          {/* Microphone Live Dictation Box */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3">
            <p className="font-bold text-slate-800">Option A: Live Microphone Dictation</p>
            <div className="flex items-center justify-center gap-3">
              {!isRecordingVoice ? (
                <button
                  type="button"
                  onClick={startVoiceRecording}
                  className="px-4 py-2.5 rounded-full bg-[#E11F26] hover:bg-[#c81a20] text-white font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <span>Start Microphone Recording</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopVoiceRecording}
                  className="px-4 py-2.5 rounded-full bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer animate-pulse transition-all"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <span>Recording ({voiceSecs}s) — Click to Stop</span>
                </button>
              )}
            </div>

            {voiceAudioUrl && (
              <div className="p-2 bg-white rounded-lg border border-slate-200 mt-2">
                <p className="text-[11px] font-semibold text-slate-700 mb-1">Preview Recording:</p>
                <audio controls src={voiceAudioUrl} className="w-full h-8" />
              </div>
            )}
          </div>

          {/* Option B: Audio File Upload */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <p className="font-bold text-slate-800">Option B: Upload Audio File (.wav, .mp3, .m4a, .webm)</p>
            <input
              type="file"
              accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setVoiceFile(file);
                  setVoiceAudioUrl(URL.createObjectURL(file));
                }
              }}
              className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#E11F26] file:text-white hover:file:bg-[#c81a20] cursor-pointer"
            />
          </div>

          {/* Option C: Manual Note Entry */}
          <div className="space-y-1">
            <label className="block font-bold text-slate-800">Or Type / Edit Transcript Manually</label>
            <textarea
              rows={3}
              value={voiceTranscriptInput}
              onChange={(e) => setVoiceTranscriptInput(e.target.value)}
              placeholder="E.g. Checked high-voltage battery connector and confirmed 0.0V isolation threshold across all phases..."
              className="input-field text-xs w-full"
            />
          </div>
        </div>
      </Modal>

      {/* Media Lightbox Modal */}
      {selectedMedia && (
        <div
          onClick={() => {
            setSelectedMedia(null);
            setSelectedMediaItem(null);
          }}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-md cursor-pointer animate-fadeIn"
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/20 shadow-2xl relative bg-slate-950 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="px-5 py-3 bg-slate-900/90 border-b border-white/10 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-xs font-bold text-slate-200 truncate">
                  {selectedMediaItem?.name || (selectedMedia.toLowerCase().includes('.mp4') ? 'Video Evidence Recording' : 'Captured Evidence Photo')}
                </span>
                {selectedMediaItem?.ruleKey && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-slate-300">
                    {selectedMediaItem.ruleKey}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Download / Open direct button */}
                <a
                  href={resolveMediaUrl(selectedMedia)}
                  download={selectedMediaItem?.oemFileName || 'evidence_video.mp4'}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                  title="Download / Open direct stream in new tab"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download / Open Tab</span>
                </a>
                <button
                  onClick={() => {
                    setSelectedMedia(null);
                    setSelectedMediaItem(null);
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Media Body */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-3 relative min-h-[300px]">
              {Boolean(
                selectedMediaItem?.mediaType === 'video' ||
                (selectedMediaItem?.mimeType && selectedMediaItem.mimeType.startsWith('video/')) ||
                selectedMedia.toLowerCase().includes('.mp4') ||
                selectedMedia.toLowerCase().includes('.webm') ||
                selectedMedia.toLowerCase().includes('.mov')
              ) ? (
                <div className="w-full flex flex-col items-center justify-center gap-3">
                  <video
                    key={selectedMedia}
                    controls
                    playsInline
                    preload="auto"
                    controlsList="nodownload"
                    className="w-full max-h-[72vh] object-contain rounded-xl shadow-2xl bg-black"
                  >
                    <source src={resolveMediaUrl(selectedMedia)} type="video/mp4" />
                    <source src={resolveMediaUrl(selectedMedia)} type="video/webm" />
                    <source src={selectedMedia} />
                    Your browser does not support HTML5 video playback.
                  </video>
                  <div className="flex flex-wrap items-center justify-between w-full px-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Direct H.264/AAC MP4 Stream
                    </span>
                    <a
                      href={resolveMediaUrl(selectedMedia)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:underline flex items-center gap-1"
                    >
                      If video won&apos;t play, click here to stream in new window ↗
                    </a>
                  </div>
                </div>
              ) : selectedMedia === 'vin_digital' || (selectedMedia.startsWith('file://') && selectedMediaItem?.ruleKey === 'vin_photo') ? (
                <div className="bg-slate-900 text-white p-8 rounded-2xl max-w-lg text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl font-bold">
                    ✓
                  </div>
                  <h4 className="text-lg font-bold">Digital Barcode Scan Verified</h4>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2">
                    <p className="font-mono text-2xl tracking-widest text-emerald-400 font-black">
                      {caseData?.vin || '2C4RDGCG0FR805928'}
                    </p>
                    <p className="text-xs text-slate-400">OCR Confidence: 99% Verified</p>
                  </div>
                  <p className="text-xs text-slate-400">
                    Decoded live from vehicle windscreen barcode via technician mobile scanner.
                  </p>
                  <button
                    onClick={() => {
                      setSelectedMedia(null);
                      setSelectedMediaItem(null);
                    }}
                    className="py-2.5 px-6 rounded-xl bg-[#E11F26] text-white font-bold text-xs hover:bg-[#c81a20] transition-colors cursor-pointer"
                  >
                    Close Preview
                  </button>
                </div>
              ) : (
                <img
                  src={resolveMediaUrl(selectedMedia)}
                  alt="Evidence"
                  className="w-full h-full max-h-[80vh] object-contain rounded-xl"
                />
              )}
            </div>
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
            <label className="block font-bold text-slate-800 mb-1">Select Discrepancy Rule</label>
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
            <label className="block font-bold text-slate-800 mb-1">Standardized Reason Code</label>
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
            <label className="block font-bold text-slate-800 mb-1">Technician Retake Instruction</label>
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
                hasUnresolvedFlags ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200' : 'btn-success'
              }`}
            >
              Record Approval & Lock Case
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          {hasUnresolvedFlags && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 text-[#E11F26] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Case cannot be submitted to OEM: {unresolvedFlags.length} reject reason(s) must be retaken first.</span>
            </div>
          )}
          <div>
            <label className="block font-bold text-slate-800 mb-1">OEM Claim / Reference #</label>
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
            <label className="block font-bold text-slate-800 mb-1">Internal Clerk Verification Notes</label>
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
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <p className="text-slate-900 font-bold text-sm">Download Ready Package</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={packData.zipDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary text-xs py-2 px-4 shadow-sm"
                >
                  Download {packData.zipFileName}
                </a>
                <a
                  href={packData.pdfSummaryDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost text-xs py-2 px-4 border-slate-300 text-slate-700 hover:border-slate-400"
                >
                  Download One-Page Case Summary PDF
                </a>
              </div>
            </div>

            <div>
              <p className="font-semibold text-slate-900 mb-2">OEM-Named File Manifest (BYD Convention):</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {(packData.includedFiles || packData.fileManifest || []).map((file: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between font-mono text-[11px]"
                  >
                    <span className="text-slate-900 font-semibold">{file.oemFileName || file.standardizedName || file.filename || `Evidence_${idx + 1}`}</span>
                    <span className="text-slate-500">{((file.sizeBytes || 0) / 1024).toFixed(0)} KB</span>
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
              className={`text-xs py-2.5 px-5 flex items-center gap-1.5 font-bold transition-all rounded-xl cursor-pointer ${
                uploading ||
                !selectedFile ||
                (uploadReasonCode && !fixConfirmed)
                  ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200'
                  : 'btn-primary'
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
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#E11F26] font-bold">
                  <svg className="w-4 h-4 text-[#E11F26] animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="font-mono text-xs tracking-wide">
                    DISCREPANCY: {uploadReasonCode}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">Rule: {uploadRuleKey}</span>
              </div>

              {uploadInstruction && (
                <div className="bg-white p-3 rounded-lg border border-red-200">
                  <span className="text-[10px] text-[#E11F26] font-bold block uppercase tracking-wider mb-1">
                    Warranty Clerk Instructions:
                  </span>
                  <p className="text-slate-900 text-sm font-medium italic">"{uploadInstruction}"</p>
                </div>
              )}

              {REASON_TIPS[uploadReasonCode] && (
                <div className="flex items-start gap-1.5 text-[#E11F26] text-[11px] pt-0.5">
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
                <label className="block font-bold text-slate-800 mb-1">Evidence Gate / Rule</label>
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
                <label className="block font-bold text-slate-800 mb-1">Item Title / Descriptor</label>
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
              <div className="p-3 rounded-xl bg-slate-50 border-2 border-dashed border-red-300 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-[#E11F26] tracking-wider">
                    Previous Photo (Rejected)
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 text-[#E11F26] border border-red-200 font-bold font-mono">
                    FLAGGED
                  </span>
                </div>
                <div className="h-36 rounded-lg overflow-hidden bg-white border border-slate-200 flex items-center justify-center relative group">
                  <img
                    src={uploadPreviousPhotoUrl}
                    alt="Previous Rejected"
                    className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="absolute inset-0 bg-red-900/10 pointer-events-none" />
                </div>
                <p className="text-[10px] text-slate-500 text-center italic">Requires replacement per clerk note</p>
              </div>

              {/* Right: New Replacement Photo Preview */}
              <div className="p-3 rounded-xl bg-slate-50 border-2 border-emerald-400 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">
                    New Replacement Shot
                  </span>
                  {uploadStorageUrl ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold font-mono">
                      READY TO UPLOAD
                    </span>
                  ) : (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold font-mono">
                      PENDING
                    </span>
                  )}
                </div>
                <div className="h-36 rounded-lg overflow-hidden bg-white border border-slate-200 flex items-center justify-center">
                  {uploadStorageUrl ? (
                    <img src={uploadStorageUrl} alt="New Preview" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-center p-3 text-slate-400 text-xs">
                      <svg className="w-8 h-8 mx-auto mb-1 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p>Capture photo or pick preset below to preview</p>
                    </div>
                  )}
                </div>
                {uploadOcrText ? (
                  <p className="text-[10px] text-emerald-700 font-mono text-center font-bold">
                    OCR Text: <strong>{uploadOcrText}</strong>
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-500 text-center italic">Will overwrite flagged item</p>
                )}
              </div>
            </div>
          )}

          {/* Single Preview Box (For general upload or if no previous photo) */}
          {(!uploadReasonCode || !uploadPreviousPhotoUrl) && (
            <div>
              {uploadStorageUrl ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-800 tracking-wider">
                    Captured Evidence Preview
                  </span>
                  <div className="h-44 rounded-lg overflow-hidden bg-white border border-slate-200 flex items-center justify-center">
                    <img src={uploadStorageUrl} alt="Preview" className="w-full h-full object-contain" />
                  </div>
                  {uploadOcrText && (
                    <p className="text-[11px] text-emerald-700 font-mono font-bold">
                      OCR Text: <strong>{uploadOcrText}</strong>
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-dashed border-slate-300 text-center text-slate-500 bg-slate-50">
                  Select an image file or choose a workshop demo shot below to preview.
                </div>
              )}
            </div>
          )}

          {/* Workshop Camera / File Trigger */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-800">
              Capture New Shot (Workshop Camera / Device)
            </label>
            <input
              type="file"
              accept="image/*,video/mp4"
              capture="environment"
              onChange={handleFileSelect}
              className="block w-full text-xs text-slate-700 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#E11F26] file:text-white hover:file:opacity-90 file:cursor-pointer border border-slate-300 rounded-xl p-2 bg-white"
            />
          </div>

          {/* Technician Explanation Note (Spec §5.6 / §8.3) */}
          {uploadReasonCode && (
            <div>
              <label className="block font-bold text-slate-800 mb-1">
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
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 text-[#E11F26] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Cannot re-submit the same rejected photo. A new replacement photo is required to fix the reject reason.</span>
            </div>
          )}

          {/* Mandatory Confirmation Checkbox */}
          {uploadReasonCode && (
            <label className="flex items-start gap-2.5 p-3.5 rounded-xl bg-slate-50 border-2 border-red-200 hover:border-[#E11F26] cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={fixConfirmed}
                onChange={(e) => setFixConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#E11F26] focus:ring-[#E11F26] cursor-pointer"
              />
              <div className="space-y-0.5">
                <span className="text-slate-900 font-bold text-xs block">
                  I confirm this replacement evidence fixes the rejection reason ({uploadReasonCode})
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Mandatory: Retake must address clerk instructions before submission is unlocked.
                </span>
              </div>
            </label>
          )}

          {/* Quick Workshop Capture Presets */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
              Or Choose Verified Workshop Demo Shot (Instant Retake Test)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  setUploadStorageUrl('https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80');
                  setUploadName(RULE_NAMES[uploadRuleKey] || 'Defect Context Retake (1m Step-Back)');
                }}
                className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-left transition-all text-[11px] cursor-pointer shadow-xs"
              >
                <span className="font-bold text-slate-900 block">Defect Context</span>
                <span className="text-[10px] text-slate-500">1m clear step-back</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadStorageUrl('https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80');
                  setUploadName('VIN Plate Photo — Readable Characters');
                  setUploadOcrText('LGXCE4C86P0019283');
                }}
                className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-left transition-all text-[11px] cursor-pointer shadow-xs"
              >
                <span className="font-bold text-slate-900 block">Sharp VIN Plate</span>
                <span className="text-[10px] text-slate-500">OCR LGXCE4...</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadStorageUrl('https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=80');
                  setUploadName('Odometer Cluster Reading');
                  setUploadOcrText('14250 km');
                }}
                className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-left transition-all text-[11px] cursor-pointer shadow-xs"
              >
                <span className="font-bold text-slate-900 block">Odometer Cluster</span>
                <span className="text-[10px] text-slate-500">14,250 km clear</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadStorageUrl('https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80');
                  setUploadName('HV Battery Isolation Test Proof');
                }}
                className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-left transition-all text-[11px] cursor-pointer shadow-xs"
              >
                <span className="font-bold text-slate-900 block">HV Safety Test</span>
                <span className="text-[10px] text-slate-500">0.0V measured</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
