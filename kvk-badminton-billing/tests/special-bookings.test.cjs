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
function fixture(responses) {
  const calls = [];
  const axios = {
    get: async (...args) => { calls.push(['GET', ...args]); return { data: responses.shift() }; },
    post: async (...args) => { calls.push(['POST', ...args]); return { data: responses.shift() }; },
    delete: async (...args) => { calls.push(['DELETE', ...args]); return { data: responses.shift() }; },
    isAxiosError: () => false,
  };
  const api = load('services/special-bookings-api.ts', { localStorage: { getItem: () => JSON.stringify({ token: 'staff-token' }) }, require: name => {
    if (name === 'axios') return axios;
    if (name === '@/env') return { getEnv: () => ({ API_URL: 'https://arena.test/api' }) };
    throw new Error(name);
  } });
  return { api, calls };
}
const schedule = { startDate: '2027-01-01', weeks: 12, daysOfWeek: ['Monday'], slotIds: ['a', 'b'] };
test('reserve rechecks availability and does not hold conflicting sessions', async () => {
  const { api, calls } = fixture([{ isAvailable: false }]);
  const result = await api.checkAndHoldMemberBooking(schedule);
  assert.equal(result.hold, null);
  assert.equal(calls.length, 1);
  assert.match(calls[0][1], /check-availability$/);
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
test('cash and card confirmations use the authenticated cashier endpoint without gateway or client prices', async () => {
  for (const paymentType of [1, 2]) {
    const { api, calls } = fixture([{ succeeded: true }]);
    const request = { holdToken: 'hold', customerName: 'Test', phoneNumber: '0771234567', couponCode: 'UNUSED', paymentType };
    await api.confirmCashierBooking(request);
    assert.equal(calls[0][1], 'https://arena.test/api/member-badminton-bookings/cashier-confirm');
    assert.deepEqual(calls[0][2], request);
    assert.equal(calls[0][3].headers.Authorization, 'Bearer staff-token');
    assert.equal('amount' in calls[0][2], false);
  }
});
test('coupon pricing is bound to the hold and cancellation releases that reservation', async () => {
  const { api, calls } = fixture([{ finalAmount: 100 }, {}]);
  await api.quoteMemberCoupon('hold', 'UNUSED');
  await api.releaseMemberHold('hold');
  assert.equal(JSON.stringify(calls[0][2]), JSON.stringify({ holdToken: 'hold', couponCode: 'UNUSED' }));
  assert.equal(calls[1][0], 'DELETE');
  assert.match(calls[1][1], /hold\/hold$/);
});
test('availability browsing queries the shared booking store with weeks and selected days', async () => {
  const { api, calls } = fixture([[]]);
  const request = { startDate: '2027-01-01', weeks: 12, daysOfWeek: ['Monday'] };
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
