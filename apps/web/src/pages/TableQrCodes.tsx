import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer, RefreshCw, Wifi } from "lucide-react";
import { Button, Input, Modal, toast } from "@saffra/ui";
import { PageHeader } from "../components/PageHeader.js";
import { QrCode } from "../components/QrCode.js";
import { guestRequestsApi, type TableQrCode } from "../api/guest.js";
import { setupApi } from "../api/setup.js";
import { settingsApi } from "../api/settings.js";
import { ApiError } from "../api/client.js";

/**
 * One printable card per table. Guests scan it with their phone camera to
 * see the menu and order; the order waits for a waiter to confirm it.
 */
export function TableQrCodesPage() {
  const queryClient = useQueryClient();
  const { data: codes, isLoading } = useQuery({ queryKey: ["table-qr-codes"], queryFn: guestRequestsApi.tableQrCodes });
  const { data: network } = useQuery({ queryKey: ["setup", "network-info"], queryFn: setupApi.networkInfo });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });
  const [useNameAddress, setUseNameAddress] = useState(false);
  const [wifiName, setWifiName] = useState(() => localStorage.getItem("saffra.qr.wifi") ?? "");
  const [confirmReset, setConfirmReset] = useState<TableQrCode | null>(null);

  const regenerate = useMutation({
    mutationFn: (tableId: string) => guestRequestsApi.regenerateQr(tableId),
    onSuccess: (code) => {
      queryClient.invalidateQueries({ queryKey: ["table-qr-codes"] });
      setConfirmReset(null);
      toast.success(`New code for Table ${code.number}`, "Print it and replace the old card.");
    },
    onError: (err) => toast.error("Couldn't make a new code", err instanceof ApiError ? err.message : undefined),
  });

  const base = (useNameAddress ? network?.nameUrl : null) ?? network?.ipUrl ?? window.location.origin;
  const restaurantName = settings?.restaurant.name ?? "";

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="print:hidden">
        <PageHeader
          eyebrow="Guest ordering"
          title="Table QR codes"
          description="Print these and place one on each table. Guests scan it to see the menu and send their order — a waiter confirms it before it goes to the kitchen."
          actions={
            <Button size="lg" onClick={() => window.print()} disabled={!codes?.length}>
              <Printer className="h-4 w-4" /> Print all cards
            </Button>
          }
        />

        <div className="mt-6 grid gap-4 rounded-card border border-borderc bg-white p-5 shadow-card md:grid-cols-2">
          <Input
            label="Wi-Fi name to print on the cards (optional)"
            placeholder="e.g. SpiceGarden-Guest"
            value={wifiName}
            onChange={(e) => {
              setWifiName(e.target.value);
              try {
                localStorage.setItem("saffra.qr.wifi", e.target.value);
              } catch {
                /* ignore */
              }
            }}
          />
          <div className="text-sm text-muted">
            <p className="font-medium text-primary">Guests' phones must be on the restaurant's Wi-Fi.</p>
            <p className="mt-1">
              The codes open <span className="font-mono text-primary">{base}</span>. If this computer's address changes (for example after
              the router restarts), print the cards again — or ask your network technician to reserve this computer's address.
            </p>
            {network?.nameUrl && (
              <label className="mt-2 flex items-center gap-2 font-medium text-primary">
                <input type="checkbox" checked={useNameAddress} onChange={(e) => setUseNameAddress(e.target.checked)} />
                Use the name address ({network.hostname}) — doesn't change, but some older Android phones can't open it
              </label>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-10 text-center text-sm text-muted">Preparing codes…</p>
      ) : (
        <div id="qr-print-area" className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 print:mt-0 print:grid-cols-3 print:gap-3">
          {codes?.map((code) => (
            <div key={code.tableId} className="qr-card flex flex-col items-center rounded-2xl border-2 border-primary bg-white px-5 pb-5 pt-4 text-center print:rounded-xl">
              <p className="font-display text-sm font-semibold text-muted">{restaurantName}</p>
              <p className="mt-0.5 font-display text-3xl font-extrabold text-primary">Table {code.number}</p>
              <QrCode value={`${base}/t/${code.qrToken}`} size={190} className="mt-3" title={`QR code to order from table ${code.number}`} />
              <p className="mt-3 text-base font-bold text-primary">Scan to see the menu & order</p>
              <p className="text-xs text-muted">Point your phone camera at the code</p>
              {wifiName && (
                <p className="mt-2 flex items-center gap-1 rounded-full bg-bg px-3 py-1 text-xs font-semibold text-primary">
                  <Wifi className="h-3.5 w-3.5" /> Wi-Fi: {wifiName}
                </p>
              )}
              <button
                onClick={() => setConfirmReset(code)}
                className="mt-3 flex items-center gap-1 text-xs font-medium text-muted hover:text-primary print:hidden"
              >
                <RefreshCw className="h-3 w-3" /> New code for this table
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!confirmReset}
        onClose={() => setConfirmReset(null)}
        title={`Make a new code for Table ${confirmReset?.number}?`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmReset(null)}>
              Keep the current code
            </Button>
            <Button variant="danger" loading={regenerate.isPending} onClick={() => confirmReset && regenerate.mutate(confirmReset.tableId)}>
              Make new code
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          The printed card on this table will stop working immediately. Use this if a card was taken or copied, then print and place
          the new one.
        </p>
      </Modal>
    </div>
  );
}
