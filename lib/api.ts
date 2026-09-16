import {
  UserProfile,
  Site,
  Brand,
  BrandPack,
  BrandPackRule,
  WarrantyCase,
  DashboardKPIs,
  FlagReasonStat,
  SitePerformance,
  SubmissionPackResponse,
  DecodedVehicle,
  FaultCategory,
  FlagReasonCode,
  MediaType,
  PaginatedResult,
} from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

function getAuthHeader(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("booran_auth_token") || localStorage.getItem("booran_jwt");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const userStr = localStorage.getItem("booran_user") || localStorage.getItem("booran_user_profile");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role) {
          headers["X-User-Role"] = user.role;
        }
        if (user.id) {
          headers["X-User-Id"] = user.id;
        }
        if (user.name) {
          headers["X-User-Name"] = user.name;
        }
      } catch {
        // ignore
      }
    }
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}: ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson.message) {
        errorMsg = Array.isArray(errJson.message)
          ? errJson.message.join(", ")
          : errJson.message;
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export const api = {
  // Auth
  auth: {
    async login(payload: {
      email: string;
      password: string;
      role?: string;
    }): Promise<{ accessToken: string; user: UserProfile }> {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let errorMsg = "Authentication failed. Please check your credentials.";
        try {
          const errJson = await res.json();
          if (errJson.message) {
            errorMsg = Array.isArray(errJson.message)
              ? errJson.message.join(", ")
              : errJson.message;
          }
        } catch {
          /* ignore */
        }
        throw new Error(errorMsg);
      }
      return res.json();
    },
    async signup(payload: {
      name: string;
      email: string;
      password: string;
      role: string;
      siteId?: string;
    }): Promise<{ accessToken: string; user: UserProfile }> {
      const res = await fetch(`${BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let errorMsg = "Registration failed. Please check your details.";
        try {
          const errJson = await res.json();
          if (errJson.message) {
            errorMsg = Array.isArray(errJson.message)
              ? errJson.message.join(", ")
              : errJson.message;
          }
        } catch {
          /* ignore */
        }
        throw new Error(errorMsg);
      }
      return res.json();
    },

    getMe: async (): Promise<UserProfile> => {
      const res = await fetch(`${BASE_URL}/auth/me`, {
        headers: getAuthHeader(),
      });
      return handleResponse(res);
    },
    getUsers: async (): Promise<UserProfile[]> => {
      const res = await fetch(`${BASE_URL}/auth/users`, {
        headers: getAuthHeader(),
      });
      return handleResponse(res);
    },
  },

  async getMe(): Promise<UserProfile> {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async getUsers(): Promise<UserProfile[]> {
    const res = await fetch(`${BASE_URL}/auth/users`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  // Sites
  async getSites(): Promise<Site[]> {
    const res = await fetch(`${BASE_URL}/sites`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async getSite(id: string): Promise<Site> {
    const res = await fetch(`${BASE_URL}/sites/${id}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async getSiteAuthorizedBrands(id: string): Promise<{ authorizedBrandIds: string[] }> {
    const res = await fetch(`${BASE_URL}/sites/${id}/brands`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async createSite(data: {
    name: string;
    location: string;
    roPrefix: string;
    authorizedBrandIds?: string[];
  }): Promise<Site> {
    const res = await fetch(`${BASE_URL}/sites`, {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateSite(id: string, data: {
    name?: string;
    location?: string;
    roPrefix?: string;
    isActive?: boolean;
  }): Promise<Site> {
    const res = await fetch(`${BASE_URL}/sites/${id}`, {
      method: "PATCH",
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateSiteBrands(id: string, authorizedBrandIds: string[]): Promise<Site> {
    const res = await fetch(`${BASE_URL}/sites/${id}/brands`, {
      method: "PATCH",
      headers: getAuthHeader(),
      body: JSON.stringify({ authorizedBrandIds }),
    });
    return handleResponse(res);
  },

  async deactivateSite(id: string): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/sites/${id}`, {
      method: "DELETE",
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  // Brands
  async getBrands(): Promise<Brand[]> {
    const res = await fetch(`${BASE_URL}/brands`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async getBrand(id: string): Promise<Brand> {
    const res = await fetch(`${BASE_URL}/brands/${id}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async createBrand(data: {
    name: string;
    description: string;
    seedChecklistReference?: string;
  }): Promise<Brand> {
    const res = await fetch(`${BASE_URL}/brands`, {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateBrand(id: string, data: {
    name?: string;
    description?: string;
    seedChecklistReference?: string;
    isActive?: boolean;
  }): Promise<Brand> {
    const res = await fetch(`${BASE_URL}/brands/${id}`, {
      method: "PATCH",
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deactivateBrand(id: string): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/brands/${id}`, {
      method: "DELETE",
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },


  // Brand Packs
  async getBrandPacks(): Promise<BrandPack[]> {
    const res = await fetch(`${BASE_URL}/brand-packs`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async getBrandPack(id: string): Promise<BrandPack> {
    const res = await fetch(`${BASE_URL}/brand-packs/${id}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async getActiveBrandPack(brandId: string): Promise<BrandPack> {
    const res = await fetch(`${BASE_URL}/brand-packs/brand/${brandId}/active`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async evaluateRules(data: {
    brandId: string;
    faultCategory: FaultCategory;
    partReplaced: boolean;
    noiseFault: boolean;
    diagnosticsAvailable: boolean;
    repairStage: string;
  }): Promise<{
    brandPackId: string;
    brandPackVersion: number;
    packName: string;
    resolvedRules: string[];
    mandatoryCount: number;
    optionalCount: number;
  }> {
    const res = await fetch(`${BASE_URL}/brand-packs/evaluate-rules`, {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async cloneBrandPackVersion(id: string): Promise<BrandPack> {
    const res = await fetch(`${BASE_URL}/brand-packs/${id}/clone-version`, {
      method: "POST",
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async publishBrandPackVersion(id: string): Promise<BrandPack> {
    const res = await fetch(`${BASE_URL}/brand-packs/${id}/publish`, {
      method: "POST",
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async addBrandPackRule(packId: string, rule: Partial<BrandPackRule>): Promise<BrandPack> {
    const res = await fetch(`${BASE_URL}/brand-packs/${packId}/rules`, {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify(rule),
    });
    return handleResponse(res);
  },

  async batchAddBrandPackRules(packId: string, rules: Partial<BrandPackRule>[]): Promise<BrandPack> {
    const res = await fetch(`${BASE_URL}/brand-packs/${packId}/rules/batch`, {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ rules }),
    });
    return handleResponse(res);
  },

  // Warranty Cases
  async getWarrantyCases(params?: {
    siteId?: string;
    brandId?: string;
    status?: string;
    technicianId?: string;
    technicianName?: string;
    ro?: string;
    vin?: string;
    search?: string;
    flaggedOnly?: boolean;
    agedHours?: number;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<WarrantyCase>> {
    const query = new URLSearchParams();
    if (params?.siteId) query.append("siteId", params.siteId);
    if (params?.brandId) query.append("brandId", params.brandId);
    if (params?.status) query.append("status", params.status);
    if (params?.technicianId) query.append("technicianId", params.technicianId);
    if (params?.technicianName) query.append("technicianName", params.technicianName);
    if (params?.ro) query.append("ro", params.ro);
    if (params?.vin) query.append("vin", params.vin);
    if (params?.search) query.append("search", params.search);
    if (params?.flaggedOnly) query.append("flaggedOnly", "true");
    if (params?.agedHours)
      query.append("agedHours", params.agedHours.toString());
    if (params?.page) query.append("page", params.page.toString());
    if (params?.limit) query.append("limit", params.limit.toString());

    const qs = query.toString();
    const url = `${BASE_URL}/warranty-cases${qs ? "?" + qs : ""}`;
    const res = await fetch(url, {
      headers: getAuthHeader(),
    });
    const result = await handleResponse<any>(res);
    if (Array.isArray(result)) {
      return {
        data: result,
        meta: {
          total: result.length,
          page: 1,
          limit: result.length || 10,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }
    return result;
  },

  async getCase(id: string): Promise<WarrantyCase> {
    const res = await fetch(`${BASE_URL}/warranty-cases/${id}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async createCase(data: {
    siteId: string;
    brandId: string;
    roNumber: string;
    claimNumber?: string;
    vin: string;
    odometer: number;
    make: string;
    model: string;
    year: number;
    powertrain: "EV" | "Hybrid" | "PHEV" | "ICE";
    technicianId: string;
    technicianName: string;
    concernTitle: string;
    faultCategory: FaultCategory;
    partReplaced: boolean;
    noiseFault: boolean;
    diagnosticsAvailable: boolean;
    repairStage: "Pre-repair only" | "During repair" | "Repair complete";
    creatorRole?: string;
  }): Promise<WarrantyCase> {
    const res = await fetch(`${BASE_URL}/warranty-cases`, {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async addEvidence(
    caseId: string,
    data: {
      ruleKey: string;
      name: string;
      mediaType: MediaType;
      storageUrl: string;
      ocrExtractedText?: string;
      ocrConfidence?: number;
      durationSeconds?: number;
      technicianNote?: string;
    },
  ): Promise<WarrantyCase> {
    const res = await fetch(`${BASE_URL}/warranty-cases/${caseId}/evidence`, {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // Real multipart file upload â€” S3 or local disk
  async uploadEvidenceFile(
    caseId: string,
    file: File,
    ruleKey: string,
    evidenceName?: string,
    ocrExtractedText?: string,
  ): Promise<WarrantyCase> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("ruleKey", ruleKey);
    if (evidenceName) formData.append("evidenceName", evidenceName);
    if (ocrExtractedText) formData.append("ocrExtractedText", ocrExtractedText);

    // Build auth headers WITHOUT Content-Type â€” browser sets multipart boundary automatically
    const headers: Record<string, string> = {};
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("booran_auth_token") || localStorage.getItem("booran_jwt");
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const userStr = localStorage.getItem("booran_user") || localStorage.getItem("booran_user_profile");
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.role) headers["X-User-Role"] = user.role;
          if (user.id) headers["X-User-Id"] = user.id;
          if (user.name) headers["X-User-Name"] = user.name;
        } catch { /* ignore */ }
      }
    }

    const res = await fetch(`${BASE_URL}/warranty-cases/${caseId}/evidence/upload`, {
      method: "POST",
      headers,
      body: formData,
    });
    return handleResponse(res);
  },

  async addVoiceNote(
    caseId: string,
    data: {
      transcript: string;
      durationSeconds: number;
      recordedBy: string;
      originalAudioUrl?: string;
      pinnedToEvidenceKey?: string;
    },
  ): Promise<WarrantyCase> {
    const res = await fetch(
      `${BASE_URL}/warranty-cases/${caseId}/voice-notes`,
      {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify(data),
      },
    );
    return handleResponse(res);
  },

  async submitFromWorkshop(caseId: string): Promise<WarrantyCase> {
    const res = await fetch(
      `${BASE_URL}/warranty-cases/${caseId}/submit-from-workshop`,
      {
        method: "POST",
        headers: getAuthHeader(),
      },
    );
    return handleResponse(res);
  },

  async flagCase(
    caseId: string,
    data: {
      evidenceRuleKey: string;
      reasonCode: FlagReasonCode;
      instruction: string;
      flaggedBy: string;
    },
  ): Promise<WarrantyCase> {
    const res = await fetch(`${BASE_URL}/warranty-cases/${caseId}/flag`, {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async markSubmitted(
    caseId: string,
    data: {
      claimNumber: string;
      clerkNote?: string;
    },
  ): Promise<WarrantyCase> {
    const res = await fetch(
      `${BASE_URL}/warranty-cases/${caseId}/mark-submitted`,
      {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify(data),
      },
    );
    return handleResponse(res);
  },

  // Vehicle / VIN Decoder
  async decodeVin(vin: string): Promise<DecodedVehicle> {
    const res = await fetch(`${BASE_URL}/vehicle/decode-vin`, {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ vin }),
    });
    return handleResponse(res);
  },

  // Voice to Tech
  getLiveVoiceWebSocketUrl(): string {
    if (typeof window === "undefined") return "";
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = process.env.NEXT_PUBLIC_API_URL
      ? new URL(process.env.NEXT_PUBLIC_API_URL).host
      : "localhost:4000";
    return `${wsProto}//${host}/api/v1/voice-to-tech/live`;
  },

  async transcribeAudio(data: {
    audioUrl?: string;
    audioBase64?: string;
    technicianName?: string;
  }): Promise<{
    transcript: string;
    confidence: number;
    durationSeconds: number;
    model: string;
    engine: string;
  }> {
    const res = await fetch(`${BASE_URL}/voice-to-tech/transcribe`, {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // Submission Pack Export
  async getSubmissionPack(caseId: string): Promise<SubmissionPackResponse> {
    const res = await fetch(`${BASE_URL}/submission-pack/${caseId}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  // Dashboard Analytics
  async getKPIs(): Promise<DashboardKPIs> {
    const res = await fetch(`${BASE_URL}/dashboard/kpis`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async getFlagReasons(): Promise<FlagReasonStat[]> {
    const res = await fetch(`${BASE_URL}/dashboard/flag-reasons`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },

  async getSitePerformance(): Promise<SitePerformance[]> {
    const res = await fetch(`${BASE_URL}/dashboard/sites-performance`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },
};
