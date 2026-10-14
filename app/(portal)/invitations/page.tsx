'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Header } from '@/components/header';
import { api } from '@/lib/api';
import { Site } from '@/lib/types';
import { Invitation, invitationsApi } from '@/lib/invitations-api';

export default function InvitationsPage() {
  const [items, setItems] = useState<Invitation[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState('');
  useEffect(() => {
    let cancelled = false;
    Promise.all([invitationsApi.list(), api.getSites()]).then(([invitations, sites]) => {
      if (!cancelled) { setItems(invitations); setSites(sites.filter(site => site.isActive !== false)); }
    }).catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refresh]);
  const reload = () => { setLoading(true); setRefresh(value => value + 1); };
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const invitation = await invitationsApi.create({ name: String(data.get('name') || '').trim(), email: String(data.get('email') || '').trim(), siteId: String(data.get('siteId') || '') });
      setItems(previous => [invitation, ...previous]); form.reset();
      setMessage('Invitation email sent. The technician can set their password using the link within 72 hours.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to invite technician.'); reload(); }
    finally { setBusy(false); }
  }
  async function update(item: Invitation, action: 'resend' | 'cancel') {
    if (action === 'cancel' && !window.confirm(`Cancel the invitation for ${item.email}? Their setup link will stop working.`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const updated = await invitationsApi[action](item.id);
      setItems(previous => previous.map(entry => entry.id === item.id ? updated : entry));
      setMessage(action === 'resend' ? 'A new invitation email was sent. The previous link has been invalidated.' : 'Invitation cancelled.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update invitation.'); reload(); }
    finally { setBusy(false); }
  }
  const visible = items.filter(item => `${item.name} ${item.email}`.toLowerCase().includes(search.trim().toLowerCase()));
  const input = 'w-full border border-slate-300 rounded-xl bg-white p-3 text-sm';
  return <>
    <Header title="Technician Invitations" subtitle="Invite technicians to set up their account" />
    <div className="p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-6">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{message}</p>}
      <form onSubmit={invite} className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="font-semibold text-lg">Invite a technician</h2>
        <p className="text-sm text-slate-500">They receive a secure email link to set their password, then sign into the existing technician app.</p>
        <fieldset disabled={busy || loading || sites.length === 0} className="space-y-4 disabled:opacity-60">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm font-medium">Full name<input name="name" required maxLength={150} className={input} autoComplete="name" /></label>
            <label className="text-sm font-medium">Email address<input name="email" required type="email" maxLength={254} className={input} autoComplete="email" /></label>
          </div>
          <div><label htmlFor="invitation-site" className="block text-sm font-medium">Primary dealership</label><select id="invitation-site" name="siteId" required className={input} defaultValue=""><option value="" disabled>Select a dealership</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></div>
          <button type="submit" className="bg-[#E11F26] rounded-xl px-5 py-3 text-sm font-semibold text-white">{busy ? 'Please wait…' : 'Send invitation'}</button>
        </fieldset>
      </form>
      <section className="space-y-3" aria-label="Invitation history">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Invitation history</h2><button disabled={busy || loading} onClick={() => { setError(''); reload(); }} className="text-sm text-blue-700 underline disabled:opacity-50">Refresh</button></div>
        <label className="block"><span className="sr-only">Search invitations</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name or email" className={input} /></label>
        {loading ? <p role="status">Loading invitations…</p> : <>
          {!visible.length && <p className="text-slate-500">No invitations found.</p>}
          {items.length >= 500 && <p className="text-sm text-slate-500">Showing the most recent 500 invitations.</p>}
          {visible.map(item => <article key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-2">
            <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{item.name}</h3><span className="text-xs font-semibold bg-slate-100 rounded-full px-3 py-1">{item.status.replaceAll('_', ' ')}</span></div>
            <p className="text-sm break-all">{item.email}</p><p className="text-sm text-slate-500">{sites.find(site => site.id === item.siteId)?.name || item.siteId} · Technician</p>
            <p className="text-xs text-slate-500">Created {new Date(item.createdAt).toLocaleString()} · Link expires {new Date(item.expiresAt).toLocaleString()}</p>
            {item.deliveryError && <p className="text-sm text-red-700">{item.deliveryError}</p>}
            {!['ACCEPTED', 'CANCELLED'].includes(item.status) && <div className="flex gap-4 pt-2">
              <button disabled={busy} onClick={() => void update(item, 'resend')} className="text-sm text-blue-700 underline disabled:opacity-50">Resend invitation</button>
              <button disabled={busy} onClick={() => void update(item, 'cancel')} className="text-sm text-red-700 underline disabled:opacity-50">Cancel invitation</button>
            </div>}
          </article>)}
        </>}
      </section>
    </div>
  </>;
}
