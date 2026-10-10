import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, KeyRound, UserX, UserCheck } from "lucide-react";
import { Button, Card, DataTable, EmptyState, Input, Select, Modal, StatusPill, toast, type Column } from "@saffra/ui";
import { ROLES, type Role } from "@saffra/types";
import { staffApi, type StaffDTO } from "../api/staff.js";
import { PageHeader } from "../components/PageHeader.js";
import { ApiError } from "../api/client.js";

export function StaffPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const { data: staff, isLoading } = useQuery({ queryKey: ["staff"], queryFn: staffApi.list });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["staff"] });

  const toggleActive = useMutation({
    mutationFn: (s: StaffDTO) => staffApi.update(s.id, { active: !s.active }),
    onSuccess: () => {
      invalidate();
      toast.success("Staff status updated");
    },
  });

  const columns: Column<StaffDTO>[] = [
    {
      key: "name",
      header: "Employee",
      render: (s) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-secondary font-display text-xs font-bold text-white">
            {s.name.charAt(0)}
          </div>
          <div>
            <p className="font-medium text-primary">{s.name}</p>
            <p className="text-xs text-muted">{s.employeeId}</p>
          </div>
        </div>
      ),
    },
    { key: "role", header: "Role", render: (s) => <StatusPill tone="info">{s.role}</StatusPill> },
    { key: "phone", header: "Phone", render: (s) => s.phone ?? "—" },
    { key: "email", header: "Email", render: (s) => s.email ?? "—" },
    { key: "joined", header: "Joined", render: (s) => new Date(s.joiningDate).toLocaleDateString("en-IN") },
    {
      key: "status",
      header: "Status",
      render: (s) => <StatusPill tone={s.active ? "success" : "neutral"}>{s.active ? "Active" : "Inactive"}</StatusPill>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (s) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => setResettingId(s.id)} className="rounded-lg p-1.5 text-muted hover:bg-bg hover:text-primary" title="Reset password">
            <KeyRound className="h-4 w-4" />
          </button>
          <button
            onClick={() => toggleActive.mutate(s)}
            className="rounded-lg p-1.5 text-muted hover:bg-bg hover:text-primary"
            title={s.active ? "Deactivate" : "Activate"}
          >
            {s.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div data-tour-target="staff" className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        eyebrow="Team"
        title="Staff"
        description={`${staff?.length ?? 0} team members`}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Add Staff
          </Button>
        }
      />

      <Card className="mt-5">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted">Loading staff…</div>
        ) : (
          <DataTable
            columns={columns}
            data={staff ?? []}
            keyField={(s) => s.id}
            emptyState={<EmptyState title="No staff yet" description="Add your first team member." />}
          />
        )}
      </Card>

      <Modal open={creating} onClose={() => setCreating(false)} title="Add Staff Member">
        <StaffForm onDone={() => { invalidate(); setCreating(false); }} />
      </Modal>

      <Modal open={!!resettingId} onClose={() => setResettingId(null)} title="Reset Password" size="sm">
        {resettingId && <ResetPasswordForm staffId={resettingId} onDone={() => setResettingId(null)} />}
      </Modal>
    </div>
  );
}

function StaffForm({ onDone }: { onDone: () => void }) {
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("WAITER");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await staffApi.create({ employeeId, name, role, phone, email, password: "password123" });
      toast.success("Staff member added", "Default password: password123");
      onDone();
    } catch (err) {
      toast.error("Couldn't add staff", err instanceof ApiError ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Employee ID" value={employeeId} onChange={(e) => setEmployeeId(e.target.value.toUpperCase())} required />
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </div>
      <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Button type="submit" fullWidth loading={saving}>
        Add Staff Member
      </Button>
    </form>
  );
}

function ResetPasswordForm({ staffId, onDone }: { staffId: string; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await staffApi.resetPassword(staffId, password);
      toast.success("Password reset");
      onDone();
    } catch (err) {
      toast.error("Couldn't reset password", err instanceof ApiError ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
      <Button type="submit" fullWidth loading={saving}>
        Reset Password
      </Button>
    </form>
  );
}
