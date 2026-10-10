export type ToastTone = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l(toasts));
}

function push(tone: ToastTone, title: string, description?: string) {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, tone, title, description }];
  notify();
  setTimeout(() => dismiss(id), 4500);
  return id;
}

function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => listeners.delete(listener);
}

export const toast = {
  success: (title: string, description?: string) => push("success", title, description),
  error: (title: string, description?: string) => push("error", title, description),
  info: (title: string, description?: string) => push("info", title, description),
  warning: (title: string, description?: string) => push("warning", title, description),
  dismiss,
};
