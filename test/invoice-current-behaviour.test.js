'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var coupons = require('../lib/coupons');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function makeItem(overrides) {
  return Object.assign({
    id: 1,
    sku: 'SKU-1',
    name: 'Test product',
    hsn: '1006',
    price: 1000,
    qty: 1
  }, overrides || {});
}

function makeStoredOrder(items, coupon, totals, overrides) {
  return Object.assign({
    id: 1001,
    date: '01/01/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  }, overrides || {});
}

test('invoice uses the billed HSN rate when stored order lines omit gstRate', function () {
  var items = [makeItem({ hsn: '1006', price: 1000 })];
  var ledgerTotals = pricing.computeTotals(items, '');
  var storedOrder = makeStoredOrder(items, '', ledgerTotals);
  var invoiceFigures = invoice.computeInvoiceFigures(storedOrder);

  assert.equal(ledgerTotals.tax, 50);
  assert.equal(ledgerTotals.total, 1050);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, ledgerTotals.tax);
  assert.equal(invoiceFigures.total, ledgerTotals.total);
});

test('invoice uses the billed coupon cap, taxable basis, and total', function () {
  var items = [makeItem({ hsn: '0902', price: 2000 })];
  var ledgerTotals = pricing.computeTotals(items, 'SAVE10');
  var storedOrder = makeStoredOrder(items, 'SAVE10', ledgerTotals);
  var invoiceFigures = invoice.computeInvoiceFigures(storedOrder);

  assert.equal(ledgerTotals.discount, 150);
  assert.equal(ledgerTotals.tax, 333);
  assert.equal(ledgerTotals.total, 2183);
  assert.equal(invoiceFigures.tax, ledgerTotals.tax);
  assert.equal(invoiceFigures.discount, ledgerTotals.discount);
  assert.equal(invoiceFigures.total, ledgerTotals.total);
});

test('invoice follows the pricing coupon minimum validation', function () {
  var items = [makeItem({ price: 100 })];
  var ledgerTotals = pricing.computeTotals(items, '');
  var storedOrder = makeStoredOrder(items, 'SAVE10', ledgerTotals);
  var invoiceFigures = invoice.computeInvoiceFigures(storedOrder);

  assert.equal(coupons.validate('SAVE10', 100).valid, false);
  assert.equal(ledgerTotals.discount, 0);
  assert.equal(invoiceFigures.discount, 0);
  assert.equal(invoiceFigures.tax, ledgerTotals.tax);
  assert.equal(invoiceFigures.total, ledgerTotals.total);
});

test('GST reconciliation matches billed active orders and excludes cancelled orders', function () {
  var items = [makeItem({ hsn: '1006', price: 1000 })];
  var totals = pricing.computeTotals(items, '');
  var activeOrder = makeStoredOrder(items, '', totals, { id: 1001 });
  var cancelledOrder = makeStoredOrder(items, '', totals, {
    id: 1002,
    status: 'cancelled',
    total: 99999
  });

  var reconciliation = reports.getGstReconciliation({
    orders: [activeOrder, cancelledOrder]
  });

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
