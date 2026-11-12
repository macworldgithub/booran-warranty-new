'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { StaffQrCard } from '@/components/staff-qr-card';
import { staffQrRequest, type StaffInvitation, type StaffQrLink } from '@/lib/staff-qr';
import type { Site } from '@/lib/types';

export function StaffQrInvitations({ sites }: { sites: Site[] }) {
  const [items, setItems] = useState<StaffInvitation[]>([]);
  const [link, setLink] = useState<(StaffQrLink & { id: string }) | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const reload = async () => setItems(await staffQrRequest<StaffInvitation[]>('registration-qr', 'GET'));
  useEffect(() => { void reload().catch(err => setError(err.message)); }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const siteIds = form.getAll('siteIds').map(String);
    if (!siteIds.length) { setError('Select at least one dealership.'); return; }
    setBusy(true);
    setError('');
    try {
      setLink(await staffQrRequest<StaffQrLink & { id: string }>('registration-qr', 'POST', {
        name: form.get('name'), role: form.get('role'), siteIds,
      }));
      await reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create invitation.'); }
    finally { setBusy(false); }
  }

  async function revoke(id: string) {
    setBusy(true);
    setError('');
    try {
      await staffQrRequest(`registration-qr/${encodeURIComponent(id)}`, 'DELETE');
      setLink(previous => previous?.id === id ? null : previous);
      await reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not revoke invitation.'); }
    finally { setBusy(false); }
  }

  async function replace(id: string) {
    setBusy(true);
    setError('');
    try {
      setLink(await staffQrRequest<StaffQrLink & { id: string }>(`registration-qr/${encodeURIComponent(id)}/replace`, 'POST', {}));
      await reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not replace invitation.'); }
    finally { setBusy(false); }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Registration QR</h2>
      <p className="text-sm text-slate-600">Create a 24-hour invitation for a staff member without email.</p>
      <form onSubmit={create}>
        <fieldset disabled={busy} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">Staff name<input name="name" required maxLength={150} className="input-field mt-1" /></label>
            <label className="block text-sm font-medium">Role<select name="role" className="input-field mt-1"><option value="TECHNICIAN">Technician</option><option value="CLERK">Warranty Clerk</option></select></label>
          </div>
          <fieldset className="rounded-xl border p-3">
            <legend className="px-1 text-sm font-medium">Assigned dealerships</legend>
            <div className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">
              {sites.map(site => <label key={site.id} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" name="siteIds" value={site.id} />{site.name}</label>)}
            </div>
          </fieldset>
          <button type="submit" disabled={!sites.length} className="cursor-pointer rounded-xl bg-[#E11F26] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Please wait…' : 'Generate Registration QR'}</button>
        </fieldset>
      </form>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {link && <StaffQrCard key={link.token} link={link} kind="register" />}
      <ul className="divide-y">
        {items.map(item => {
          const expired = new Date(item.expiresAt).getTime() <= Date.now();
          const status = item.status === 'PENDING' && expired ? 'Expired' : item.status;
          return <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <span><strong>{item.name}</strong> · {item.role === 'CLERK' ? 'Warranty Clerk' : 'Technician'} · {status}</span>
            {item.status === 'PENDING' && <div className="flex gap-3">
              <button type="button" onClick={() => void replace(item.id)} disabled={busy} className="cursor-pointer text-blue-700 underline">Replace QR</button>
              <button type="button" onClick={() => void revoke(item.id)} disabled={busy} className="cursor-pointer text-red-700 underline">Revoke</button>
            </div>}
          </li>;
        })}
      </ul>
    </section>
  );
}
