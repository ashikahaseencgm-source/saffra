import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Smartphone, Wifi } from "lucide-react";
import { Button, Input, toast } from "@saffra/ui";
import { setupApi } from "../../api/setup.js";
import { settingsApi } from "../../api/settings.js";
import { ApiError } from "../../api/client.js";
import { QrCode } from "../QrCode.js";

function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Couldn't copy"),
  );
}

/**
 * Tells staff how to open Saffra on their own phone/tablet: scan the QR (works
 * on every phone), or type the restaurant-name address (easy to remember).
 */
export function ConnectDevicesCard({ canEditName }: { canEditName: boolean }) {
  const queryClient = useQueryClient();
  const { data: info } = useQuery({ queryKey: ["setup", "network-info"], queryFn: setupApi.networkInfo });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  const saveName = useMutation({
    mutationFn: (localHostname: string | null) => settingsApi.update({ localHostname }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["setup", "network-info"] });
      setEditing(false);
      toast.success("Wi-Fi address updated");
    },
    onError: (err) => toast.error("Couldn't change the address", err instanceof ApiError ? err.message : undefined),
  });

  if (!info) return <div className="h-40 animate-pulse rounded-xl bg-bg" />;

  if (!info.ipUrl) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
        <Wifi className="h-7 w-7 shrink-0 text-warning" />
        <p className="text-sm text-primary">
          This computer isn't connected to a Wi-Fi or network right now. Connect it to the restaurant's Wi-Fi, and the
          address for phones and tablets will appear here.
        </p>
      </div>
    );
  }

  const nameError =
    name && !/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(name)
      ? "Use only letters, numbers and dashes, up to 40 characters, not starting or ending with a dash."
      : undefined;

  function submitName(e: FormEvent) {
    e.preventDefault();
    if (nameError) return;
    saveName.mutate(name.trim() || null);
  }

  return (
    <div className="flex flex-col gap-5 sm:flex-row">
      <div className="flex shrink-0 flex-col items-center gap-2 rounded-xl border border-borderc bg-white p-3">
        <QrCode value={info.ipUrl} size={168} title="QR code to open Saffra on a phone" />
        <p className="text-center text-xs font-medium text-muted">Scan with the phone's camera</p>
      </div>

      <div className="min-w-0 flex-1 space-y-4">
        <ol className="space-y-1.5 text-sm text-primary">
          <li className="flex gap-2">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
            <span>Connect the phone or tablet to the restaurant's Wi-Fi.</span>
          </li>
          <li className="flex gap-2">
            <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
            <span>Scan the QR code, or type this address in the browser:</span>
          </li>
        </ol>

        {info.nameUrl && (
          <AddressRow label="Easy address" url={info.nameUrl} big />
        )}
        <AddressRow label={info.nameUrl ? "If the easy address doesn't open (some older Android phones)" : "Address"} url={info.ipUrl} />

        {canEditName && info.nameUrl && (
          editing ? (
            <form onSubmit={submitName} className="flex flex-wrap items-end gap-2">
              <Input
                wrapperClassName="min-w-[200px] flex-1"
                label="Name in the address"
                placeholder={settings?.restaurant.effectiveLocalHostname}
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                trailing={<span className="text-xs text-muted">.local</span>}
                error={nameError}
              />
              <Button type="submit" loading={saveName.isPending} disabled={!!nameError}>
                Save
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <p className="w-full text-xs text-muted">
                Letters, numbers and dashes only. Leave empty to use the restaurant name. Phones that already use the
                old address will need the new one.
              </p>
            </form>
          ) : (
            <button
              onClick={() => {
                setName(settings?.restaurant.localHostname ?? "");
                setEditing(true);
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-secondary hover:underline"
            >
              <Pencil className="h-3.5 w-3.5" /> Change the name in the address
            </button>
          )
        )}
      </div>
    </div>
  );
}

function AddressRow({ label, url, big }: { label: string; url: string; big?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted">{label}</p>
      <div className="flex items-center gap-2 rounded-xl border border-borderc bg-bg px-3 py-2">
        <span className={big ? "min-w-0 flex-1 truncate font-display text-lg font-bold text-primary" : "min-w-0 flex-1 truncate font-mono text-sm text-primary"}>
          {url}
        </span>
        <button
          onClick={() => copy(url)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-borderc bg-white text-muted hover:text-primary"
          aria-label={`Copy ${url}`}
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
