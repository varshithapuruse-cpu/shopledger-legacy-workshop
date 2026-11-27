'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('EXPECTED BEHAVIOUR — invoice totals and GST breakdown match the billed HSN-priced order', function () {
  var items = [{
    id: 1,
    sku: 'RICE-1',
    name: 'Rice',
    hsn: '1006',
    price: 1000,
    qty: 1
  }];
  var billed = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures({
    items: items,
    coupon: '',
    total: billed.total
  });

  assert.equal(invoiceFigures.subtotal, billed.subtotal);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);

  var html = invoice.render({
    id: 1001,
    items: items,
    coupon: '',
    total: billed.total
  });
  assert.ok(html.includes('<td>CGST</td><td class="r">₹25.00</td>'));
  assert.ok(html.includes('<td>SGST</td><td class="r">₹25.00</td>'));
});
