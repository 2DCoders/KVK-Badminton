const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const context = { exports: {}, Intl, Date, Error, ...globals };
  vm.runInNewContext(outputText, context);
  return context.exports;
}
const utils = load('pages/bookings/special-bookings/booking-utils.ts');
test('cashier duration labels show months at four-week intervals', () => {
  assert.equal(utils.CASHIER_MAX_WEEKS, 48);
  assert.equal(utils.durationLabel(1), '1 week');
  assert.equal(utils.durationLabel(4), '4 weeks (1 month)');
  assert.equal(utils.durationLabel(7), '7 weeks');
  assert.equal(utils.durationLabel(8), '8 weeks (2 months)');
  assert.equal(utils.durationLabel(48), '48 weeks (12 months)');
});
const slots = [
  { slotId: 'a', startTime: '08:00:00', endTime: '09:00:00', price: 100 },
  { slotId: 'b', startTime: '09:00:00', endTime: '10:00:00', price: 200 },
  { slotId: 'c', startTime: '10:00:00', endTime: '11:00:00', price: 300 },
  { slotId: 'd', startTime: '12:00:00', endTime: '13:00:00', price: 400 },
];
test('duration remains weeks and end date is inclusive across leap days', () => {
  assert.equal(utils.maximumWeeks('12'), 12);
  assert.equal(utils.maximumWeeks('1.5'), 0);
  assert.equal(utils.endDate('2027-01-01', 12), '2027-03-25');
  assert.equal(utils.endDate('2028-02-26', 1), '2028-03-03');
});
test('schedule rejects past/invalid dates, excessive duration, duplicate days and gaps after deselection', () => {
  const validate = (date, weeks, days, ids) => utils.validateSchedule(date, '2027-01-01', weeks, 12, days, ids, slots);
  assert.equal(validate('2027-01-01', 12, ['Monday'], ['a', 'b']), '');
  for (const args of [['2026-12-31', 1, ['Monday'], ['a']], ['2027-02-30', 1, ['Monday'], ['a']], ['2027-01-01', 13, ['Monday'], ['a']], ['2027-01-01', 1, ['Monday', 'Monday'], ['a']], ['2027-01-01', 1, ['Monday'], ['a', 'c']], ['2027-01-01', 1, ['Monday'], ['c', 'd']]]) assert.notEqual(validate(...args), '');
});
test('hold countdown expires against an absolute deadline after a sleeping tab resumes', () => {
  assert.equal(utils.countdown(utils.remainingSeconds(420000, 0)), '07:00');
  assert.equal(utils.remainingSeconds(420000, 900000), 0);
});
test('two courts can use overlapping times while gaps are checked per court', () => {
  const courtSlots = [
    ...slots.map(slot => ({ ...slot, courtId: 'court-1' })),
    { ...slots[0], slotId: 'other', courtId: 'court-2' },
  ];
  const validate = ids => utils.validateSchedule('2027-01-01', '2027-01-01', 48, 48, ['Monday'], ids, courtSlots);
  assert.equal(validate(['a', 'b', 'other']), '');
  assert.notEqual(validate(['a', 'c', 'other']), '');
});
function fixture(responses) {
  const calls = [];
  const axios = {
    get: async (...args) => { calls.push(['GET', ...args]); return { data: responses.shift() }; },
    post: async (...args) => { calls.push(['POST', ...args]); return { data: responses.shift() }; },
    delete: async (...args) => { calls.push(['DELETE', ...args]); return { data: responses.shift() }; },
    isAxiosError: () => false,
  };
  const api = load('services/special-bookings-api.ts', { FormData, localStorage: { getItem: () => JSON.stringify({ token: 'staff-token' }) }, require: name => {
    if (name === 'axios') return axios;
    if (name === '@/env') return { getEnv: () => ({ API_URL: 'https://arena.test/api' }) };
    throw new Error(name);
  } });
  return { api, calls };
}
const schedule = { courtIds: ['court-1', 'court-2'], startDate: '2027-01-01', weeks: 12, daysOfWeek: ['Monday'], slotIds: ['a', 'b'] };
test('cashier setup returns active courts and their individual slot prices', async () => {
  const setup = {
    courts: [{ id: 'court-1', name: 'Court 1' }, { id: 'court-2', name: 'Court 2' }],
    slots: [{ ...slots[0], courtId: 'court-1' }, { ...slots[1], courtId: 'court-2' }],
    maximumWeeks: 12,
  };
  const { api, calls } = fixture([setup]);
  const signal = new AbortController().signal;
  assert.deepEqual(await api.getCashierBookingSetup(signal), setup);
  assert.match(calls[0][1], /cashier-setup$/);
  assert.equal(calls[0][2].headers.Authorization, 'Bearer staff-token');
  assert.equal(calls[0][2].signal, signal);
});
test('staff can hold slots, upload their slip, then approve its stored revision', async () => {
  const { api, calls } = fixture([{ reference: 'ref', status: 'awaiting_slip' }, { reference: 'ref', slipRevision: 'revision', status: 'ready' }, { status: 'approved', smsSent: true }]);
  const request = { holdToken: 'hold', customerName: 'Test', phoneNumber: '0771234567', couponCode: '', expectedAmount: 1200 };
  const reservation = await api.holdCashierSlip(request);
  const file = new File(['%PDF-1.7'], 'slip.pdf', { type: 'application/pdf' });
  const uploaded = await api.uploadCashierSlip(reservation.reference, file);
  const approved = await api.approveCashierSlip(uploaded.reference, uploaded.slipRevision);
  assert.match(calls[0][1], /cashier-slips$/);
  assert.deepEqual(calls[0][2], request);
  assert.match(calls[1][1], /cashier-slips\/ref\/slip$/);
  assert.equal(calls[1][2].get('slip').name, 'slip.pdf');
  assert.match(calls[2][1], /cashier-slips\/ref\/approve\/revision$/);
  assert.equal(approved.smsSent, true);
  assert.ok(calls.every(call => call[3].headers.Authorization === 'Bearer staff-token'));
});
test('reserve rechecks availability and does not hold conflicting sessions', async () => {
  const { api, calls } = fixture([{ isAvailable: false }]);
  const result = await api.checkAndHoldMemberBooking(schedule);
  assert.equal(result.hold, null);
  assert.equal(calls.length, 1);
  assert.match(calls[0][1], /check-availability$/);
  assert.equal(calls[0][2], schedule);
});
test('reserve creates a hold only after a successful recheck', async () => {
  const { api, calls } = fixture([{ isAvailable: true }, { holdToken: 'hold', expiresInSeconds: 420 }]);
  const result = await api.checkAndHoldMemberBooking(schedule);
  assert.equal(result.hold.holdToken, 'hold');
  assert.equal(calls.length, 2);
  assert.match(calls[0][1], /check-availability$/);
  assert.match(calls[1][1], /hold$/);
  assert.equal(calls[1][2], schedule);
});
test('cash and card confirmations send the reviewed total to the authenticated cashier endpoint', async () => {
  for (const paymentType of [1, 2]) {
    const { api, calls } = fixture([{ succeeded: true }]);
    const request = { holdToken: 'hold', customerName: 'Test', phoneNumber: '0771234567', couponCode: 'UNUSED', paymentType, expectedAmount: 1200 };
    await api.confirmCashierBooking(request);
    assert.equal(calls[0][1], 'https://arena.test/api/member-badminton-bookings/cashier-confirm');
    assert.deepEqual(calls[0][2], request);
    assert.equal(calls[0][3].headers.Authorization, 'Bearer staff-token');
    assert.equal('amount' in calls[0][2], false);
  }
});
test('coupon pricing is bound to the hold and cancellation releases that reservation', async () => {
  const { api, calls } = fixture([{ finalAmount: 100 }, {}]);
  await api.quoteCashierBooking('hold', 'UNUSED');
  assert.match(calls[0][1], /cashier-quote$/);
  await api.releaseMemberHold('hold');
  assert.equal(JSON.stringify(calls[0][2]), JSON.stringify({ holdToken: 'hold', couponCode: 'UNUSED' }));
  assert.equal(calls[1][0], 'DELETE');
  assert.match(calls[1][1], /hold\/hold$/);
});
test('availability browsing queries the shared booking store with weeks and selected days', async () => {
  const { api, calls } = fixture([[]]);
  const request = { courtId: 'court-2', startDate: '2027-01-01', weeks: 12, daysOfWeek: ['Monday'] };
  await api.getCashierAvailability(request);
  assert.match(calls[0][1], /cashier-availability$/);
  assert.deepEqual(calls[0][2], request);
  assert.equal(calls[0][3].headers.Authorization, 'Bearer staff-token');
});

test('availability returns all statuses and forwards cancellation for stale searches', async () => {
  const response = { startDate: '2027-01-01', endDate: '2027-01-21', weeks: 3, dates: ['2027-01-04', '2027-01-11', '2027-01-18'], slots: [
    { slotId: 'a', startTime: '08:00', endTime: '09:00', availableCount: 1, totalCount: 3, availableEveryWeek: false,
      sessions: [{ date: '2027-01-04', status: 'booked' }, { date: '2027-01-11', status: 'held' }, { date: '2027-01-18', status: 'available' }] },
  ] };
  const { api, calls } = fixture([response]);
  const signal = new AbortController().signal;
  const result = await api.getCashierAvailability({ startDate: '2027-01-01', weeks: 3, daysOfWeek: ['Monday'] }, signal);
  assert.deepEqual(result, response);
  assert.equal(calls[0][3].signal, signal);
  assert.equal(result.slots[0].availableEveryWeek, false);
});
