import type { LoanAgreement, LoanAgreementPhotos } from './types';

export const LOAN_PHOTO_SLOTS: { key: keyof LoanAgreementPhotos; label: string; guidance: string }[] = [
  { key: 'front', label: 'Front 45°', guidance: 'Front bumper and bonnet' },
  { key: 'rear', label: 'Rear 45°', guidance: 'Rear tailgate and bumper' },
  { key: 'driverSide', label: 'Driver Side', guidance: 'Full length side panels' },
  { key: 'passengerSide', label: 'Passenger Side', guidance: 'Full length side panels' },
  { key: 'odometerDash', label: 'Odo / Dash', guidance: 'Instrument cluster reading' },
];

export function localLoanDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/** Use the selected rooftop's recorded fleet, excluding vehicles still out. */
export function availableLoanFleet(agreements: LoanAgreement[], siteId: string) {
  const active = new Set(agreements.filter(loan => !['RETURNED', 'CANCELLED'].includes(loan.status))
    .map(loan => loan.vehicle.rego.trim().toUpperCase()));
  const seen = new Set<string>();
  return agreements.filter(loan => {
    const rego = loan.vehicle.rego.trim().toUpperCase();
    if (loan.siteId !== siteId || active.has(rego) || seen.has(rego)) return false;
    seen.add(rego);
    return true;
  });
}

/** Inline, compressed images follow the same JSON contract used by the PWA. */
export async function readLoanPhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
    throw new Error('Choose a JPEG, PNG or WebP photo up to 10 MB.');
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not read the photo. Try another browser.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let result = canvas.toDataURL('image/jpeg', 0.82);
    for (const quality of [0.7, 0.55]) {
      if (result.length <= 1.3 * 1024 * 1024) break;
      result = canvas.toDataURL('image/jpeg', quality);
    }
    // Six photos plus the signature must fit the portal proxy's 10 MB limit.
    if (result.length > 1.3 * 1024 * 1024) throw new Error('This photo is too large. Choose a smaller image.');
    return result;
  } catch (error) {
    if (error instanceof Error && /photo|browser/i.test(error.message)) throw error;
    throw new Error('This photo could not be read. Choose another JPEG, PNG or WebP file.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
