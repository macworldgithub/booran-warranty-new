'use client';

import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown, X } from 'lucide-react';
import Image from 'next/image';
import { api } from '@/lib/api';
import type { LoanAgreement, LoanAgreementPhotos, LoanReservation, UserProfile } from '@/lib/types';
import { availableLoanFleet, localLoanDateTime, LOAN_PHOTO_SLOTS, readLoanPhoto } from '@/lib/loan-handover';
import { LOAN_TERMS_TEXT } from '@/lib/loan-terms';
import { LoanSignaturePad } from './loan-signature-pad';

type Props = {
  sites: { siteId: string; fullName: string }[];
  initialSiteId: string;
  purpose: 'SERVICE_LOANER' | 'TEST_DRIVE';
  staff: UserProfile;
  agreements: LoanAgreement[];
  reservation?: LoanReservation | null;
  draft?: LoanAgreement | null;
  onClose: () => void;
  onDraftCreated: (agreement: LoanAgreement) => void;
  onComplete: (agreement: LoanAgreement) => void;
};

const inputClass = 'mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-600';
const secondary = 'rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50';
const today = () => localLoanDateTime(new Date().toISOString()).slice(0, 10);

function Section({ number, title, subtitle, open, toggle, children }: {
  number: number; title: string; subtitle: string; open: boolean; toggle: () => void; children: ReactNode;
}) {
  return <section className="rounded-xl border border-slate-200 bg-white">
    <h3><button type="button" aria-expanded={open} aria-controls={`loan-section-${number}`} onClick={toggle}
      className="flex w-full items-center gap-3 p-4 text-left">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${open ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{number}</span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-900">{title}</span><span className="block text-xs font-normal text-slate-500">{subtitle}</span></span>
      <ChevronDown size={17} className={open ? 'rotate-180' : ''} />
    </button></h3>
    <div id={`loan-section-${number}`} hidden={!open} className="space-y-4 border-t border-slate-100 p-4">{children}</div>
  </section>;
}

export function IssueLoanWizard({ sites, initialSiteId, purpose, staff, agreements, reservation, draft, onClose, onDraftCreated, onComplete }: Props) {
  const [initialReturn] = useState(() => localLoanDateTime(reservation?.endAt || draft?.dueBackDateTime || new Date(Date.now() + (purpose === 'TEST_DRIVE' ? 1 : 24) * 3600000).toISOString()));
  const [siteId, setSiteId] = useState(reservation?.siteId || draft?.siteId || (sites.some(site => site.siteId === initialSiteId) ? initialSiteId : sites[0]?.siteId || ''));
  const [form, setForm] = useState({
    name: draft?.customer.name || reservation?.customerName || '', mobile: draft?.customer.mobile || reservation?.customerMobile || '',
    email: draft?.customer.email || '', dob: draft?.customer.dob?.slice(0, 10) || '', address: draft?.customer.residentialAddress || '',
    licence: draft?.customer.licenceNumber || '', licenceState: draft?.customer.licenceState || 'VIC', expiry: draft?.customer.licenceExpiry?.slice(0, 10) || '',
    rego: draft?.vehicle.rego || (reservation?.rego && reservation.rego !== 'TBA' ? reservation.rego : ''),
    make: draft?.vehicle.make || '', model: draft?.vehicle.model || '', year: draft ? String(draft.vehicle.year) : '', vin: draft?.vehicle.vin || '',
    returnDate: initialReturn.slice(0, 10), returnTime: initialReturn.slice(11, 16), ro: draft?.roNumber || '',
    odometer: draft ? String(draft.outbound.odometerOut) : '', fuel: String(draft?.outbound.fuelLevelOutPercent ?? 100),
    damage: draft?.outbound.damageNotes || '', deposit: String(draft?.securityDepositHeld ?? 500),
    depositMethod: draft?.depositPaymentMethod || 'CARD_PREAUTH',
  });
  const [photos, setPhotos] = useState<LoanAgreementPhotos>(draft?.outbound.photos || {});
  const [licencePhoto, setLicencePhoto] = useState(draft?.customer.licencePhotoUrl || '');
  const [sighted, setSighted] = useState(draft?.customer.licenceSighted || false);
  const [clean, setClean] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [electronic, setElectronic] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [signature, setSignature] = useState('');
  const [open, setOpen] = useState([1, 2]);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [draftId, setDraftId] = useState(draft?.id || '');
  const created = useRef(draft || null);
  const inFlight = useRef(false);
  const dialog = useRef<HTMLDivElement>(null);
  const locked = busy || !!draftId;
  const fleet = availableLoanFleet(agreements, siteId);
  const photoCount = LOAN_PHOTO_SLOTS.filter(slot => photos[slot.key]).length;

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => { document.body.style.overflow = overflow; before?.focus(); };
  }, []);

  useEffect(() => {
    if (error) dialog.current?.querySelector('[role="alert"]')?.scrollIntoView({ block: 'nearest' });
  }, [error]);

  const field = (key: keyof typeof form, label: string, options: InputHTMLAttributes<HTMLInputElement> = {}) => <label className="block min-w-0 text-xs font-semibold text-slate-700">
    {label}{options.required && ' *'}<input {...options} className={inputClass} value={form[key]} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} />
  </label>;
  const check = (label: string, checked: boolean, change: (value: boolean) => void) => <label className="flex items-start gap-2 text-sm text-slate-700">
    <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-red-600" checked={checked} onChange={event => change(event.target.checked)} />{label}
  </label>;
  const fail = (section: number, message: string) => {
    setOpen(current => [...new Set([...current, section])]); setError(message);
    dialog.current?.querySelector('[role="alert"]')?.scrollIntoView({ block: 'nearest' });
  };
  const photoInput = (key: keyof LoanAgreementPhotos | 'licence', camera: boolean) => <label className={`${secondary} inline-flex cursor-pointer items-center justify-center ${locked || reading ? 'pointer-events-none opacity-50' : ''}`}>
    {camera ? 'Take photo' : 'Choose photo'}
    <input aria-label={`${camera ? 'Take' : 'Choose'} ${key === 'licence' ? 'driver licence' : LOAN_PHOTO_SLOTS.find(slot => slot.key === key)?.label} photo`}
      className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture={camera ? 'environment' : undefined} disabled={locked || reading}
      onChange={async event => {
        const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
        if (!file) return;
        setReading(true); setError('');
        try {
          const data = await readLoanPhoto(file);
          if (key === 'licence') setLicencePhoto(data); else setPhotos(current => ({ ...current, [key]: data }));
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to read photo.'); }
        finally { setReading(false); }
      }} />
  </label>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current || reading) return;
    setError('');
    if (!sites.some(site => site.siteId === siteId)) return fail(2, 'Select an assigned dealership rooftop before issuing a vehicle.');
    if (!draftId) {
      if (![form.name, form.mobile, form.email, form.dob, form.address, form.licence, form.licenceState, form.expiry].every(value => value.trim())) return fail(1, 'Complete the required customer and driver licence details.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return fail(1, 'Enter a valid customer email address.');
      if (form.dob >= today() || Number.isNaN(Date.parse(form.dob))) return fail(1, 'Enter a valid date of birth.');
      if (form.expiry < today() || Number.isNaN(Date.parse(form.expiry))) return fail(1, 'Enter a current driver licence expiry date.');
      if (!sighted) return fail(1, 'Confirm that the driver licence has been physically sighted.');
      if (!form.rego.trim() || form.rego.trim().toUpperCase() === 'TBA' || !form.make.trim() || !form.model.trim() || !/^[A-HJ-NPR-Z0-9]{17}$/i.test(form.vin.trim()) || !Number.isInteger(Number(form.year)) || Number(form.year) < 1900 || Number(form.year) > new Date().getFullYear() + 2) return fail(2, 'Enter the actual registration, make, model, year and 17-character vehicle VIN.');
      const due = new Date(`${form.returnDate}T${form.returnTime}`);
      if (!form.returnDate || !form.returnTime || !Number.isFinite(due.getTime()) || due.getTime() <= Date.now()) return fail(2, 'Choose a future expected return date and time.');
      if (form.odometer === '' || !Number.isInteger(Number(form.odometer)) || Number(form.odometer) < 0 || form.fuel === '' || !Number.isFinite(Number(form.fuel)) || Number(form.fuel) < 0 || Number(form.fuel) > 100 || form.deposit === '' || !Number.isFinite(Number(form.deposit)) || Number(form.deposit) < 0) return fail(3, 'Enter a valid odometer, fuel/charge between 0 and 100%, and a non-negative deposit.');
    }
    if (!agreed || !electronic || !privacy) return fail(4, 'All three customer acknowledgements are required before activation.');
    if (!signature) return fail(5, 'Ask the customer to draw their signature before activation.');
    inFlight.current = true; setBusy(true);
    try {
      if (!created.current) {
        const agreement = await api.issueLoanAgreement({
          reservationId: reservation?.id, loanStartDateTime: reservation?.startAt, siteId,
          siteName: sites.find(site => site.siteId === siteId)!.fullName, purpose,
          roNumber: form.ro.trim() || undefined,
          customer: { name: form.name.trim(), mobile: form.mobile.trim(), email: form.email.trim(), dob: form.dob,
            residentialAddress: form.address.trim(), licenceNumber: form.licence.trim(), licenceState: form.licenceState,
            licenceExpiry: form.expiry, licenceSighted: sighted, licencePhotoUrl: licencePhoto || undefined },
          vehicle: { rego: form.rego.trim().toUpperCase(), make: form.make.trim(), model: form.model.trim(), year: Number(form.year), vin: form.vin.trim().toUpperCase() },
          dueBackDateTime: reservation?.endAt || new Date(`${form.returnDate}T${form.returnTime}`).toISOString(),
          dailyKmCap: 50, excessKmRate: 0.5, basicInsuranceExcess: 2500,
          securityDepositHeld: Number(form.deposit), depositPaymentMethod: form.depositMethod,
          outbound: { odometerOut: Number(form.odometer), fuelLevelOutPercent: Number(form.fuel),
            damageNotes: form.damage.trim() || (clean ? 'Cleanliness checked; no existing damage reported.' : 'Nil reported'),
            photos, issuedByStaffId: staff.id, issuedByStaffName: staff.name },
        });
        if (!agreement?.id) throw new Error('The server did not confirm the agreement was created. Check the loaner list before trying again.');
        created.current = agreement; setDraftId(agreement.id); onDraftCreated(agreement);
      }
      const signed = await api.signLoanAgreement(created.current.id, {
        borrowerSignatureDataUrl: signature, readAndAgreed: agreed, electronicConsent: electronic,
        privacyNoticeAcknowledged: privacy, staffName: staff.name, deviceUserAgent: navigator.userAgent,
      });
      if (signed.status !== 'ACTIVE') throw new Error('Activation was not confirmed. Retry signing this draft.');
      onComplete(signed);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'Unable to issue the vehicle.';
      setError(created.current
        ? `Agreement draft saved. Activation was not confirmed: ${message}. Retry activation to finish this same agreement.`
        : /fetch|network/i.test(message) ? 'Connection failed. Check the loaner list to confirm whether a draft was created before trying again.' : message);
    } finally { inFlight.current = false; setBusy(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-5" onKeyDown={event => {
    if (event.key === 'Escape' && !inFlight.current && !reading) onClose();
    if (event.key === 'Tab') {
      const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], canvas') || []).filter(element => element.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="loan-issue-title" tabIndex={-1} className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl outline-none">
      <div className="flex items-center justify-between gap-3 bg-[#D71920] px-5 py-4 text-white">
        <div><h2 id="loan-issue-title" className="text-lg font-bold">{purpose === 'TEST_DRIVE' ? 'Start Test Drive' : 'Issue Service Loaner'}</h2><p className="text-xs text-white/85">Customer details, vehicle, condition, terms and signature</p></div>
        <button type="button" aria-label="Close loan wizard" disabled={busy || reading} onClick={onClose} className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-50"><X size={21} /></button>
      </div>
      <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-3 overflow-y-auto p-3 sm:p-5">
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
          {!sites.length && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">No assigned active rooftop is available. Ask your administrator to check your dealership assignment.</p>}
          {reservation && <div data-testid="reservation-handover" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm"><strong>Handover: {reservation.loanerName}</strong><p className="mt-1 text-xs">Reserved rooftop and times are fixed: {new Date(reservation.startAt).toLocaleString()} to {new Date(reservation.endAt).toLocaleString()}.</p></div>}
          {draftId && <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">Draft created. Vehicle and customer details are saved; complete the customer signature to activate this agreement.</p>}
          <div className="flex justify-end gap-3 text-xs font-semibold text-red-700"><button type="button" onClick={() => setOpen([1, 2, 3, 4, 5])}>Expand all</button><button type="button" onClick={() => setOpen([])}>Collapse all</button></div>
          <Section number={1} title="Customer & Driver Licence" subtitle={form.name || 'Customer details and licence sighting'} open={open.includes(1)} toggle={() => setOpen(current => current.includes(1) ? current.filter(n => n !== 1) : [...current, 1])}>
            <fieldset disabled={locked} className="grid min-w-0 gap-3 sm:grid-cols-2">
              {field('name', 'Customer full name', { required: true, autoComplete: 'name' })}{field('mobile', 'Mobile phone', { required: true, type: 'tel', autoComplete: 'tel' })}
              {field('email', 'Email address', { required: true, type: 'email', autoComplete: 'email' })}{field('dob', 'Date of birth', { required: true, type: 'date', max: today() })}
              {field('address', 'Residential address', { required: true, autoComplete: 'street-address' })}{field('licence', 'Driver licence number', { required: true })}
              <label className="text-xs font-semibold text-slate-700">Licence state *<select className={inputClass} value={form.licenceState} onChange={event => setForm(current => ({ ...current, licenceState: event.target.value }))}>{['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'].map(state => <option key={state}>{state}</option>)}</select></label>
              {field('expiry', 'Driver licence expiry', { required: true, type: 'date', min: today() })}
              <div className="sm:col-span-2">{check('I have physically sighted the customer’s current driver licence.', sighted, setSighted)}</div>
              <div className="space-y-2 sm:col-span-2"><p className="text-xs font-semibold">Driver licence photo (optional)</p>{licencePhoto && <Image unoptimized width={320} height={200} src={licencePhoto} alt="Driver licence" className="h-24 rounded-lg object-contain" />}<div className="flex flex-wrap gap-2">{photoInput('licence', true)}{photoInput('licence', false)}{licencePhoto && <button type="button" className={secondary} onClick={() => setLicencePhoto('')}>Remove licence photo</button>}</div></div>
            </fieldset>
          </Section>
          <Section number={2} title="Loan Vehicle & Schedule" subtitle={form.rego ? `${form.rego} · ${form.make} ${form.model}` : 'Select loaner vehicle'} open={open.includes(2)} toggle={() => setOpen(current => current.includes(2) ? current.filter(n => n !== 2) : [...current, 2])}>
            <fieldset disabled={locked} className="space-y-3">
              <label className="block text-xs font-semibold">Dealership rooftop *<select aria-label="Issue dealership rooftop" disabled={!!reservation} className={inputClass} value={siteId} onChange={event => { setSiteId(event.target.value); setForm(current => ({ ...current, rego: '', make: '', model: '', year: '', vin: '', odometer: '' })); }}>{sites.map(site => <option key={site.siteId} value={site.siteId}>{site.fullName}</option>)}</select></label>
              {!!fleet.length && <div><p className="mb-2 text-xs font-semibold">Quick Select Dealership Fleet</p><div className="flex flex-wrap gap-2">{fleet.map(loan => <button key={loan.id} type="button" className={`${secondary} text-left`} onClick={() => setForm(current => ({ ...current, rego: loan.vehicle.rego, make: loan.vehicle.make, model: loan.vehicle.model, year: String(loan.vehicle.year), vin: loan.vehicle.vin, odometer: String(loan.inbound?.odometerIn ?? loan.outbound.odometerOut) }))}><strong>{loan.vehicle.rego}</strong><span className="block text-xs font-normal">{loan.vehicle.make} {loan.vehicle.model}</span></button>)}</div></div>}
              <div className="grid gap-3 sm:grid-cols-2">{field('rego', 'Loan vehicle rego', { required: true })}{field('make', 'Make', { required: true })}{field('model', 'Model', { required: true })}{field('year', 'Year', { required: true, type: 'number', min: 1900, max: new Date().getFullYear() + 2 })}</div>
              {field('vin', 'Vehicle VIN', { required: true, maxLength: 17 })}{field('ro', 'Repair order number (optional)')}
              <div className="grid gap-3 sm:grid-cols-2">{field('returnDate', 'Expected return date', { required: true, type: 'date', min: today(), disabled: !!reservation })}{field('returnTime', 'Return time', { required: true, type: 'time', disabled: !!reservation })}</div>
              <p className="rounded-lg bg-red-50 p-3 text-xs text-red-900">Daily allowance: <strong>50 km/day</strong> included. Excess kilometres billed at <strong>$0.50/km</strong> upon return.</p>
            </fieldset>
          </Section>
          <Section number={3} title="Condition & 5-Point Photos" subtitle={`Odo: ${form.odometer || '—'} km · ${photoCount}/5 Photos`} open={open.includes(3)} toggle={() => setOpen(current => current.includes(3) ? current.filter(n => n !== 3) : [...current, 3])}>
            <fieldset disabled={locked} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">{field('odometer', 'Outbound odometer (km)', { required: true, type: 'number', min: 0, step: 1 })}{field('fuel', 'Fuel / battery (%)', { required: true, type: 'number', min: 0, max: 100 })}</div>
              <p className="text-xs text-slate-500">Odometer and fuel/charge are required. Add optional departure photos to record the vehicle’s condition.</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{LOAN_PHOTO_SLOTS.map(slot => <div key={slot.key} className="space-y-2 rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-bold">{slot.label}</p><p className="text-xs text-slate-500">{slot.guidance}</p>
                {photos[slot.key] && <Image unoptimized width={320} height={200} src={photos[slot.key]!} alt={`${slot.label} departure condition`} className="h-28 w-full rounded-lg object-cover" />}
                <div className="flex flex-wrap gap-2">{photoInput(slot.key, true)}{photoInput(slot.key, false)}{photos[slot.key] && <button type="button" className="text-xs font-semibold text-red-700 underline" onClick={() => setPhotos(current => ({ ...current, [slot.key]: undefined }))}>Remove {slot.label} photo</button>}</div>
              </div>)}</div>
              {check('Cleanliness checked before departure.', clean, setClean)}
              <label className="block text-xs font-semibold">Existing damage / condition notes<textarea className={inputClass} rows={3} value={form.damage} onChange={event => setForm(current => ({ ...current, damage: event.target.value }))} /></label>
              <div className="grid gap-3 sm:grid-cols-2">{field('deposit', 'Security deposit ($)', { required: true, type: 'number', min: 0, step: '0.01' })}<label className="text-xs font-semibold">Deposit method<select className={inputClass} value={form.depositMethod} onChange={event => setForm(current => ({ ...current, depositMethod: event.target.value }))}><option value="CARD_PREAUTH">Card pre-authorisation</option><option value="CASH">Cash</option><option value="NONE">No deposit</option></select></label></div>
            </fieldset>
          </Section>
          <Section number={4} title="Terms & Conditions" subtitle="Share with customer and confirm acknowledgements" open={open.includes(4)} toggle={() => setOpen(current => current.includes(4) ? current.filter(n => n !== 4) : [...current, 4])}>
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-xs leading-6 text-slate-700">{LOAN_TERMS_TEXT}</pre>
            <a href="/api/v1/legal-documents/test-drive-loan-agreement" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-red-700 underline">Open full loan vehicle agreement</a>
            <fieldset disabled={busy} className="space-y-3">
              {check('I have read and agree to the loan vehicle terms and conditions.', agreed, setAgreed)}
              {check('I consent to using an electronic signature for this agreement.', electronic, setElectronic)}
              {check('I acknowledge the privacy notice.', privacy, setPrivacy)}
            </fieldset>
          </Section>
          <Section number={5} title="Customer Signature & Staff" subtitle="Customer signature and issuing staff details" open={open.includes(5)} toggle={() => setOpen(current => current.includes(5) ? current.filter(n => n !== 5) : [...current, 5])}>
            <LoanSignaturePad value={signature} onChange={setSignature} disabled={busy} />
            <label className="block text-xs font-semibold">Staff / Service Advisor Name<input className={inputClass} value={staff.name} readOnly /></label>
          </Section>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4">
          <p role="status" className="text-xs text-slate-500">{busy ? draftId ? 'Activating signed agreement…' : 'Saving agreement…' : reading ? 'Preparing photo…' : 'Complete all five sections before handing over the keys.'}</p>
          <div className="flex gap-2"><button type="button" className={secondary} disabled={busy || reading} onClick={onClose}>Cancel</button><button type="submit" disabled={busy || reading || !sites.length} className="rounded-xl bg-[#D71920] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#B91218] disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : draftId ? 'Retry activation' : purpose === 'TEST_DRIVE' ? 'Start & Activate Test Drive' : 'Issue & Activate Loan'}</button></div>
        </div>
      </form>
    </div>
  </div>;
}
