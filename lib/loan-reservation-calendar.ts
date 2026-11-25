import type { LoanReservation } from './types';

export function calendarDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function calendarDays(month: Date): (Date | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day < 1 || day > count ? null : new Date(first.getFullYear(), first.getMonth(), day);
  });
}

export function reservationsOnDay(bookings: LoanReservation[], day: Date): LoanReservation[] {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  return bookings.filter(b => b.status !== 'CANCELLED' && new Date(b.startAt) < end && new Date(b.endAt) > start)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

export function localDateTimeValue(date: Date): string {
  return `${calendarDateKey(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function reservationOverlaps(bookings: LoanReservation[], siteId: string, loanerNumber: number, rego: string, start: Date, end: Date): boolean {
  const registration = rego.trim().toUpperCase();
  return bookings.some(b => b.siteId === siteId &&
    (b.loanerNumber === loanerNumber || (!!registration && registration !== 'TBA' && b.rego?.toUpperCase() === registration)) &&
    (b.status === 'RESERVED' || b.status === 'ISSUED') && new Date(b.startAt) < end && new Date(b.endAt) > start);
}
