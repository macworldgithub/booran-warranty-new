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

export type MediaType = 'image' | 'video' | 'document' | 'audio';

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

export interface BrandPackRule {
  id: string;
  ruleKey: string;
  name: string;
  description: string;
  mediaType: MediaType;
  tier: number;
  isMandatory: boolean;
  namingConvention: string;
  guidanceText?: string;
  exampleImageUrl?: string;
  faultCategorySpecific?: string[];
}

export interface BrandPack {
  id: string;
  brandId: string;
  brandName?: string;
  name: string;
  description?: string;
  version: number;
  status?: 'Active' | 'Draft' | 'Deprecated' | string;
  isPublished: boolean;
  publishedAt?: string;
  rules: BrandPackRule[];
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceItem {
  id: string;
  ruleKey: string;
  name: string;
  mediaType: MediaType;
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
  technicianNote?: string;
}

export interface ChecklistItem {
  ruleKey: string;
  name: string;
  category: 'Tier 1' | 'Tier 2' | 'Conditional';
  instruction: string;
  mediaType: MediaType;
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

  // Nested vehicle structure
  vehicle?: {
    vin: string;
    odometer: number;
    make: string;
    model: string;
    year: number;
    powertrain: PowertrainType;
  };
  // Flat vehicle properties
  vin?: string;
  odometer?: number;
  make?: string;
  model?: string;
  year?: number;
  powertrain?: PowertrainType;

  // Nested concern structure
  concern?: {
    title: string;
    faultCategory: FaultCategory;
    partReplaced: boolean;
    noiseFault: boolean;
    diagnosticsAvailable: boolean;
    repairStage: RepairStage;
  };
  // Flat concern properties
  concernTitle?: string;
  faultCategory?: FaultCategory;
  partReplaced?: boolean;
  noiseFault?: boolean;
  diagnosticsAvailable?: boolean;
  repairStage?: RepairStage;

  // Evidence & lists
  evidence?: EvidenceItem[];
  evidenceItems?: EvidenceItem[];
  voiceNotes?: VoiceNote[];
  flags?: FlagItem[];
  flagHistory?: FlagItem[];
  clerkNotes?: string[];
  checklist?: ChecklistItem[];
  checklistSummary?: ChecklistSummary;
}

export interface DashboardKPIs {
  totalCasesOpened: number;
  submittedSameDayPercent: number;
  activeFlaggedCases: number;
  avgWorkshopToSubmittedHours: number;
  activeRooftopsCount: number;
  activeBrandsCount: number;
}

export interface FlagReasonStat {
  reasonCode: FlagReasonCode;
  label: string;
  count: number;
  percent: number;
  percentage?: number;
}

export interface SitePerformance {
  siteId: string;
  siteName: string;
  roPrefix: string;
  totalCases: number;
  firstTimePassRate: number;
  avgHoursToSubmit: number;
  flaggedCount: number;
}

export interface SubmissionPackResponse {
  caseId: string;
  roNumber: string;
  claimNumber?: string;
  brandName: string;
  siteName: string;
  generatedAt: string;
  summaryPdfUrl?: string;
  pdfSummaryDownloadUrl?: string;
  zipPackageUrl?: string;
  zipDownloadUrl?: string;
  zipFileName?: string;
  fileManifest?: {
    ruleKey: string;
    mediaType: string;
    originalName: string;
    standardizedName: string;
    storageUrl: string;
    ocrVerified: boolean;
    sizeBytes: number;
  }[];
  includedFiles?: {
    ruleKey?: string;
    mediaType?: string;
    originalName?: string;
    standardizedName?: string;
    storageUrl?: string;
    ocrVerified?: boolean;
    sizeBytes?: number;
    filename?: string;
    category?: string;
    evidenceRuleName?: string;
  }[];
}

export interface DecodedVehicle {
  vin: string;
  make: string;
  model: string;
  year: number;
  powertrain: PowertrainType;
  provider: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}
