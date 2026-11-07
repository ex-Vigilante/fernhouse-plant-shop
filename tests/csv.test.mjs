import test from 'node:test';
import assert from 'node:assert/strict';
import { cell, ordersToCsv } from '../src/admin/csv.js';

test('csv cells are quoted and spreadsheet formulas are neutralised', () => {
  assert.equal(cell('plain'), 'plain');
  assert.equal(cell('a,b'), '"a,b"');
  assert.equal(cell('say "hi"'), '"say ""hi"""');
  assert.equal(cell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(cell('+1 555'), "'+1 555");
  assert.equal(cell(null), '');
});

test('orders export has a UTF-8 BOM, one row per order and dollar amounts', () => {
  const csv = ordersToCsv([{
    id: 1001, created_at: '2026-11-07T10:00:00Z', status: 'paid', customer_name: 'Zoë Müller', email: 'z@x.test', phone: '+15035550100',
    shipping_method: 'standard', shipping_address: { line1: '1 Fern St', city: 'Portland', state: 'OR', postal_code: '97205', country: 'US' },
    order_items: [{ name: 'Monstera', qty: 2 }, { name: 'Pothos', qty: 1 }], subtotal_cents: 16400, shipping_cents: 0, total_cents: 16400, currency: 'usd', stripe_payment_intent: 'pi_1',
  }]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[1].includes('Zoë Müller') && lines[1].includes('FH-1001') && lines[1].includes('164.00') && lines[1].includes('Monstera x2; Pothos x1'));
});
