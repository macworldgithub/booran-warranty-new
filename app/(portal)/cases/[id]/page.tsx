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

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const caseId = params?.id as string;

  const [caseData, setCaseData] = useState<WarrantyCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('booran_user') || localStorage.getItem('booran_user_profile');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          setUserRole(user.role || '');
        } catch {
          // ignore
        }
      }
    }
  }, []);

  useEffect(() => {
    if (caseId) loadCase();
  }, [caseId]);

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
      const updated = await api.flagCase(caseId, {
        evidenceRuleKey: flagRuleKey || 'fault_location',
        reasonCode: flagReason,
        instruction: flagInstruction,
        flaggedBy: 'Sarah Jenkins (Warranty Clerk)',
      });
      setCaseData(updated);
      setFlagModalOpen(false);
      showToast('Case flagged and returned to technician queue', 'error');
    } catch (err: any) {
      showToast(err.message || 'Flag failed', 'error');
    }
  }

  async function handleMarkSubmitted() {
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
    try {
      const updated = await api.submitFromWorkshop(caseId);
      setCaseData(updated);
      showToast('Case successfully submitted to Warranty Clerk Review Queue!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Submission failed', 'error');
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
                      onClick={() => setSubmitModalOpen(true)}
                      className="btn-success text-xs py-2 px-4 flex items-center gap-1.5 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Approve & Submit</span>
                    </button>
                  </>
                )}
              </>
            )}

            {/* Technician Workshop Control - Submit to clerk when ready */}
            {userRole === 'TECHNICIAN' && (caseData.status === 'Draft' || caseData.status === 'Flagged') && (
              <button
                onClick={handleSubmitFromWorkshop}
                className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-[0_0_20px_rgba(0,240,255,0.3)]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Submit to Clerk Review</span>
              </button>
            )}
          </div>
        }
      />

      <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
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
            {caseData.claimNumber && (
              <p className="text-[11px] text-[#10b981] font-mono mt-2 pt-2 border-t border-[#1a56db]/10">
                Claim #: <strong>{caseData.claimNumber}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Flag History Alert (if any) */}
        {flagsList.length > 0 && (
          <div className="p-4 rounded-2xl bg-[#ef4444]/10 border border-[#ef4444]/30 space-y-2 animate-slideInLeft">
            <div className="flex items-center gap-2 text-xs font-bold text-[#ef4444] uppercase tracking-wider">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Case Flag Discrepancy Log</span>
            </div>
            {flagsList.map((flag, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-[#081225]/80 border border-[#ef4444]/20 text-xs">
                <div className="flex items-center justify-between text-[#ef4444] font-semibold mb-1">
                  <span>Reason: {flag.reasonCode} (Rule: {flag.evidenceRuleKey})</span>
                  <span className="text-[10px] text-[#64748b]">{new Date(flag.flaggedAt).toLocaleString()}</span>
                </div>
                <p className="text-[#cbd5e1] font-medium">"{flag.instruction}"</p>
                <p className="text-[10px] text-[#64748b] mt-1">— Flagged by {flag.flaggedBy}</p>
              </div>
            ))}
          </div>
        )}

        {/* Evidence Gallery Section */}
        <div className="glass-card-static p-6 border border-[#1a56db]/20 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Audit Evidence Pack Gallery</h3>
              <p className="text-xs text-[#cbd5e1]/70">BYD-WB-2602-02 Attachment A standardized shots & videos</p>
            </div>
            <span className="text-xs text-[#00f0ff] font-semibold">
              {evidenceList.length} Captured Items
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {evidenceList.map((item) => (
              <div
                key={item.id}
                className="rounded-xl bg-[#081225]/90 border border-[#1a56db]/20 overflow-hidden hover:border-[#00f0ff]/50 transition-all group flex flex-col justify-between"
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
              </div>
            ))}
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
            <button onClick={handleMarkSubmitted} className="btn-success text-xs">
              Record Approval & Lock Case
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
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
    </div>
  );
}
