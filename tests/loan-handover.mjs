import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
mkdirSync('.tmp', { recursive: true });
// Run after npm run build. PORTAL_URL can point to an already running local portal.
const portalUrl = process.env.PORTAL_URL || 'http://127.0.0.1:3187';
const server = process.env.PORTAL_URL ? null : spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3187'], { windowsHide: true, stdio: 'inherit' });
let ready = false;
for (let attempt = 0; attempt < 60; attempt++) {
  if (server?.exitCode != null) throw new Error('Portal server exited before the browser checks started.');
  ready = await fetch(portalUrl, { signal: AbortSignal.timeout(1000) }).then(response => response.ok).catch(() => false);
  if (ready) break;
  await new Promise(resolve => setTimeout(resolve, 250));
}
if (!ready) { server?.kill(); throw new Error('Build the portal before running npm run test:loans.'); }
const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(error => { server?.kill(); throw error; });
const site = { id: 'site-a', name: 'Booran Assigned Rooftop', isActive: true };
const siteB = { id: 'site-b', name: 'Booran Second Rooftop', isActive: true };
const outsider = { id: 'site-other', name: 'Unassigned Rooftop', isActive: true };
const vin = '1HGCM82633A004352';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const fixed = new Date('2030-05-10T02:00:00Z');
async function open({ unassigned = false, booking = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, timezoneId: 'Australia/Melbourne', serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  await page.clock.setFixedTime(fixed);
  const user = { id: 'clerk', name: 'Mathew Test Clerk', email: 'clerk@example.test', role: 'CLERK', defaultSiteId: unassigned ? '' : siteB.id, authorizedSiteIds: unassigned ? [] : [site.id, siteB.id] };
  const returned = { id: 'returned', agreementNumber: 'BMG-OLD', siteId: site.id, purpose: 'SERVICE_LOANER', status: 'RETURNED', basicInsuranceExcess: 2500, customer: { name: 'Previous Customer' }, vehicle: { rego: 'ABC123', make: 'BYD', model: 'Dolphin', year: 2024, vin }, outbound: { odometerOut: 4700 }, inbound: { odometerIn: 4800 }, loanStartDateTime: '2030-05-01T02:00:00Z' };
  const reservation = { id: 'booking', siteId: site.id, loanerNumber: 1, loanerName: 'GWM LOAN 1', customerName: 'Reserved Customer', customerMobile: '0412345678', rego: 'TBA', startAt: '2030-05-10T03:00:00Z', endAt: '2030-05-10T05:00:00Z', status: 'RESERVED' };
  const state = { issues: [], signs: [], agreements: [returned], bookings: booking ? [reservation] : [], bookingCreates: [], bookingCancels: [], issueFail: false, signFail: false };
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    let result = [];
    if (path === '/auth/me') result = user;
    else if (path === '/sites') result = [site, siteB, outsider];
    else if (path === '/loan-agreements/kpis') result = { totalCars: state.agreements.length, available: 1, outNow: 0, activeLoans: 0, activeTestDrives: 0, dueSoon: 0, overdue: 0 };
    else if (path === '/loan-agreements/reservations' && request.method() === 'POST') {
      expect(request.headers().authorization).toBe('Bearer session_v1.clerk-test-token');
      const body = request.postDataJSON(); state.bookingCreates.push(body);
      result = { ...body, id: 'new-booking', status: 'RESERVED', loanerName: `GWM LOAN ${body.loanerNumber}` };
      state.bookings.push(result);
    } else if (path === '/loan-agreements/reservations') result = state.bookings;
    else if (path.startsWith('/loan-agreements/reservations/') && path.endsWith('/cancel')) {
      expect(request.headers().authorization).toBe('Bearer session_v1.clerk-test-token');
      state.bookingCancels.push(path);
      state.bookings = [];
      result = { success: true };
    }
    else if (path === '/loan-agreements/issue') {
      expect(request.headers().authorization).toBe('Bearer session_v1.clerk-test-token');
      const body = request.postDataJSON(); state.issues.push(body);
      if (state.issueFail) return route.fulfill({ status: 403, json: { message: 'This loan record is outside your assigned sites.' } });
      result = { ...body, id: 'draft-1', agreementNumber: 'BMG-NEW-1', status: 'DRAFT', createdAt: fixed.toISOString(), loanStartDateTime: body.loanStartDateTime || fixed.toISOString() };
      state.agreements.push(result);
    } else if (path.endsWith('/sign')) {
      expect(request.headers().authorization).toBe('Bearer session_v1.clerk-test-token');
      const body = request.postDataJSON(); state.signs.push(body);
      if (state.signFail) return route.fulfill({ status: 503, json: { message: 'Signing temporarily unavailable' } });
      result = { ...state.agreements.at(-1), status: 'ACTIVE', signatures: body };
      state.agreements[state.agreements.length - 1] = result;
    } else if (path === '/loan-agreements') result = state.agreements;
    await route.fulfill({ json: result });
  });
  await page.addInitScript(user => {
    localStorage.setItem('booran_user', JSON.stringify(user));
    localStorage.setItem('booran_auth_token', 'session_v1.clerk-test-token');
  }, user);
  await page.goto(portalUrl + '/loaners');
  await expect(page.getByText('Issue Loaner', { exact: true })).toBeVisible();
  // Wait until authoritative session and rooftop options have loaded.
  if (!unassigned) await expect(page.locator('#clerk-active-rooftop option')).toHaveCount(3);
  return { page, context, state, reservation };
}
async function fill(page, { photos = false, reserved = false } = {}) {
  const dialog = page.getByRole('dialog');
  await dialog.getByText('Expand all', { exact: true }).click();
  if (!reserved) await dialog.getByLabel('Issue dealership rooftop').selectOption(site.id);
  await dialog.getByLabel(/^Customer full name/).fill('Real Customer');
  await dialog.getByLabel(/^Mobile phone/).fill('0412345678');
  await dialog.getByLabel(/^Email address/).fill('customer@example.com');
  await dialog.getByLabel(/^Date of birth/).fill('1990-04-20');
  await dialog.getByLabel(/^Residential address/).fill('1 Example Street, Melbourne');
  await dialog.getByLabel(/^Driver licence number/).fill('12345678');
  await dialog.getByLabel(/^Driver licence expiry/).fill('2032-04-20');
  await dialog.getByLabel(/physically sighted/).check();
  await dialog.getByLabel(/^Loan vehicle rego/).fill('ABC123');
  await dialog.getByLabel(/^Make/).fill('BYD');
  await dialog.getByLabel(/^Model/).fill('Dolphin');
  await dialog.getByLabel(/^Year/).fill('2024');
  await dialog.getByLabel(/^Vehicle VIN/).fill(vin);
  await dialog.getByLabel(/^Outbound odometer/).fill('4800');
  await dialog.getByLabel(/^Fuel \/ battery/).fill('0');
  await dialog.getByLabel(/^Security deposit/).fill('0');
  if (photos) for (const label of ['Front 45°', 'Rear 45°', 'Driver Side', 'Passenger Side', 'Odo / Dash']) {
    const input = dialog.getByLabel(`Choose ${label} photo`, { exact: true });
    await expect(input).toBeEnabled();
    await input.setInputFiles({ name: 'condition.png', mimeType: 'image/png', buffer: png });
    await expect(dialog.getByAltText(`${label} departure condition`)).toBeVisible();
  }
  await dialog.getByLabel(/read and agree/).check();
  await dialog.getByLabel(/consent to using/).check();
  await dialog.getByLabel(/acknowledge the privacy/).check();
  return dialog;
}
async function sign(page) {
  const pad = page.getByLabel('Customer signature drawing area');
  await pad.scrollIntoViewIfNeeded();
  const box = await pad.boundingBox();
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.2, { steps: 8 });
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.7, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText('Customer signature captured', { exact: true })).toBeVisible();
}
try {
  const first = await open();
  await first.page.getByText('Issue Loaner', { exact: true }).click();
  await expect(first.page.getByLabel('Issue dealership rooftop')).toHaveValue(siteB.id);
  expect(await first.page.getByLabel('Issue dealership rooftop').locator('option').allTextContents()).not.toContain(outsider.name);
  const dialog = await fill(first.page, { photos: true });
  await dialog.getByText('Issue & Activate Loan', { exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('draw their signature');
  expect(first.state.issues).toHaveLength(0);
  await sign(first.page);
  await first.page.screenshot({ path: '.tmp/portal-loan-wizard-desktop.png' });
  first.state.signFail = true;
  await dialog.getByText('Issue & Activate Loan', { exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Agreement draft saved');
  expect(first.state.issues).toHaveLength(1); expect(first.state.signs).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Close loan wizard' }).click();
  await first.page.getByRole('button', { name: 'Complete handover: ABC123', exact: true }).click();
  await dialog.getByRole('button', { name: 'Expand all' }).click();
  await expect(dialog.getByLabel(/^Customer full name/)).toBeDisabled();
  await dialog.getByLabel(/read and agree/).check();
  await dialog.getByLabel(/consent to using/).check();
  await dialog.getByLabel(/acknowledge the privacy/).check();
  await sign(first.page);
  first.state.signFail = false;
  await dialog.getByText('Retry activation', { exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(first.state.issues).toHaveLength(1); expect(first.state.signs).toHaveLength(2);
  const issued = first.state.issues[0];
  expect(issued.siteId).toBe(site.id); expect(issued.vehicle.vin).toBe(vin);
  expect(issued.customer.residentialAddress).toBe('1 Example Street, Melbourne');
  expect(issued.outbound.fuelLevelOutPercent).toBe(0); expect(issued.securityDepositHeld).toBe(0);
  expect(Object.keys(issued.outbound.photos)).toHaveLength(5);
  expect(issued.outbound.photos.odometerDash).toMatch(/^data:image\/jpeg;base64,/);
  expect(first.state.signs[1].borrowerSignatureDataUrl).toMatch(/^data:image\/png;base64,/);
  expect(first.state.agreements.at(-1).status).toBe('ACTIVE');
  console.log('PASS: Clerk five-section flow, scoped rooftops, five photos, real signature, sign retry without duplicate issue, and ACTIVE confirmation.');
  await first.context.close();

  const failure = await open();
  failure.state.issueFail = true;
  await failure.page.getByText('Issue Loaner', { exact: true }).click();
  const failedDialog = await fill(failure.page);
  await sign(failure.page);
  await failedDialog.getByText('Issue & Activate Loan', { exact: true }).click();
  await expect(failedDialog.getByRole('alert')).toContainText('outside your assigned sites');
  expect(failure.state.signs).toHaveLength(0); expect(failure.state.agreements).toHaveLength(1);
  await expect(failedDialog.getByLabel(/^Customer full name/)).toHaveValue('Real Customer');
  console.log('PASS: Backend issue rejection preserves form and never reports a fake active loan.');
  await failure.page.setViewportSize({ width: 390, height: 844 });
  await failure.page.screenshot({ path: '.tmp/portal-loan-wizard-mobile.png' });
  expect(await failedDialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  console.log('PASS: Wizard fits mobile viewport.');
  await failure.context.close();

  const calendar = await open();
  await expect(calendar.page.getByRole('link', { name: 'Loan Operations', exact: false }).first()).toHaveAttribute('href', '/loaners');
  await calendar.page.locator('#clerk-active-rooftop').selectOption(site.id);
  await calendar.page.getByRole('button', { name: 'Reserve a loan vehicle', exact: true }).click();
  await calendar.page.getByLabel('Collection', { exact: true }).fill('2030-05-10T13:00');
  await calendar.page.getByLabel('Due back', { exact: true }).fill('2030-05-10T15:00');
  await calendar.page.getByRole('button', { name: /^GWM LOAN 3/ }).click();
  await calendar.page.getByLabel('Reservation customer name').fill('Booking Customer');
  await calendar.page.getByLabel('Reservation customer mobile').fill('0412345678');
  await calendar.page.getByRole('button', { name: 'TBA (assign later)', exact: true }).click();
  await calendar.page.getByRole('button', { name: 'Confirm reservation', exact: true }).click();
  await expect(calendar.page.getByTestId('loan-booking-new-booking')).toBeVisible();
  expect(calendar.state.bookingCreates).toHaveLength(1);
  expect(calendar.state.bookingCreates[0]).toMatchObject({ siteId: site.id, loanerNumber: 3, customerName: 'Booking Customer', rego: 'TBA' });
  await calendar.page.getByRole('button', { name: 'Cancel reservation', exact: true }).click();
  await expect(calendar.page.getByTestId('loan-booking-new-booking')).toHaveCount(0);
  expect(calendar.state.bookingCancels).toHaveLength(1);
  await calendar.page.setViewportSize({ width: 390, height: 844 });
  await expect(calendar.page.getByRole('link', { name: 'Loaners', exact: true })).toBeVisible();
  console.log('PASS: Warranty Clerk desktop/mobile loan navigation and booking creation, calendar display and cancellation work without Technician login.');
  await calendar.context.close();

  const booked = await open({ booking: true });
  await booked.page.getByText('Issue vehicle / enter rego', { exact: true }).click();
  await expect(booked.page.getByLabel('Issue dealership rooftop')).toBeDisabled();
  await expect(booked.page.getByLabel(/^Loan vehicle rego/)).toHaveValue('');
  const bookedDialog = await fill(booked.page, { reserved: true });
  await expect(bookedDialog.getByLabel(/^Expected return date/)).toBeDisabled();
  await expect(bookedDialog.getByLabel(/^Return time/)).toBeDisabled();
  await sign(booked.page);
  await bookedDialog.getByText('Issue & Activate Loan', { exact: true }).click();
  await expect(bookedDialog).toHaveCount(0);
  expect(booked.state.issues[0]).toMatchObject({ reservationId: booked.reservation.id, siteId: site.id, loanStartDateTime: booked.reservation.startAt, dueBackDateTime: booked.reservation.endAt, vehicle: { rego: 'ABC123' } });
  console.log('PASS: Reserved handover preserves the booked rooftop and exact times, replacing TBA with actual registration.');
  await booked.context.close();

  const drive = await open();
  await drive.page.getByRole('button', { name: /^(Start )?Test Drive$/ }).click();
  const driveDialog = await fill(drive.page);
  await sign(drive.page);
  await driveDialog.getByText('Start & Activate Test Drive', { exact: true }).click();
  await expect(driveDialog).toHaveCount(0);
  expect(drive.state.issues[0].purpose).toBe('TEST_DRIVE');
  expect(new Date(drive.state.issues[0].dueBackDateTime).getTime() - fixed.getTime()).toBe(3600000);
  console.log('PASS: Test drive uses the same handover with its purpose and one-hour return schedule.');
  await drive.context.close();

  const noSite = await open({ unassigned: true });
  await expect(noSite.page.getByRole('alert').filter({ hasText: 'No dealership rooftop is assigned' })).toContainText('No dealership rooftop is assigned');
  await noSite.page.getByText('Issue Loaner', { exact: true }).click();
  await expect(noSite.page.getByRole('dialog').getByText('Issue & Activate Loan', { exact: true })).toBeDisabled();
  expect(await noSite.page.getByLabel('Issue dealership rooftop').locator('option').count()).toBe(0);
  console.log('PASS: Unassigned clerk receives a clear explanation and cannot select arbitrary rooftops.');
  await noSite.context.close();
} finally { await browser.close(); server?.kill(); }
