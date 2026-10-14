'use client';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { invitationsApi, InvitationDetails } from '@/lib/invitations-api';

export default function AcceptInvitationPage() {
  const [token, setToken] = useState('');
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const secret = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
    async function inspect() {
      if (!/^[a-f\d]{64}$/.test(secret)) throw new Error('This invitation link is missing or invalid. Ask your administrator to resend it.');
      return invitationsApi.inspect(secret);
    }
    inspect().then(result => {
      if (!cancelled) { setDetails(result); setToken(secret); window.history.replaceState(null, '', window.location.pathname); }
    }).catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');
    if (password !== form.get('confirmation')) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try { await invitationsApi.accept(token, password); setComplete(true); setToken(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to complete setup.'); }
    finally { setBusy(false); }
  }
  const input = 'w-full border border-slate-300 rounded-xl p-3 mt-1';
  return <main className="min-h-dvh bg-slate-100 flex items-center justify-center p-4">
    <section className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5">
      <p className="text-xs font-bold uppercase tracking-widest text-[#E11F26]">Booran Motors</p>
      <h1 className="text-2xl font-bold text-slate-900">{complete ? 'Your account is ready' : 'Set up your technician account'}</h1>
      {loading && <p role="status">Checking your invitation…</p>}
      {error && <p role="alert" className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</p>}
      {complete ? <>
        <p role="status" className="text-slate-600">Open the technician app and sign in with <strong>{details?.email}</strong> and the password you just set.</p>
        <Link href="/login" className="inline-block bg-[#E11F26] text-white px-5 py-3 rounded-xl font-semibold text-sm">Go to web sign-in</Link>
      </> : details && <>
        <div className="bg-slate-50 rounded-xl p-4 space-y-1 text-sm"><p className="font-semibold">{details.name}</p><p className="break-all">{details.email}</p><p className="text-slate-500">{details.siteName} · Technician</p></div>
        <p className="text-sm text-slate-500">Your administrator assigned these details. Choose a password to finish setup.</p>
        <form onSubmit={accept} className="space-y-4"><fieldset disabled={busy} className="space-y-4">
          <label className="block text-sm font-medium">Password<input name="password" required type="password" minLength={8} maxLength={128} autoComplete="new-password" className={input} /></label>
          <label className="block text-sm font-medium">Confirm password<input name="confirmation" required type="password" minLength={8} maxLength={128} autoComplete="new-password" className={input} /></label>
          <p className="text-xs text-slate-500">Use 8–128 characters. This invitation can be accepted once.</p>
          <button className="w-full rounded-xl bg-[#E11F26] text-white font-semibold p-3 disabled:opacity-50" type="submit">{busy ? 'Setting up account…' : 'Create my account'}</button>
        </fieldset></form>
      </>}
    </section>
  </main>;
}
