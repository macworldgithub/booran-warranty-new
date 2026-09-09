export type UserRole = 'ADMIN' | 'TECHNICIAN';

export type CaseStatus =
  | 'Draft'
  | 'Uploading'
  | 'Awaiting Review'
  | 'Flagged'
  | 'Submitted'
  | 'Closed'
  | 'Withdrawn';

export type PowertrainType = 'EV' | 'Hybrid' | 'PHEV' | 'ICE';

export type RepairStage = 'Pre-repair only' | 'During repair' | 'Repair complete';

export type FaultCategory =
  | 'Oil leaks or seepage'
  | 'ECU or sensor internal faults'
  | 'Software updates or program refreshes'
  | 'Battery and high-voltage (HV) components'
  | 'Charging system faults'
  | 'Powertrain, chassis or body component faults'
  | 'General / other (Tier 1 only)';

export type FlagReasonCode =
  | 'MISSING_SHOT'
  | 'UNREADABLE_VIN'
  | 'WRONG_ANGLE'
  | 'NO_SERIAL'
  | 'NO_DTC'
  | 'VIDEO_TOO_SHORT'
  | 'POOR_LIGHTING_BLUR'
  | 'INCORRECT_MEDIA_TYPE'
  | 'OTHER';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  defaultSiteId: string;
  authorizedSiteIds: string[];
}

export interface Site {
  id: string;
  code?: string;
  name: string;
  location: string;
  roPrefix: string;
  authorizedBrandIds: string[];
  isActive: boolean;
}

export interface Brand {
  id: string;
  code?: string;
  name: string;
  description: string;
  seedChecklistReference: string;
  activeBrandPackId: string;
  isActive: boolean;
}

export interface EvidenceItem {
  id: string;
  ruleKey: string;
  name: string;
  mediaType: 'image' | 'video' | 'document' | 'audio';
  originalFileName: string;
  oemFileName: string;
  storageUrl: string;
  thumbnailUrl?: string;
  ocrExtractedText?: string;
  ocrConfidence?: number;
  qualityStatus: 'PASS' | 'WARN_BLUR' | 'WARN_EXPOSURE' | 'FAIL';
  capturedAt: string;
  capturedBy: string;
  isVerifiedByClerk?: boolean;
}

export interface VoiceNote {
  id: string;
  pinnedToEvidenceKey?: string;
  transcript: string;
  originalAudioUrl?: string;
  durationSeconds: number;
  recordedBy: string;
  recordedAt: string;
  isEdited?: boolean;
}

export interface FlagItem {
  id: string;
  evidenceRuleKey: string;
  reasonCode: FlagReasonCode;
  instruction: string;
  flaggedBy: string;
  flaggedAt: string;
  resolved: boolean;
  resolvedAt?: string;
  technicianReply?: string;
}

export interface ChecklistItem {
  ruleKey: string;
  name: string;
  category: 'Tier 1' | 'Tier 2' | 'Conditional';
  instruction: string;
  mediaType: 'image' | 'video' | 'document' | 'audio';
  isMandatory: boolean;
  namingTemplate: string;
  isComplete: boolean;
  capturedItem?: EvidenceItem | null;
  activeFlag?: FlagItem | null;
}

export interface ChecklistSummary {
  totalRules: number;
  totalMandatory: number;
  completedMandatory: number;
  missingMandatoryKeys: string[];
  hasUnresolvedFlags: boolean;
  isReadyToSubmit: boolean;
}

export interface WarrantyCase {
  id: string;
  siteId: string;
  siteName: string;
  brandId: string;
  brandName: string;
  brandPackId: string;
  brandPackVersion: number;
  roNumber: string;
  claimNumber?: string;
  status: CaseStatus;
  technicianId: string;
  technicianName: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  vehicle: {
    vin: string;
    odometer: number;
    make: string;
    model: string;
    year: number;
    powertrain: PowertrainType;
  };
  concern: {
    title: string;
    faultCategory: FaultCategory;
    partReplaced: boolean;
    noiseFault: boolean;
    diagnosticsAvailable: boolean;
    repairStage: RepairStage;
  };
  evidence: EvidenceItem[];
  voiceNotes: VoiceNote[];
  flags: FlagItem[];
  clerkNotes: string[];
  checklist: ChecklistItem[];
  checklistSummary: ChecklistSummary;
}

export interface DashboardKPIs {
  totalCasesOpened: number;
  submittedSameDayPercent: number;
  activeFlaggedCases: number;
  avgWorkshopToSubmittedHours: number;
  activeRooftopsCount: number;
  activeBrandsCount: number;
}
