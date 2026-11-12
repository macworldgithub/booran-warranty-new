export interface StaffQrLink {
  token: string;
  expiresAt: string;
}

export interface StaffInvitation {
  id: string;
  name: string;
  role: 'TECHNICIAN' | 'CLERK';
  siteIds: string[];
  expiresAt: string;
  status: 'PENDING' | 'USED' | 'REVOKED';
}

export async function staffQrRequest<T>(path: string, method: string, body?: unknown, isPublic = false): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!isPublic) {
    const token = localStorage.getItem('booran_auth_token') || localStorage.getItem('booran_jwt');
    headers.Authorization = `Bearer ${token || ''}`;
  }
  const response = await fetch(`/api/v1/auth/${path}`, {
    method, headers, cache: 'no-store', body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(Array.isArray(result.message) ? result.message.join(', ') : result.message || 'Unable to complete this request.');
  }
  return result;
}
