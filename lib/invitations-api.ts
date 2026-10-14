export interface Invitation {
  id: string; name: string; email: string; siteId: string; role: 'TECHNICIAN';
  status: 'SENDING' | 'PENDING' | 'EXPIRED' | 'DELIVERY_FAILED' | 'CANCELLED' | 'ACCEPTED';
  expiresAt: string; createdAt: string; sentAt?: string; deliveryError?: string;
}
export interface InvitationDetails { name: string; email: string; siteName: string; role: string; expiresAt: string }
async function request<T>(path = '', body?: unknown, signal?: AbortSignal, publicRequest = false): Promise<T> {
  const token = publicRequest ? null : localStorage.getItem('booran_auth_token') || localStorage.getItem('booran_jwt');
  const response = await fetch(`/api/v1/invitations${path}`, {
    method: body === undefined ? 'GET' : 'POST', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json', ...(!publicRequest ? { Authorization: `Bearer ${token || ''}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(', ') : result.message || 'Unable to process this invitation.');
  return result;
}
export const invitationsApi = {
  list: (signal?: AbortSignal) => request<Invitation[]>('', undefined, signal),
  create: (input: { name: string; email: string; siteId: string }) => request<Invitation>('', input),
  resend: (id: string) => request<Invitation>(`/${encodeURIComponent(id)}/resend`, {}),
  cancel: (id: string) => request<Invitation>(`/${encodeURIComponent(id)}/cancel`, {}),
  inspect: (token: string, signal?: AbortSignal) => request<InvitationDetails>('/inspect', { token }, signal, true),
  accept: (token: string, password: string) => request<{ success: boolean; message: string }>('/accept', { token, password }, undefined, true),
};
