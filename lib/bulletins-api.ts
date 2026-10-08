import { WarrantyBulletin } from './types';
import { resolveMediaUrl } from './api';

async function request<T>(path = '', options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('booran_auth_token') || localStorage.getItem('booran_jwt');
  const response = await fetch(`/api/v1/warranty-bulletins${path}`, { ...options, headers: { Authorization: `Bearer ${token || ''}` } });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(Array.isArray(error.message) ? error.message.join(', ') : error.message || 'Bulletin request failed.');
  }
  return response.json();
}

export const bulletinsApi = {
  list: () => request<WarrantyBulletin[]>('?manage=true'),
  upload: (data: FormData) => request<WarrantyBulletin>('', { method: 'POST', body: data }),
  setPublished: (id: string, published: boolean) => request<WarrantyBulletin>(`/${encodeURIComponent(id)}/${published ? 'publish' : 'unpublish'}`, { method: 'PATCH' }),
  document: async (id: string) => resolveMediaUrl((await request<{ url: string }>(`/${encodeURIComponent(id)}/document`)).url),
};
