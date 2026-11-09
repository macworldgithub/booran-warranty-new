'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Header } from '@/components/header';
import { api } from '@/lib/api';
import { bulletinsApi } from '@/lib/bulletins-api';
import { Brand, WarrantyBulletin } from '@/lib/types';

export default function WarrantyBulletinsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [items, setItems] = useState<WarrantyBulletin[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [brandList, bulletins] = await Promise.all([api.getBrands(), bulletinsApi.list()]);
      setBrands(brandList); setItems(bulletins);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load bulletins.'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getBrands(), bulletinsApi.list()])
      .then(([brandList, bulletins]) => { if (!cancelled) { setBrands(brandList); setItems(bulletins); } })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load bulletins.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const data = new FormData(event.currentTarget);
    const file = data.get('file');
    try {
      if (!(file instanceof File) || file.size === 0 || file.size > 20 * 1024 * 1024) throw new Error('Choose a PDF up to 20 MB.');
      const created = await bulletinsApi.upload(data);
      setItems(previous => [created, ...previous]); form.current?.reset();
      setMessage('Draft uploaded. Publish it below to make it available to technicians.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed.'); }
    finally { setBusy(false); }
  };
  const publish = async (item: WarrantyBulletin) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const updated = await bulletinsApi.setPublished(item.id, item.status !== 'PUBLISHED');
      setItems(previous => previous.map(entry => entry.id === updated.id ? updated : entry));
      setMessage(updated.status === 'PUBLISHED' ? 'Published for technicians.' : 'Withdrawn from the technician library.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update bulletin.'); }
    finally { setBusy(false); }
  };
  const openDocument = async (id: string) => {
    // Open synchronously to avoid browser popup blocking after the request.
    const preview = window.open('', '_blank');
    if (!preview) { setError('Allow popups to open bulletin documents.'); return; }
    preview.opener = null;
    try { preview.location.href = await bulletinsApi.document(id); }
    catch (err) { preview.close(); setError(err instanceof Error ? err.message : 'Unable to open PDF.'); }
  };
  const inputClass = 'border border-slate-300 rounded-lg p-3 w-full';
  return <>
    <Header title="Warranty Bulletins" subtitle="Official manufacturer documents" />
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl w-full mx-auto space-y-6">
      {error && <div role="alert" className="text-red-700 bg-red-50 p-4 rounded-xl border border-red-200">{error}<button className="ml-3 underline font-bold" onClick={() => void load()}>Retry loading</button></div>}
      {message && <p role="status" className="text-emerald-800 bg-emerald-50 p-4 rounded-xl border border-emerald-200">{message}</p>}
      {loading ? <p className="text-xs text-slate-500">Loading bulletin library…</p> : <>
        <form ref={form} onSubmit={upload} className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-900">Upload official bulletin</h3>
          <fieldset disabled={busy || brands.length === 0} className="space-y-4">
            <label className="block text-xs font-bold text-slate-700">Manufacturer<select required name="brandId" defaultValue="" className={inputClass}><option value="" disabled>Select manufacturer</option>{brands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
            <label className="block text-xs font-bold text-slate-700">Title<input required name="title" maxLength={200} className={inputClass} placeholder="e.g. BYD Seal Battery Inspection Protocol" /></label>
            <label className="block text-xs font-bold text-slate-700">Bulletin number<input required name="bulletinNumber" maxLength={100} className={inputClass} placeholder="e.g. BYD-WB-2602-02" /></label>
            <div className="grid sm:grid-cols-2 gap-4"><label className="text-xs font-bold text-slate-700">Issue date<input required name="issueDate" type="date" className={inputClass} /></label><label className="text-xs font-bold text-slate-700">Effective date<input required name="effectiveDate" type="date" className={inputClass} /></label></div>
            <label className="block text-xs font-bold text-slate-700">PDF attachment (maximum 20 MB)<input required name="file" type="file" accept="application/pdf,.pdf" className={inputClass} /></label>
            <button className="bg-[#E11F26] hover:bg-[#c81a20] text-white rounded-xl px-5 py-2.5 text-xs font-bold transition-all shadow-sm cursor-pointer" type="submit">{busy ? 'Please wait…' : 'Save as draft'}</button>
          </fieldset>
        </form>
        <section className="space-y-3"><h3 className="text-base font-bold text-slate-900">Bulletin library</h3>
          {!items.length && <p className="text-xs text-slate-500">No bulletins uploaded yet.</p>}
          {items.map(item => <article key={item.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
            <p className="text-xs font-bold text-slate-500">{brands.find(brand => brand.id === item.brandId)?.name || item.brandId} · <span className="uppercase font-mono text-[#E11F26]">{item.status}</span></p>
            <h4 className="font-extrabold text-slate-900">{item.title}</h4>
            <p className="font-mono text-xs text-slate-700">{item.bulletinNumber}</p>
            <p className="text-xs text-slate-500">Issued {item.issueDate} · Effective {item.effectiveDate}</p>
            <div className="flex gap-4 pt-2"><button className="text-xs font-bold text-[#E11F26] hover:underline" onClick={() => void openDocument(item.id)}>Open PDF →</button><button disabled={busy} className="text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50" onClick={() => void publish(item)}>{item.status === 'PUBLISHED' ? 'Unpublish' : 'Publish for technicians'}</button></div>
          </article>)}
        </section>
      </>}
    </div>
  </>;
}
