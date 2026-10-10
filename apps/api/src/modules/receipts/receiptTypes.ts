export interface ReceiptLineItem {
  name: string;
  quantity: number;
  rate: number;
  total: number;
}

export interface ReceiptData {
  restaurantName: string;
  address: string | null;
  gstin: string | null;
  phone: string | null;
  receiptNumber: string;
  orderNumber: string;
  tableLabel: string;
  waiterName: string;
  customerName: string | null;
  dateLabel: string;
  items: ReceiptLineItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  serviceCharge: number;
  discountAmount: number;
  discountReason: string | null;
  roundOff: number;
  grandTotal: number;
  paymentMethod: string;
  transactionId: string;
  footer: string;
}
