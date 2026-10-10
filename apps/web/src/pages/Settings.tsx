import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Input, Button, toast } from "@saffra/ui";
import { settingsApi } from "../api/settings.js";
import { PageHeader } from "../components/PageHeader.js";
import { OnlinePaymentsCard } from "../components/settings/OnlinePaymentsCard.js";
import { ConnectDevicesCard } from "../components/settings/ConnectDevicesCard.js";
import { useAuthStore } from "../store/authStore.js";
import { ApiError } from "../api/client.js";
import { useUiStore } from "../store/uiStore.js";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const setTourOpen = useUiStore((s) => s.setTourOpen);
  const { data: settings, isLoading } = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });
  const role = useAuthStore((s) => s.user?.role);

  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    gstin: "",
    phone: "",
    email: "",
    invoicePrefix: "",
    receiptFooter: "",
  });
  const [tax, setTax] = useState({ cgstPercent: "2.5", sgstPercent: "2.5", serviceChargePercent: "5" });

  useEffect(() => {
    if (!settings) return;
    setForm({
      name: settings.restaurant.name,
      address: settings.restaurant.address ?? "",
      city: settings.restaurant.city ?? "",
      gstin: settings.restaurant.gstin ?? "",
      phone: settings.restaurant.phone ?? "",
      email: settings.restaurant.email ?? "",
      invoicePrefix: settings.restaurant.invoicePrefix,
      receiptFooter: settings.restaurant.receiptFooter,
    });
    setTax({
      cgstPercent: String(settings.taxConfig.cgstPercent),
      sgstPercent: String(settings.taxConfig.sgstPercent),
      serviceChargePercent: String(settings.taxConfig.serviceChargePercent),
    });
  }, [settings]);

  const save = useMutation({
    mutationFn: () =>
      settingsApi.update({
        ...form,
        taxConfig: {
          cgstPercent: Number(tax.cgstPercent),
          sgstPercent: Number(tax.sgstPercent),
          serviceChargePercent: Number(tax.serviceChargePercent),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
    onError: (err) => toast.error("Couldn't save settings", err instanceof ApiError ? err.message : undefined),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  if (isLoading || !settings) {
    return <div className="p-10 text-center text-sm text-muted">Loading settings…</div>;
  }

  return (
    <div data-tour-target="settings" className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader eyebrow="Configure" title="Settings" description="Restaurant details, tax rules, and payment configuration." />

      <div className="mt-6 space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Online Payments (UPI, cards, net banking)</CardTitle>
          </CardHeader>
          <CardContent>
            <OnlinePaymentsCard />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open Saffra on Phones & Tablets</CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectDevicesCard canEditName={role === "ADMIN" || role === "MANAGER"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Help</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 rounded-xl border border-borderc bg-bg p-4">
              <Sparkles className="h-8 w-8 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-primary">Quick Tour</p>
                <p className="text-xs text-muted">A guided walkthrough of Tables, Kitchen, Payments, and Reports.</p>
              </div>
              <Button variant="outline" onClick={() => setTourOpen(true)}>
                Replay Tour
              </Button>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Restaurant Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Input label="Restaurant name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="GSTIN" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
              <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label="Invoice prefix" value={form.invoicePrefix} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })} />
            </CardContent>
          </Card>

          <Card className="mt-5">
            <CardHeader>
              <CardTitle>Tax & Service Charge</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
              <Input label="CGST %" type="number" step="0.1" value={tax.cgstPercent} onChange={(e) => setTax({ ...tax, cgstPercent: e.target.value })} />
              <Input label="SGST %" type="number" step="0.1" value={tax.sgstPercent} onChange={(e) => setTax({ ...tax, sgstPercent: e.target.value })} />
              <Input
                label="Service charge %"
                type="number"
                step="0.1"
                value={tax.serviceChargePercent}
                onChange={(e) => setTax({ ...tax, serviceChargePercent: e.target.value })}
              />
            </CardContent>
          </Card>

          <Card className="mt-5">
            <CardHeader>
              <CardTitle>Receipt</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="mb-1.5 block text-sm font-medium text-primary">Receipt footer message</label>
              <textarea
                value={form.receiptFooter}
                onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
                rows={2}
                className="w-full rounded-xl border border-borderc p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
              />
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="mt-5" loading={save.isPending}>
            <Save className="h-4 w-4" /> Save Settings
          </Button>
        </form>
      </div>
    </div>
  );
}
