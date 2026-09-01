const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {createSpecializedQrMatrix,specializedQrModuleSizeInches,specializedQrSvg}=require('../dist/application/specialized-creation-qr.js');

test('specialized QR matches independent Version 2-L reference matrix',()=>{
  const qr=createSpecializedQrMatrix('https://example.com/rsvp');
  assert.equal(qr.version,2);
  assert.equal(qr.size,25);
  assert.equal(qr.quietZoneModules,4);
  assert.equal(qr.errorCorrection,'L');
  const flattened=qr.modules.map(row=>row.map(value=>value?'1':'0').join('')).join('');
  assert.equal(createHash('sha256').update(flattened).digest('hex'),'60f7409dfe55e7a74882eb0901b01a90e3f927bc09e13028f60a14eabe4a27d7');
  assert.deepEqual(createSpecializedQrMatrix('https://example.com/rsvp').modules,qr.modules);
});

test('specialized QR reports physical module size including required quiet zone',()=>{
  const moduleSize=specializedQrModuleSizeInches('https://example.com/rsvp',1,1);
  assert.ok(Math.abs(moduleSize-(1/33))<1e-12);
  const svg=specializedQrSvg('https://example.com/rsvp',0,0,1,1);
  assert.match(svg,/aria-label="QR code for https:\/\/example\.com\/rsvp"/);
  assert.match(svg,/<rect/);
});

test('specialized QR fails honestly for empty or unsupported destinations',()=>{
  assert.throws(()=>createSpecializedQrMatrix('   '),/destination is required/i);
  assert.throws(()=>createSpecializedQrMatrix('x'.repeat(256)),/too long|capacity/i);
});
