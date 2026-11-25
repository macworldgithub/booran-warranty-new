'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { api } from '@/lib/api';
import type { LoanAgreement, LoanReservation } from '@/lib/types';
import { calendarDateKey, calendarDays, localDateTimeValue, reservationOverlaps, reservationsOnDay } from '@/lib/loan-reservation-calendar';

type Props = {
  siteId: string;
  sites: { siteId: string; fullName: string }[];
  agreements: LoanAgreement[];
  onIssue: (reservation: LoanReservation) => void;
};

const primaryButton = 'rounded-xl bg-[#D71920] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#B91218] disabled:opacity-50 disabled:cursor-not-allowed';
const secondaryButton = 'rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed';
const inputClass = 'mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#D71920]';
const dateLabel = (value: string) => new Date(value).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export function LoanReservationsPanel({ siteId, sites, agreements, onIssue }: Props) {
  const [bookings, setBookings] = useState<LoanReservation[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [view, setView] = useState<'day' | 'upcoming'>('day');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loanerNumber, setLoanerNumber] = useState(1);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [rego, setRego] = useState('');
  const [regoTba, setRegoTba] = useState(false);
  const [startValue, setStartValue] = useState('');
  const [endValue, setEndValue] = useState('');
  const requestId = useRef(0);
  const mutationInFlight = useRef(false);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setNow(new Date());
    setLoadFailed(false);
    setError('');
    setBookings([]);
    try {
      const result = await api.getLoanReservations(siteId);
      if (requestId.current === currentRequest) setBookings(result);
    } catch (error) {
      if (requestId.current === currentRequest) {
        setLoadFailed(true);
        setError(errorMessage(error, 'Unable to load reservations. Please retry.'));
      }
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
  }, [siteId]);

  // Agreement changes include issue, edit, return and deletion, which update reservations too.
  useEffect(() => {
    // Show loading immediately while synchronizing with the reservation API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => { requestId.current += 1; };
  }, [load, agreements]);

  const start = new Date(startValue);
  const end = new Date(endValue);
  const overlaps = (number: number) => reservationOverlaps(bookings, siteId, number, regoTba ? 'TBA' : rego, start, end);
  const visible = view === 'day' ? reservationsOnDay(bookings, selectedDate) : bookings
    .filter(b => (b.status === 'RESERVED' || b.status === 'ISSUED') && new Date(b.endAt) > now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const selectDate = (date: Date) => { setSelectedDate(date); setView('day'); };
  const changeMonth = (offset: number) => selectDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, 1));
  const openForm = () => {
    if (expanded) { setExpanded(false); return; }
    const collection = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 9);
    const now = new Date();
    if (collection < now && collection.toDateString() === now.toDateString()) {
      collection.setHours(now.getHours(), Math.ceil((now.getMinutes() + 1) / 30) * 30);
    }
    const due = new Date(collection);
    due.setDate(due.getDate() + 1);
    setStartValue(localDateTimeValue(collection)); setEndValue(localDateTimeValue(due));
    setExpanded(true); setError(''); setNotice('');
  };

  const reserve = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mutationInFlight.current) return;
    if (!siteId || siteId === 'all') { setError('Select a rooftop above to reserve a loan vehicle.'); return; }
    if (!name.trim() || !mobile.trim()) { setError('Enter the customer name and mobile.'); return; }
    if (!regoTba && !rego.trim()) { setError('Enter a loan car rego or select TBA.'); return; }
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end <= new Date()) {
      setError('Return time must be after the start time and in the future.'); return;
    }
    mutationInFlight.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      await api.reserveLoaner({ siteId, loanerNumber, customerName: name.trim(), customerMobile: mobile.trim(),
        rego: regoTba ? 'TBA' : rego.trim().toUpperCase(), startAt: start.toISOString(), endAt: end.toISOString() });
      selectDate(start);
      setName(''); setMobile(''); setRego(''); setRegoTba(false); setExpanded(false);
      setNotice('Loan car booking confirmed.');
      await load();
    } catch (error) {
      setError(errorMessage(error, 'Reservation could not be confirmed. Please retry.'));
    } finally { setBusy(false); mutationInFlight.current = false; }
  };

  const cancel = async (id: string) => {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      await api.cancelLoanReservation(id);
      setNotice('Loan car booking cancelled.');
      await load();
    } catch (error) { setError(errorMessage(error, 'Unable to cancel reservation.')); }
    finally { setBusy(false); mutationInFlight.current = false; }
  };

  return <section aria-labelledby="loan-calendar-title" className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs sm:p-6 space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="loan-calendar-title" className="flex items-center gap-2 text-lg font-bold"><CalendarDays className="h-5 w-5 text-[#D71920]" />Loan car booking calendar</h2>
        <p className="mt-1 text-sm text-slate-500">Book GWM LOAN 1–6 in advance with client details and a rego or TBA. Availability is confirmed when you save.</p>
      </div>
      <button type="button" disabled={busy} onClick={openForm} aria-expanded={expanded} aria-controls="loan-reservation-form" className={primaryButton}>{expanded ? 'Close reservation form' : 'Reserve a loan vehicle'}</button>
    </div>
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div data-testid="loan-booking-calendar" className="min-w-0">
        <div className="mb-3 flex items-center gap-1">
          <button type="button" aria-label="Previous booking month" className="rounded-lg p-2 hover:bg-slate-100" onClick={() => changeMonth(-1)}><ChevronLeft className="h-5 w-5" /></button>
          <h3 className="flex-1 text-center text-sm font-bold sm:text-base">{selectedDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</h3>
          <button type="button" aria-label="Next booking month" className="rounded-lg p-2 hover:bg-slate-100" onClick={() => changeMonth(1)}><ChevronRight className="h-5 w-5" /></button>
          <button type="button" className="p-2 text-xs font-bold text-[#D71920]" onClick={() => selectDate(new Date())}>Today</button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div key={day} className="py-2 text-center text-[11px] font-semibold text-slate-500">{day}</div>)}
          {calendarDays(selectedDate).map((date, index) => {
            if (!date) return <div key={`empty-${index}`} />;
            const key = calendarDateKey(date);
            const count = reservationsOnDay(bookings, date).length;
            const active = key === calendarDateKey(selectedDate);
            return <button type="button" key={key} data-testid={`loan-calendar-day-${key}`} aria-pressed={active}
              aria-label={`${date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}, ${loading ? 'loading bookings' : `${count} booking${count === 1 ? '' : 's'}`}`}
              onClick={() => selectDate(date)} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border text-sm font-semibold sm:min-h-16 ${active ? 'border-[#D71920] bg-[#D71920] text-white' : key === calendarDateKey(now) ? 'border-slate-300 bg-slate-50' : 'border-transparent hover:bg-slate-50'}`}>
              <span>{date.getDate()}</span><span className={`text-[9px] sm:text-[11px] ${active ? 'text-white' : 'text-slate-500'}`}>{loading ? '…' : loadFailed ? '?' : count ? `${count} ${count === 1 ? 'loan' : 'loans'}` : '·'}</span>
            </button>;
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">Select a day to view bookings. Multi-day loans appear on each booked day.</p>
      </div>
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={view === 'day'} className={`${secondaryButton} ${view === 'day' ? 'border-[#D71920] bg-red-50 text-[#D71920]' : ''}`} onClick={() => setView('day')}>Selected day</button>
          <button type="button" aria-pressed={view === 'upcoming'} className={`${secondaryButton} ${view === 'upcoming' ? 'border-[#D71920] bg-red-50 text-[#D71920]' : ''}`} onClick={() => setView('upcoming')}>Upcoming bookings</button>
          <button type="button" disabled={busy || loading} onClick={() => void load()} className="flex items-center gap-1 text-xs font-bold text-[#D71920] disabled:opacity-50"><RotateCw className="h-3.5 w-3.5" />Refresh reservations</button>
        </div>
        <h3 className="text-sm font-bold">{view === 'day' ? selectedDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Current and upcoming bookings'}</h3>
        {loading ? <p role="status" className="text-sm text-slate-500">Loading reservations…</p> : !loadFailed && visible.length === 0 ? <p className="text-sm text-slate-500">{view === 'day' ? 'No bookings for this day.' : 'No upcoming bookings.'}</p> : null}
        {!loading && <div className="max-h-96 space-y-3 overflow-y-auto">
          {visible.map(booking => <article key={booking.id} data-testid={`loan-booking-${booking.id}`} className="rounded-xl border border-slate-200 p-3 text-sm space-y-1 break-words">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-bold">{booking.loanerName}</h4><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{booking.status === 'RESERVED' ? 'Reserved' : booking.status === 'RETURNED' ? 'Returned' : 'Issued'}</span></div>
            <p className="text-xs text-slate-500">{sites.find(s => s.siteId === booking.siteId)?.fullName || booking.siteId}</p>
            <p className="font-semibold">{booking.customerName} · <a href={`tel:${booking.customerMobile}`} className="text-[#D71920]">{booking.customerMobile}</a></p>
            <p className="text-xs text-slate-500">{dateLabel(booking.startAt)} to {dateLabel(booking.endAt)}</p>
            <p className="text-xs">Rego: {booking.rego || 'TBA'}</p>
            {booking.status === 'RESERVED' && <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 text-xs font-bold text-[#D71920]">
              <button type="button" disabled={busy} onClick={() => onIssue(booking)} className="py-1 disabled:opacity-50">Issue vehicle / enter rego</button>
              <button type="button" disabled={busy} onClick={() => void cancel(booking.id)} className="py-1 disabled:opacity-50">Cancel reservation</button>
            </div>}
          </article>)}
        </div>}
      </div>
    </div>
    {notice && <p role="status" className="text-sm font-semibold text-emerald-700">{notice}</p>}
    {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
    {expanded && <form id="loan-reservation-form" onSubmit={reserve} noValidate className="space-y-4 border-t border-slate-200 pt-5">
      {(!siteId || siteId === 'all') && <p className="text-sm font-semibold text-amber-700">Select a rooftop above before booking.</p>}
      <fieldset disabled={busy} className="min-w-0 space-y-4 disabled:opacity-60">
        <legend className="sr-only">Reserve a loan vehicle</legend>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="min-w-0 text-xs font-bold">Collection<input type="datetime-local" aria-label="Collection" className={inputClass} value={startValue} onChange={e => setStartValue(e.target.value)} required /></label>
          <label className="min-w-0 text-xs font-bold">Due back<input type="datetime-local" aria-label="Due back" className={inputClass} value={endValue} onChange={e => setEndValue(e.target.value)} required /></label>
        </div>
        <fieldset className="min-w-0"><legend className="mb-2 text-xs font-bold">Loan car *</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 6 }, (_, index) => index + 1).map(number => {
            const unavailable = overlaps(number);
            return <button key={number} type="button" disabled={loading || loadFailed || unavailable} aria-pressed={loanerNumber === number} onClick={() => setLoanerNumber(number)} className={`${secondaryButton} ${loanerNumber === number ? 'border-[#D71920] bg-red-50 text-[#D71920]' : ''}`}>
              <span className="block text-xs">GWM LOAN {number}</span><span className="text-[11px] font-normal">{loading ? 'Checking…' : loadFailed ? 'Unavailable' : unavailable ? 'Booked' : 'Available'}</span>
            </button>;
          })}</div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold">Client name *<input aria-label="Reservation customer name" className={inputClass} value={name} onChange={e => setName(e.target.value)} maxLength={120} required /></label>
          <label className="text-xs font-bold">Client mobile *<input type="tel" aria-label="Reservation customer mobile" className={inputClass} value={mobile} onChange={e => setMobile(e.target.value)} maxLength={40} required /></label>
        </div>
        <fieldset className="min-w-0 space-y-2"><legend className="mb-2 text-xs font-bold">Loan car rego *</legend>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={!regoTba} onClick={() => setRegoTba(false)} className={`${secondaryButton} ${!regoTba ? 'border-[#D71920] bg-red-50 text-[#D71920]' : ''}`}>Enter rego</button>
            <button type="button" aria-pressed={regoTba} onClick={() => setRegoTba(true)} className={`${secondaryButton} ${regoTba ? 'border-[#D71920] bg-red-50 text-[#D71920]' : ''}`}>TBA (assign later)</button>
          </div>
          {regoTba ? <p className="text-xs text-slate-500">Registration will be TBA until the actual car is assigned at handover.</p> : <input aria-label="Reservation vehicle rego" placeholder="e.g. ABC123" className={inputClass} value={rego} onChange={e => setRego(e.target.value)} maxLength={20} required />}
        </fieldset>
        <button type="submit" disabled={busy || loading || loadFailed || !siteId || siteId === 'all' || overlaps(loanerNumber)} className={primaryButton}>{busy ? 'Saving…' : 'Confirm reservation'}</button>
      </fieldset>
    </form>}
  </section>;
}
