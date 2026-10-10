import type { ReceiptData } from "./receiptTypes.js";

const rupee = (n: number) => `Rs. ${n.toFixed(2)}`;

/**
 * 80mm-width printable thermal receipt, rendered as a standalone HTML
 * fragment. Stored verbatim on the Receipt row and also served to the
 * frontend for the Print / Download PDF actions.
 */
export function renderReceiptHtml(data: ReceiptData): string {
  const itemRows = data.items
    .map(
      (item) => `
      <tr>
        <td class="name">${escapeHtml(item.name)}</td>
        <td class="qty">${item.quantity}</td>
        <td class="rate">${item.rate.toFixed(2)}</td>
        <td class="total">${item.total.toFixed(2)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt ${escapeHtml(data.receiptNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    width: 80mm;
    margin: 0 auto;
    padding: 8px 10px 16px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    color: #111;
  }
  .center { text-align: center; }
  .brand { font-size: 16px; font-weight: 700; letter-spacing: 1px; }
  .muted { color: #444; font-size: 11px; }
  hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; border-bottom: 1px solid #333; padding-bottom: 2px; }
  td { font-size: 11.5px; padding: 2px 0; vertical-align: top; }
  .qty, .rate, .total { text-align: right; white-space: nowrap; }
  .totals td { padding: 1px 0; }
  .totals .label { text-align: left; }
  .totals .value { text-align: right; }
  .grand { font-weight: 700; font-size: 14px; }
  .footer { margin-top: 10px; }
</style>
</head>
<body>
  <div class="center">
    <div class="brand">${escapeHtml(data.restaurantName)}</div>
    ${data.address ? `<div class="muted">${escapeHtml(data.address)}</div>` : ""}
    ${data.gstin ? `<div class="muted">GSTIN: ${escapeHtml(data.gstin)}</div>` : ""}
    ${data.phone ? `<div class="muted">Ph: ${escapeHtml(data.phone)}</div>` : ""}
  </div>
  <hr />
  <div>Order #: ${escapeHtml(data.orderNumber)}</div>
  <div>Table: ${escapeHtml(data.tableLabel)}</div>
  <div>Waiter: ${escapeHtml(data.waiterName)}</div>
  ${data.customerName ? `<div>Customer: ${escapeHtml(data.customerName)}</div>` : ""}
  <div>Date: ${escapeHtml(data.dateLabel)}</div>
  <hr />
  <table>
    <thead>
      <tr><th>Item</th><th class="qty">Qty</th><th class="rate">Rate</th><th class="total">Amt</th></tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <hr />
  <table class="totals">
    <tr><td class="label">Subtotal</td><td class="value">${rupee(data.subtotal)}</td></tr>
    ${data.discountAmount > 0 ? `<tr><td class="label">Discount${data.discountReason ? ` (${escapeHtml(data.discountReason)})` : ""}</td><td class="value">-${rupee(data.discountAmount)}</td></tr>` : ""}
    <tr><td class="label">CGST</td><td class="value">${rupee(data.cgst)}</td></tr>
    <tr><td class="label">SGST</td><td class="value">${rupee(data.sgst)}</td></tr>
    <tr><td class="label">Service Charge</td><td class="value">${rupee(data.serviceCharge)}</td></tr>
    <tr><td class="label">Round Off</td><td class="value">${rupee(data.roundOff)}</td></tr>
  </table>
  <hr />
  <table class="totals">
    <tr class="grand"><td class="label">Grand Total</td><td class="value">${rupee(data.grandTotal)}</td></tr>
  </table>
  <hr />
  <div>Payment Method: ${escapeHtml(data.paymentMethod)}</div>
  <div>Txn ID: ${escapeHtml(data.transactionId)}</div>
  <div class="center footer">
    <div>${escapeHtml(data.footer)}</div>
    <div class="muted">Receipt No: ${escapeHtml(data.receiptNumber)}</div>
    <div class="muted">Powered by Saffra — Restaurant Operating System</div>
  </div>
</body>
</html>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
