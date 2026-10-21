// End-to-end check against a RUNNING server (default http://localhost:5000/api).
//   1. npm run seed      2. npm run dev      3. node scripts/e2e-check.mjs
// Creates throw-away users/contracts in the database it talks to (random phone numbers).
const BASE = process.env.API_URL || 'http://localhost:5000/api';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? '✅' : '❌'} ${name}${cond ? '' : '  -> ' + extra}`); };

const call = async (method, path, { token, body, form } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  let json = null; try { json = await res.json(); } catch { /* file responses */ }
  return { status: res.status, body: json, res };
};
const login = async (phone, password) => (await call('POST', '/auth/login', { body: { phone, password } })).body;
const rnd = () => String(Math.floor(6000000000 + Math.random() * 3999999999));
const JPEG = Buffer.from('ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffda0008010100003f00bf80ffd9', 'hex');
const photoForm = (stage = 0) => { const f = new FormData(); f.append('photo', new Blob([JPEG], { type: 'image/jpeg' }), 'photo.jpg'); f.append('stage', String(stage)); f.append('note', 'e2e'); f.append('lat', '10.78'); f.append('lng', '79.13'); return f; };

const admin = await login('9999999999', 'admin123');
ok('Demo login admin', admin.success && admin.user.role === 'admin', JSON.stringify(admin));
const f1 = await login('9876543210', 'farmer123'); ok('Demo login farmer 9876543210', f1.success);
const f2 = await login('9876543211', 'farmer123'); ok('Demo login farmer 9876543211', f2.success);
const m0 = await login('9876500000', 'merchant123'); ok('Demo login merchant 9876500000', m0.success && m0.user.role === 'buyer');

// Register
const fPhone = rnd(), mPhone = rnd(), f2Phone = rnd();
let r = await call('POST', '/auth/register', { body: { name: 'E2E Farmer', phone: fPhone, password: 'pass1234', role: 'farmer', village: 'Testpur' } });
const F = r.body; ok('Register new farmer (201)', r.status === 201 && F.token, JSON.stringify(r.body));
r = await call('POST', '/auth/register', { body: { name: 'E2E Merchant', phone: mPhone, password: 'pass1234', role: 'buyer', company: 'E2E Agro' } });
const M = r.body; ok('Register new merchant (role buyer) (201)', r.status === 201 && M.user?.role === 'buyer' && M.user?.company === 'E2E Agro', JSON.stringify(r.body));
r = await call('POST', '/auth/register', { body: { name: 'No Contract Farmer', phone: f2Phone, password: 'pass1234', role: 'farmer' } });
const F2 = r.body;
r = await call('POST', '/auth/register', { body: { name: 'Evil', phone: rnd(), password: 'pass1234', role: 'admin' } });
ok('Self-registration as admin refused', r.status === 400);

// Saved in DB? Admin list is read straight from MongoDB.
r = await call('GET', '/users?limit=500', { token: admin.token });
const saved = (r.body.data || []).filter((u) => [fPhone, mPhone].includes(u.phone));
ok('Both new users exist in the users collection', saved.length === 2);
r = await call('GET', '/users/pending', { token: admin.token });
const pendingPhones = (r.body.data || []).map((u) => u.phone);
const autoVerified = F.user.verified === true;
console.log(`   AUTO_VERIFY_USERS appears ${autoVerified ? 'ON' : 'OFF'}`);
if (!autoVerified) ok('New unverified users appear on admin Verify Users list', pendingPhones.includes(fPhone) && pendingPhones.includes(mPhone));

// Farmer dropdown (before verification, to prove unverified farmers are listed)
r = await call('GET', '/users/farmers', { token: M.token });
const listed = (r.body.data || []).find((x) => x.phone === fPhone);
ok('New farmer in Select Farmer list immediately (no restart)', Boolean(listed));
ok('Farmers endpoint sends Cache-Control: no-store', /no-store/.test(r.res.headers.get('cache-control') || ''));
if (!autoVerified) {
  ok('Unverified farmer is flagged verified:false', listed?.verified === false);
  r = await call('POST', '/contracts', { token: M.token, body: { farmer: F.user._id, crop: 'X', quantityQuintals: 1, pricePerQuintal: 1, grade: 'A', deliveryDate: '2027-01-01' } });
  ok('Unverified merchant cannot create a contract', r.status === 403);
  for (const u of [F, M, F2]) await call('PATCH', `/users/${u.user._id}/verify`, { token: admin.token });
  F.token = (await login(fPhone, 'pass1234')).token; M.token = (await login(mPhone, 'pass1234')).token; F2.token = (await login(f2Phone, 'pass1234')).token;
}

// Contract
r = await call('POST', '/contracts', { token: M.token, body: { farmer: F.user._id, crop: 'E2E Paddy', quantityQuintals: 10, pricePerQuintal: 2000, grade: 'A', deliveryDate: '2027-03-01' } });
const C = r.body.data; ok('Merchant creates contract with new farmer', r.status === 201 && C?._id, JSON.stringify(r.body));
r = await call('POST', '/contracts', { token: M.token, body: { farmerId: F.user._id, crop: 'X', quantity: 1 } });
ok('Old client field names are rejected with field errors', r.status === 400 && Array.isArray(r.body.errors) && r.body.errors.length > 0);
r = await call('GET', `/contracts/${C._id}/payments`, { token: M.token });
ok('Payments are 30/40/30 of 20000 = 6000/8000/6000', JSON.stringify(r.body.data.map((p) => p.amount)) === '[6000,8000,6000]', JSON.stringify(r.body.data?.map((p) => p.amount)));

// Photos before activation, and role gates
r = await call('POST', `/contracts/${C._id}/photos`, { token: F.token, form: photoForm() });
ok('Farmer cannot upload before contract is active (400)', r.status === 400);
r = await call('GET', '/contracts?status=active', { token: F2.token });
ok('Farmer with no contract has an empty active list (client shows the friendly message)', r.body.data.length === 0);

// Signing
r = await call('PATCH', `/contracts/${C._id}/sign`, { token: F.token, body: { password: 'wrong' } });
ok('Sign with wrong password refused (401)', r.status === 401);
r = await call('PATCH', `/contracts/${C._id}/sign`, { token: F.token, body: { password: 'pass1234' } });
ok('Farmer signs -> contract active (merchant signed at creation)', r.status === 200 && r.body.data.status === 'active', JSON.stringify(r.body));

// Upload
r = await call('POST', `/contracts/${C._id}/photos`, { token: M.token, form: photoForm() });
ok('Merchant upload -> 403', r.status === 403);
r = await call('POST', `/contracts/${C._id}/photos`, { token: admin.token, form: photoForm() });
ok('Admin upload -> 403', r.status === 403);
r = await call('POST', `/contracts/${C._id}/photos`, { token: F.token, form: photoForm() });
const P = r.body.data; ok('NEW farmer uploads photo (201)', r.status === 201 && P?._id, JSON.stringify(r.body));
r = await call('GET', `/contracts/${C._id}/photos`, { token: M.token });
ok('Merchant sees the photo, unseenCount=1', r.body.data.length === 1 && r.body.unseenCount === 1);
r = await call('GET', `/photos/${P._id}/file`, { token: M.token }); ok('Merchant can fetch the file', r.res.status === 200);
r = await call('GET', `/photos/${P._id}/file`, { token: m0.token }); ok("Another merchant cannot fetch it (403)", r.status === 403);
r = await call('GET', '/notifications', { token: M.token });
ok('Merchant got a photo_uploaded notification', r.body.data.some((n) => n.type === 'photo_uploaded'));
r = await call('PATCH', `/photos/${P._id}/seen`, { token: M.token }); ok('Merchant marks photo seen', r.status === 200);
r = await call('DELETE', `/photos/${P._id}`, { token: M.token }); ok('Merchant cannot delete photo (403)', r.status === 403);

// Stage + payments order
r = await call('POST', `/contracts/${C._id}/stage`, { token: M.token, body: { stage: 1 } }); ok('Merchant cannot advance stage (403)', r.status === 403);
r = await call('POST', `/contracts/${C._id}/payments/0/release`, { token: F.token }); ok('Farmer cannot release payment (403)', r.status === 403);
r = await call('POST', `/contracts/${C._id}/payments/1/release`, { token: M.token }); ok('Cannot release 40% before 30% / harvest (400)', r.status === 400);
r = await call('POST', `/contracts/${C._id}/payments/0/release`, { token: M.token }); ok('Release 30%', r.status === 200);
for (const s of [1, 2]) { r = await call('POST', `/contracts/${C._id}/stage`, { token: F.token, body: { stage: s } }); ok(`Farmer advances to stage ${s}`, r.status === 200); }
r = await call('GET', '/notifications', { token: M.token }); ok('Merchant notified of stage advance', r.body.data.some((n) => n.type === 'stage_advanced'));
r = await call('POST', `/contracts/${C._id}/payments/1/release`, { token: M.token }); ok('Release 40% (harvest)', r.status === 200);
r = await call('POST', `/contracts/${C._id}/payments/2/release`, { token: M.token }); ok('Cannot release last 30% before delivery (400)', r.status === 400);
r = await call('POST', `/contracts/${C._id}/stage`, { token: F.token, body: { stage: 3 } }); ok('Farmer advances to Delivered', r.status === 200);
r = await call('POST', `/contracts/${C._id}/payments/2/release`, { token: M.token }); ok('Release last 30%', r.status === 200);

// Disputes
r = await call('POST', '/disputes', { token: M.token, body: { contractId: C._id, reason: 'e2e dispute' } });
const D = r.body.data; ok('Merchant raises dispute', r.status === 201);
r = await call('PATCH', `/disputes/${D._id}/resolve`, { token: M.token, body: { resolutionNote: 'x' } }); ok('Merchant cannot resolve (403)', r.status === 403);
r = await call('PATCH', `/disputes/${D._id}/resolve`, { token: admin.token, body: { resolutionNote: 'ok' } }); ok('Admin resolves', r.status === 200);
r = await call('DELETE', `/photos/${P._id}`, { token: admin.token }); ok('Admin deletes photo', r.status === 200);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
