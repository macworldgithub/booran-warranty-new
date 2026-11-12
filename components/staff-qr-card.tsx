'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { StaffQrLink } from '@/lib/staff-qr';

export function StaffQrCard({ link, kind }: { link: StaffQrLink; kind: 'register' | 'reset' }) {
  const url = `${window.location.origin}/staff-account?mode=${kind}#${encodeURIComponent(link.token)}`;
  const [image, setImage] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, { width: 256, margin: 4 })
      .then(value => { if (active) setImage(value); })
      .catch(() => { if (active) setMessage('Could not draw the QR code. You can still copy the link.'); });
    return () => { active = false; };
  }, [url]);
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      {image && <img src={image} width={256} height={256} alt={kind === 'register' ? 'Staff registration QR code' : 'Password reset QR code'} />}
      <p className="text-sm text-slate-600">Expires {new Date(link.expiresAt).toLocaleString()}. Share this link only with the intended employee.</p>
      <button type="button" className="cursor-pointer text-sm font-semibold text-blue-700 underline"
        onClick={async () => {
          try { await navigator.clipboard.writeText(url); setMessage('Link copied.'); }
          catch { setMessage('Select and copy the link below.'); }
        }}>Copy link</button>
      <input aria-label="Staff account link" className="w-full rounded border p-2 text-xs" readOnly value={url} onFocus={event => event.target.select()} />
      {message && <p role="status" className="text-sm">{message}</p>}
    </div>
  );
}
