'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { staffQrRequest } from '@/lib/staff-qr';

type InvitationDetails = { name: string; role: 'CLERK' | 'TECHNICIAN'; sites: string[] };

export default function StaffAccountPage() {
  const [kind, setKind] = useState<'reset' | 'register'>('register');
  const [token, setToken] = useState('');
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const current = new URL(window.location.href);
        const mode = current.searchParams.get('mode');
        if (mode !== 'register' && mode !== 'reset') throw new Error('Scan a valid staff QR code to continue.');
        setKind(mode);
        const value = decodeURIComponent(current.hash.slice(1));
        if (!value) throw new Error('Scan a valid staff QR code to continue.');
        setToken(value);
        if (mode === 'register') {
          setDetails(await staffQrRequest<InvitationDetails>('registration-qr/inspect', 'POST', { token: value }, true));
        }
      } catch (err) { setError(err instanceof Error ? err.message : 'Could not open this link.'); }
      finally { setLoading(false); }
    }
    void load();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = form.get('password');
    if (password !== form.get('confirm')) { setError('The passwords do not match.'); return; }
    setError('');
    setBusy(true);
    try {
      await staffQrRequest(kind === 'reset' ? 'reset-qr/redeem' : 'registration-qr/redeem', 'POST', {
        token, password, ...(kind === 'register' ? { name: form.get('name'), username: form.get('username') } : {}),
      }, true);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setToken('');
      setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save your account.'); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
    <div className="mx-auto max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-[#B81920]">Booran Warranty</p>
      <h1 className="text-2xl font-bold">{kind === 'reset' ? 'Reset your password' : 'Create your staff account'}</h1>
      {loading && <p role="status">Checking your link…</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {done && <>
        <p role="status">{kind === 'reset' ? 'Password updated. Sign in with your new password.' : details?.role === 'TECHNICIAN' ? 'Account created. Open the Booran Warranty app and sign in with your username and password.' : 'Account created. Sign in to the portal with your username and password.'}</p>
        {(kind === 'reset' || details?.role === 'CLERK') && <Link href="/login" className="font-semibold text-blue-700 underline">Go to web sign-in</Link>}
      </>}
      {!done && !loading && token && (kind === 'reset' || details) && <form onSubmit={submit}>
        <fieldset disabled={busy} className="space-y-4">
          {details && <>
            <p className="text-sm text-slate-600">{details.role === 'CLERK' ? 'Warranty Clerk' : 'Technician'} · {details.sites.join(', ')}</p>
            <label className="block text-sm font-medium">Full name<input name="name" required maxLength={150} defaultValue={details.name} autoComplete="name" className="input-field mt-1" /></label>
            <label className="block text-sm font-medium">Username<input name="username" required pattern="[a-zA-Z0-9][a-zA-Z0-9_.\-]{2,39}" autoCapitalize="none" autoComplete="username" className="input-field mt-1" /></label>
            <p className="text-xs text-slate-600">Use 3–40 letters, digits, dots, underscores, or hyphens.</p>
          </>}
          <label className="block text-sm font-medium">New password<input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" className="input-field mt-1" /></label>
          <label className="block text-sm font-medium">Confirm password<input name="confirm" type="password" required minLength={10} maxLength={128} autoComplete="new-password" className="input-field mt-1" /></label>
          <button type="submit" className="w-full cursor-pointer rounded-xl bg-[#E11F26] px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : kind === 'reset' ? 'Set password' : 'Create account'}</button>
        </fieldset>
      </form>}
    </div>
  </main>;
}
