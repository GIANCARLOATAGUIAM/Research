"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

import type { IssuableMedicine } from "../queries";

type Row = { key: number; medicineId: string; quantity: string };

// Repeatable "medicine + quantity" rows inside a visit or incident form.
// Rows are controlled so they survive the form reset after a failed save.
// Sent as repeated medicine_id / quantity fields.
export function MedicationRows({ medicines }: { medicines: IssuableMedicine[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [next, setNext] = useState(1);

  const update = (key: number, change: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...change } : r)));

  return (
    <fieldset className="grid gap-3 rounded-lg border bg-card p-4">
      <legend className="px-1 text-sm font-medium">Medication given</legend>
      {medicines.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No medicines are available to issue (active, unexpired, and in stock).
        </p>
      ) : (
        <>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No medication. Add a row if medicine was given.</p>
          ) : (
            <ul className="grid gap-2">
              {rows.map((row, i) => {
                const med = medicines.find((m) => m.id === row.medicineId);
                return (
                  <li key={row.key} className="grid grid-cols-[1fr_6rem_auto] items-end gap-2">
                    <div className="grid gap-1">
                      <label htmlFor={`med-${row.key}`} className="sr-only">
                        Medicine {i + 1}
                      </label>
                      <NativeSelect
                        id={`med-${row.key}`}
                        name="medicine_id"
                        value={row.medicineId}
                        onChange={(e) => update(row.key, { medicineId: e.target.value })}
                      >
                        <option value="">Choose medicine…</option>
                        {medicines.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.stock_quantity} {m.unit} left)
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="grid gap-1">
                      <label htmlFor={`qty-${row.key}`} className="sr-only">
                        Quantity {i + 1}
                      </label>
                      <Input
                        id={`qty-${row.key}`}
                        name="quantity"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={med?.stock_quantity}
                        value={row.quantity}
                        onChange={(e) => update(row.key, { quantity: e.target.value })}
                        aria-label={med ? `Quantity in ${med.unit}` : "Quantity"}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove medicine ${i + 1}`}
                      onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                    >
                      <X />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setRows((rs) => [...rs, { key: next, medicineId: "", quantity: "1" }]);
                setNext((n) => n + 1);
              }}
            >
              <Plus />
              Add medicine
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Stock is deducted when you save. If any medicine does not have enough stock, nothing is saved.
          </p>
        </>
      )}
    </fieldset>
  );
}
