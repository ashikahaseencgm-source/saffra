import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, UtensilsCrossed } from "lucide-react";
import { Button, Card, DataTable, EmptyState, Input, Select, Modal, toast, cn, type Column } from "@saffra/ui";
import type { FoodType, MenuItemDTO } from "@saffra/types";
import { FOOD_TYPES } from "@saffra/types";
import { menuApi } from "../api/menu.js";
import { PageHeader } from "../components/PageHeader.js";
import { ApiError } from "../api/client.js";

export function MenuManagementPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<MenuItemDTO | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: items, isLoading } = useQuery({ queryKey: ["menu", "items", "all"], queryFn: () => menuApi.list({}) });
  const { data: categories } = useQuery({ queryKey: ["menu", "categories"], queryFn: menuApi.categories });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["menu"] });

  const toggleAvailable = useMutation({
    mutationFn: (item: MenuItemDTO) => menuApi.update(item.id, { available: !item.available }),
    onSuccess: invalidate,
  });

  const removeItem = useMutation({
    mutationFn: (id: string) => menuApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success("Menu item removed");
    },
  });

  const columns: Column<MenuItemDTO>[] = [
    {
      key: "name",
      header: "Item",
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg text-muted">
            <UtensilsCrossed className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium text-primary">{item.name}</p>
            <p className="text-xs text-muted">{item.categoryName}</p>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (item) => (
        <span className={cn("text-xs font-semibold", item.foodType === "VEG" ? "text-success" : "text-danger")}>
          {item.foodType.replace("_", "-")}
        </span>
      ),
    },
    { key: "price", header: "Price", align: "right", render: (item) => `₹${item.price}` },
    {
      key: "available",
      header: "Available",
      align: "center",
      render: (item) => (
        <button
          onClick={() => toggleAvailable.mutate(item)}
          className={cn("h-5 w-9 rounded-full transition-colors", item.available ? "bg-success" : "bg-borderc")}
        >
          <span className={cn("block h-4 w-4 translate-x-0.5 rounded-full bg-white transition-transform", item.available && "translate-x-4")} />
        </button>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (item) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => setEditing(item)} className="rounded-lg p-1.5 text-muted hover:bg-bg hover:text-primary">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => removeItem.mutate(item.id)} className="rounded-lg p-1.5 text-muted hover:bg-danger/5 hover:text-danger">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div data-tour-target="menu" className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        eyebrow="Manage"
        title="Menu"
        description={`${items?.length ?? 0} items across ${categories?.length ?? 0} categories`}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        }
      />

      <Card className="mt-5">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted">Loading menu…</div>
        ) : (
          <DataTable
            columns={columns}
            data={items ?? []}
            keyField={(i) => i.id}
            emptyState={<EmptyState title="No menu items yet" description="Add your first dish to get started." />}
          />
        )}
      </Card>

      <Modal open={creating || !!editing} onClose={() => (creating ? setCreating(false) : setEditing(null))} title={editing ? "Edit Item" : "Add Menu Item"}>
        <MenuItemForm
          item={editing}
          categories={categories ?? []}
          onDone={() => {
            invalidate();
            setCreating(false);
            setEditing(null);
          }}
        />
      </Modal>
    </div>
  );
}

function MenuItemForm({
  item,
  categories,
  onDone,
}: {
  item: MenuItemDTO | null;
  categories: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? categories[0]?.id ?? "");
  const [price, setPrice] = useState(String(item?.price ?? ""));
  const [foodType, setFoodType] = useState<FoodType>(item?.foodType ?? "VEG");
  const [featured, setFeatured] = useState(item?.featured ?? false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name, description, categoryId, price: Number(price), foodType, featured, available: true };
      if (item) {
        await menuApi.update(item.id, payload);
        toast.success("Menu item updated");
      } else {
        await menuApi.create(payload);
        toast.success("Menu item added");
      }
      onDone();
    } catch (err) {
      toast.error("Couldn't save item", err instanceof ApiError ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <div>
        <label className="mb-1.5 block text-sm font-medium text-primary">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-borderc p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input label="Price (₹)" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Food type" value={foodType} onChange={(e) => setFoodType(e.target.value as FoodType)}>
          {FOOD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace("_", "-")}
            </option>
          ))}
        </Select>
        <label className="mt-7 flex items-center gap-2 text-sm text-primary">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-4 w-4 rounded border-borderc" />
          Featured item
        </label>
      </div>
      <Button type="submit" fullWidth loading={saving}>
        {item ? "Save Changes" : "Add Item"}
      </Button>
    </form>
  );
}
