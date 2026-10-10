import { api } from "./client.js";

export const receiptsApi = {
  html: (orderId: string) => api.get<string>(`/receipts/${orderId}/html`, { responseType: "text" }),
  pdfBlob: (orderId: string) => api.get<Blob>(`/receipts/${orderId}/pdf`, { responseType: "blob" }),
  reprint: (orderId: string) => api.post<void>(`/receipts/${orderId}/reprint`),
};
