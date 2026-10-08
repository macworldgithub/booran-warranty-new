export function canReadHistoricalArchive(role: string, email: string) {
  return role === 'ADMIN' || (role === 'CLERK' && ['clerk@dandenong.com', 'clerk@morang.com', 'clerk@skoda.com'].includes(email.trim().toLowerCase()));
}

export interface ArchivedFile { id: string; name: string; originalPath: string; bytes: number }
export interface ArchivedJob { id: string; title: string; organisation: string; capturedAt: string | null; issues: string[]; fileCount: number }
export interface ArchivedDetail extends ArchivedJob { reportText: string; files: ArchivedFile[] }
export interface ArchivePage { items: ArchivedJob[]; total: number; archiveTotal: number; page: number; pages: number }

async function request(path: string, signal?: AbortSignal) {
  const token = localStorage.getItem('booran_auth_token') || localStorage.getItem('booran_jwt');
  const response = await fetch(`/api/v1/historical-archive${path}`, { headers: { Authorization: `Bearer ${token || ''}` }, cache: 'no-store', signal });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Unable to load the historical archive.');
  }
  return response;
}
export const historicalArchive = {
  list: async (search: string, page: number, signal?: AbortSignal): Promise<ArchivePage> => (await request(`?${new URLSearchParams({ search, page: String(page) })}`, signal)).json(),
  detail: async (id: string, signal?: AbortSignal): Promise<ArchivedDetail> => (await request(`/${encodeURIComponent(id)}`, signal)).json(),
  download: async (id: string, file: ArchivedFile) => {
    const response = await request(`/${encodeURIComponent(id)}/files/${encodeURIComponent(file.id)}`);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url; link.download = file.name; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};
