import PDFDocument from "pdfkit";
import type { ReceiptData } from "./receiptTypes.js";

const WIDTH_PT = 227; // ~80mm
const MARGIN = 12;

/**
 * Draws the same receipt content as receiptHtml.ts but as a real PDF via
 * pdfkit (no headless-browser dependency, keeps the Docker image small).
 */
export function renderReceiptPdfBuffer(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [WIDTH_PT, 900], margin: MARGIN, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const contentWidth = WIDTH_PT - MARGIN * 2;
    const rupee = (n: number) => `Rs. ${n.toFixed(2)}`;

    doc.font("Courier-Bold").fontSize(13).text(data.restaurantName, { align: "center" });
    doc.font("Courier").fontSize(8);
    if (data.address) doc.text(data.address, { align: "center" });
    if (data.gstin) doc.text(`GSTIN: ${data.gstin}`, { align: "center" });
    if (data.phone) doc.text(`Ph: ${data.phone}`, { align: "center" });

    dashedLine(doc, contentWidth);
    doc.fontSize(8);
    doc.text(`Order #: ${data.orderNumber}`);
    doc.text(`Table: ${data.tableLabel}`);
    doc.text(`Waiter: ${data.waiterName}`);
    if (data.customerName) doc.text(`Customer: ${data.customerName}`);
    doc.text(`Date: ${data.dateLabel}`);
    dashedLine(doc, contentWidth);

    for (const item of data.items) {
      const line = `${item.quantity} x ${item.name}`;
      doc.text(line, { continued: false, width: contentWidth });
      doc.text(`${item.rate.toFixed(2)} each`.padStart(20), { align: "right" });
      doc.text(rupee(item.total), { align: "right" });
    }
    dashedLine(doc, contentWidth);

    row(doc, "Subtotal", rupee(data.subtotal));
    if (data.discountAmount > 0) {
      row(doc, `Discount${data.discountReason ? ` (${data.discountReason})` : ""}`, `-${rupee(data.discountAmount)}`);
    }
    row(doc, "CGST", rupee(data.cgst));
    row(doc, "SGST", rupee(data.sgst));
    row(doc, "Service Charge", rupee(data.serviceCharge));
    row(doc, "Round Off", rupee(data.roundOff));
    dashedLine(doc, contentWidth);

    doc.font("Courier-Bold").fontSize(10);
    row(doc, "Grand Total", rupee(data.grandTotal));
    doc.font("Courier").fontSize(8);
    dashedLine(doc, contentWidth);

    doc.text(`Payment Method: ${data.paymentMethod}`);
    doc.text(`Txn ID: ${data.transactionId}`);
    doc.moveDown(0.5);
    doc.text(data.footer, { align: "center" });
    doc.text(`Receipt No: ${data.receiptNumber}`, { align: "center" });
    doc.text("Powered by Saffra", { align: "center" });

    doc.end();
  });
}

function dashedLine(doc: PDFKit.PDFDocument, width: number) {
  doc.moveDown(0.3);
  doc.text("-".repeat(Math.floor(width / 3.2)));
  doc.moveDown(0.3);
}

function row(doc: PDFKit.PDFDocument, label: string, value: string) {
  const y = doc.y;
  doc.text(label, { continued: true });
  doc.text(value, { align: "right" });
  void y;
}
