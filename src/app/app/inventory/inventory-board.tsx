"use client";

import Image from "next/image";
import type { DragEvent } from "react";
import { useMemo, useState } from "react";
import { PixelGlyph, type PixelGlyphName } from "../_components/icons";
import type { InventoryViewItem } from "@/lib/inventory";

type InventoryColumn = "sell" | "need";

const categoryLabels: Record<InventoryViewItem["category"], string> = {
  harvest: "Harvest",
  seeds: "Seeds",
  starts: "Starts",
  feed: "Feed",
  amendments: "Soil",
  tools: "Tools",
  preserves: "Preserves",
  livestock: "Livestock",
};

const categories = Object.keys(categoryLabels) as InventoryViewItem["category"][];

const statusStyles: Record<InventoryViewItem["status"], string> = {
  stocked: "border-[#9bc278] bg-[#eef8df] text-[#335a2d]",
  low: "border-[#efb16b] bg-[#fff1dc] text-[#7a461f]",
  ready: "border-[#68b8c9] bg-[#e4f7f8] text-[#245c65]",
  curing: "border-[#d38aa0] bg-[#fff0f4] text-[#7a3148]",
};

const statusGlyph: Record<InventoryViewItem["status"], PixelGlyphName> = {
  stocked: "leaf",
  low: "warning",
  ready: "sparkle",
  curing: "jar",
};

const statuses = Object.keys(statusStyles) as InventoryViewItem["status"][];

export function InventoryBoard({ initialItems }: { initialItems: InventoryViewItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const sellableItems = useMemo(
    () => items.filter((item) => ["harvest", "preserves"].includes(item.category)),
    [items],
  );
  const neededItems = useMemo(
    () =>
      items
        .filter((item) => item.status === "low" || !["harvest", "preserves"].includes(item.category))
        .sort((left, right) => Number(right.status === "low") - Number(left.status === "low")),
    [items],
  );

  function updateItem(id: string, patch: Partial<InventoryViewItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item)),
    );
  }

  function updateQuantity(id: string, patch: Partial<InventoryViewItem["quantity"]>) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: { ...item.quantity, ...patch },
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
  }

  function moveItem(id: string, column: InventoryColumn) {
    moveItemInState(id, column);
  }

  function handleDrop(column: InventoryColumn) {
    if (!draggedId) {
      return;
    }

    moveItem(draggedId, column);
    setDraggedId(null);
  }

  function moveItemInState(id: string, column?: InventoryColumn, targetId?: string) {
    setItems((current) => {
      const draggedItem = current.find((item) => item.id === id);

      if (!draggedItem) {
        return current;
      }

      const movedItem = {
        ...draggedItem,
        ...(column === "sell" ? { category: "harvest" as const, status: "ready" as const } : {}),
        ...(column === "need" ? { category: "seeds" as const, status: "low" as const } : {}),
        updatedAt: new Date().toISOString(),
      };
      const remaining = current.filter((item) => item.id !== id);
      const targetIndex = targetId ? remaining.findIndex((item) => item.id === targetId) : -1;
      const insertIndex = targetIndex >= 0 ? targetIndex : remaining.length;

      return [
        ...remaining.slice(0, insertIndex),
        movedItem,
        ...remaining.slice(insertIndex),
      ];
    });
  }

  function handleDropOnItem(column: InventoryColumn, targetId: string) {
    if (!draggedId) {
      return;
    }

    moveItemInState(draggedId, column, targetId);
    setDraggedId(null);
  }

  function handleTableDrop(targetId: string) {
    if (!draggedId) {
      return;
    }

    moveItemInState(draggedId, undefined, targetId);
    setDraggedId(null);
  }

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-2">
        <InventoryColumn
          title="Produce to Sell"
          column="sell"
          items={sellableItems}
          draggedId={draggedId}
          setDraggedId={setDraggedId}
          onDropColumn={handleDrop}
          onDropItem={handleDropOnItem}
          onUpdateItem={updateItem}
          onUpdateQuantity={updateQuantity}
        />
        <InventoryColumn
          title="Need"
          column="need"
          items={neededItems}
          draggedId={draggedId}
          setDraggedId={setDraggedId}
          onDropColumn={handleDrop}
          onDropItem={handleDropOnItem}
          onUpdateItem={updateItem}
          onUpdateQuantity={updateQuantity}
        />
      </div>

      <InventoryTable
        items={items}
        draggedId={draggedId}
        setDraggedId={setDraggedId}
        onDropRow={handleTableDrop}
        onUpdateItem={updateItem}
        onUpdateQuantity={updateQuantity}
      />
    </>
  );
}

function InventoryColumn({
  title,
  column,
  items,
  draggedId,
  setDraggedId,
  onDropColumn,
  onDropItem,
  onUpdateItem,
  onUpdateQuantity,
}: {
  title: string;
  column: InventoryColumn;
  items: InventoryViewItem[];
  draggedId: string | null;
  setDraggedId: (id: string | null) => void;
  onDropColumn: (column: InventoryColumn) => void;
  onDropItem: (column: InventoryColumn, targetId: string) => void;
  onUpdateItem: (id: string, patch: Partial<InventoryViewItem>) => void;
  onUpdateQuantity: (id: string, patch: Partial<InventoryViewItem["quantity"]>) => void;
}) {
  const isSell = column === "sell";
  const headingClass = isSell
    ? "pixel-gradient-sell text-[#1f4f57]"
    : "pixel-gradient-need text-[#6f3f1c]";
  const subtitle = isSell ? "Pack the wagon for market day." : "Restock before the next sunrise.";

  return (
    <section
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDropColumn(column)}
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className={`pixel-frame overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fffaf0] transition ${
        draggedId ? "outline outline-2 outline-offset-2 outline-[#e8d690]" : ""
      }`}
    >
      <div className={`relative flex items-center gap-2 border-b-2 border-[#a8916a] px-3 py-2 ${headingClass}`}>
        <span className="grid size-7 place-items-center rounded-md border-2 border-[#8b6f3e] bg-[#fffdf5] text-[#5e4a26] shadow-[0_1px_0_#5e4a26]">
          <PixelGlyph name={isSell ? "wagon" : "basket"} className="size-4" />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="font-mono text-sm font-black uppercase tracking-[0.14em] drop-shadow-[1px_1px_0_rgba(255,253,245,0.6)]">
            {title}
          </div>
          <div className="text-[10px] font-medium opacity-80">{subtitle}</div>
        </div>
        <span className="ml-auto rounded-md border-2 border-[#8b6f3e] bg-[#fffdf5] px-2 py-0.5 font-mono text-xs font-bold text-[#5e4a26] shadow-[0_1px_0_#5e4a26]">
          {items.length}
        </span>
      </div>
      <div className="grid gap-1.5 bg-[#fcf6e4] p-2">
        {items.length === 0 ? (
          <div className="grid place-items-center rounded-md border-2 border-dashed border-[#d4c39a] bg-[#fffdf5] py-6 text-center text-xs text-[#9a8a66]">
            <PixelGlyph name="wheat" className="mb-1 size-6 text-[#c9a64a]" />
            <span className="font-mono uppercase tracking-[0.1em]">
              {isSell ? "Nothing to ship yet" : "All stocked up"}
            </span>
          </div>
        ) : null}
        {items.map((item) => (
          <InventoryCard
            key={item.id}
            item={item}
            sellMode={column === "sell"}
            setDraggedId={setDraggedId}
            onDropItem={() => onDropItem(column, item.id)}
            onUpdateItem={onUpdateItem}
            onUpdateQuantity={onUpdateQuantity}
          />
        ))}
      </div>
    </section>
  );
}

function InventoryCard({
  item,
  sellMode,
  setDraggedId,
  onDropItem,
  onUpdateItem,
  onUpdateQuantity,
}: {
  item: InventoryViewItem;
  sellMode: boolean;
  setDraggedId: (id: string | null) => void;
  onDropItem: () => void;
  onUpdateItem: (id: string, patch: Partial<InventoryViewItem>) => void;
  onUpdateQuantity: (id: string, patch: Partial<InventoryViewItem["quantity"]>) => void;
}) {
  function handleDragStart(event: DragEvent<HTMLElement>) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.id);
    setDraggedId(item.id);
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => setDraggedId(null)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDropItem();
      }}
      style={{ ["--pixel-frame-bg" as string]: "#fcf6e4" }}
      className="pixel-frame group grid cursor-grab grid-cols-[auto_auto_1fr_auto] items-center gap-2 rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] px-2 py-1.5 shadow-[0_2px_0_#b29c66] transition hover:-translate-y-0.5 hover:border-[#a78c52] hover:shadow-[0_3px_0_#8b6f3e] active:cursor-grabbing"
    >
      <button
        type="button"
        aria-label={`Drag ${item.name}`}
        className="grid size-7 place-items-center rounded-md border-2 border-[#c9b88a] bg-[#fff8dc] font-mono text-xs font-black leading-none text-[#7a6843] shadow-[0_1px_0_#8b6f3e]"
      >
        ::
      </button>
      <InventoryToken item={item} compact />
      <div className="min-w-0">
        <input
          aria-label={`${item.name} name`}
          value={item.name}
          onChange={(event) => onUpdateItem(item.id, { name: event.target.value })}
          className="h-7 w-full rounded-md border border-transparent bg-transparent px-1 text-sm font-bold text-[#2d311f] outline-none hover:border-[#e1d5b9] focus:border-[#9bb979] focus:bg-white"
        />
        <div className="flex flex-wrap items-center gap-1">
          <span className={`inline-flex items-center gap-1 rounded-md border-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusStyles[item.status]}`}>
            <PixelGlyph name={statusGlyph[item.status]} className="size-3" />
            <span>{item.status}</span>
          </span>
          <select
            aria-label={`${item.name} category`}
            value={item.category}
            onChange={(event) =>
              onUpdateItem(item.id, { category: event.target.value as InventoryViewItem["category"] })
            }
            className="h-6 min-w-0 rounded-md border border-[#c9b88a] bg-[#fffaf0] px-1 text-[10px] font-semibold uppercase tracking-wide text-[#5f563f]"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {categoryLabels[category]}
              </option>
            ))}
          </select>
          <select
            aria-label={`${item.name} status`}
            value={item.status}
            onChange={(event) => onUpdateItem(item.id, { status: event.target.value as InventoryViewItem["status"] })}
            className="h-6 rounded-md border border-[#c9b88a] bg-[#fffaf0] px-1 text-[10px] font-semibold uppercase tracking-wide text-[#5f563f]"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid w-[100px] gap-1 text-right">
        {sellMode ? (
          <span className="ml-auto grid size-6 place-items-center rounded-md border-2 border-[#7eb3bd] bg-[#e4f7f8] text-[#245c65] shadow-[0_1px_0_#5e8a91]">
            <PixelGlyph name="wagon" className="size-3.5" />
          </span>
        ) : null}
        <div className="grid grid-cols-[1fr_44px] gap-1 rounded-md border-2 border-[#c9b88a] bg-[#fff8dc] p-0.5 shadow-[inset_0_-2px_0_rgba(95,80,43,0.12)]">
          <input
            aria-label={`${item.name} amount`}
            type="number"
            value={item.quantity.amount}
            onChange={(event) => onUpdateQuantity(item.id, { amount: Number(event.target.value) })}
            className="h-6 min-w-0 rounded border border-transparent bg-transparent px-1 text-right font-mono text-xs font-bold text-[#365833] focus:border-[#9bb979] focus:bg-white"
          />
          <input
            aria-label={`${item.name} unit`}
            value={item.quantity.unit}
            onChange={(event) => onUpdateQuantity(item.id, { unit: event.target.value })}
            className="h-6 min-w-0 rounded border border-transparent bg-transparent px-1 font-mono text-xs font-bold text-[#5e4a26] focus:border-[#9bb979] focus:bg-white"
          />
        </div>
      </div>
    </div>
  );
}

function InventoryTable({
  items,
  draggedId,
  setDraggedId,
  onDropRow,
  onUpdateItem,
  onUpdateQuantity,
}: {
  items: InventoryViewItem[];
  draggedId: string | null;
  setDraggedId: (id: string | null) => void;
  onDropRow: (targetId: string) => void;
  onUpdateItem: (id: string, patch: Partial<InventoryViewItem>) => void;
  onUpdateQuantity: (id: string, patch: Partial<InventoryViewItem["quantity"]>) => void;
}) {
  function handleDragStart(event: DragEvent<HTMLElement>, id: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
    setDraggedId(id);
  }

  return (
    <section
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame min-w-0 overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
    >
      <div className="pixel-gradient-wood flex items-center gap-2 border-b-2 border-[#a8916a] px-3 py-2">
        <span className="grid size-7 place-items-center rounded-md border-2 border-[#8b6f3e] bg-[#fffdf5] text-[#5e4a26] shadow-[0_1px_0_#5e4a26]">
          <PixelGlyph name="ledger" className="size-4" />
        </span>
        <span className="font-mono text-sm font-black uppercase tracking-[0.16em] text-[#5e4a26] drop-shadow-[1px_1px_0_rgba(255,253,245,0.6)]">
          Pantry Ledger
        </span>
        <span className="ml-auto rounded-md border-2 border-[#8b6f3e] bg-[#fffdf5] px-2 py-0.5 font-mono text-xs font-bold text-[#5e4a26] shadow-[0_1px_0_#5e4a26]">
          {items.length} items
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-[#c9b88a] bg-[#edf5df] text-xs font-bold uppercase tracking-[0.08em] text-[#526b3c]">
              <th className="w-[260px] px-3 py-2">Item</th>
              <th className="w-[90px] px-3 py-2">Amount</th>
              <th className="w-[80px] px-3 py-2">Unit</th>
              <th className="w-[120px] px-3 py-2">Type</th>
              <th className="w-[105px] px-3 py-2">Status</th>
              <th className="w-[155px] px-3 py-2">Location</th>
              <th className="w-[135px] px-3 py-2">Source</th>
              <th className="px-3 py-2">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eadfca] [&>tr:nth-child(even)]:bg-[#fdf8e4]">
            {items.map((item) => (
              <tr
                key={item.id}
                draggable
                onDragStart={(event) => handleDragStart(event, item.id)}
                onDragEnd={() => setDraggedId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  onDropRow(item.id);
                }}
                className={`cursor-grab bg-[#fffdf5] transition hover:bg-[#fff7df] active:cursor-grabbing ${
                  draggedId === item.id ? "opacity-55" : ""
                }`}
              >
                <td className="px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Drag ${item.name} row`}
                      className="grid size-7 shrink-0 place-items-center rounded-md border-2 border-[#c9b88a] bg-[#fff8dc] font-mono text-xs font-black leading-none text-[#7a6843] shadow-[0_1px_0_#8b6f3e]"
                    >
                      ::
                    </button>
                    <InventoryToken item={item} compact />
                    <input
                      aria-label={`${item.name} table name`}
                      value={item.name}
                      onChange={(event) => onUpdateItem(item.id, { name: event.target.value })}
                      className="h-8 min-w-0 flex-1 rounded border border-[#eadfca] bg-white px-2 text-sm font-bold text-[#2d311f]"
                    />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`${item.name} table amount`}
                    type="number"
                    value={item.quantity.amount}
                    onChange={(event) => onUpdateQuantity(item.id, { amount: Number(event.target.value) })}
                    className="h-8 w-full rounded border border-[#eadfca] bg-white px-2 text-right font-mono text-sm font-semibold text-[#365833]"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`${item.name} table unit`}
                    value={item.quantity.unit}
                    onChange={(event) => onUpdateQuantity(item.id, { unit: event.target.value })}
                    className="h-8 w-full rounded border border-[#eadfca] bg-white px-2 font-mono text-sm font-semibold text-[#365833]"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    aria-label={`${item.name} table category`}
                    value={item.category}
                    onChange={(event) =>
                      onUpdateItem(item.id, { category: event.target.value as InventoryViewItem["category"] })
                    }
                    className="h-8 w-full rounded border border-[#eadfca] bg-white px-2 text-sm text-[#5f563f]"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {categoryLabels[category]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    aria-label={`${item.name} table status`}
                    value={item.status}
                    onChange={(event) =>
                      onUpdateItem(item.id, { status: event.target.value as InventoryViewItem["status"] })
                    }
                    className="h-8 w-full rounded border border-[#eadfca] bg-white px-2 text-sm text-[#5f563f]"
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
                <EditableTextCell item={item} field="location" onUpdateItem={onUpdateItem} />
                <EditableTextCell item={item} field="source" onUpdateItem={onUpdateItem} />
                <EditableTextCell item={item} field="notes" onUpdateItem={onUpdateItem} wide />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EditableTextCell({
  item,
  field,
  wide = false,
  onUpdateItem,
}: {
  item: InventoryViewItem;
  field: "location" | "source" | "notes";
  wide?: boolean;
  onUpdateItem: (id: string, patch: Partial<InventoryViewItem>) => void;
}) {
  return (
    <td className="px-3 py-2">
      <input
        aria-label={`${item.name} ${field}`}
        value={item[field]}
        onChange={(event) => onUpdateItem(item.id, { [field]: event.target.value })}
        className={`h-8 rounded border border-[#eadfca] bg-white px-2 text-sm text-[#5f563f] ${
          wide ? "w-full min-w-[220px]" : "w-full"
        }`}
      />
    </td>
  );
}

function InventoryToken({ item, compact = false }: { item: InventoryViewItem; compact?: boolean }) {
  const size = compact ? 32 : 40;

  return (
    <span
      className={`grid shrink-0 place-items-center rounded-md border-2 border-[#8b6f3e] shadow-[inset_0_2px_0_rgba(255,255,255,0.55),inset_0_-4px_0_rgba(95,80,43,0.22),0_2px_0_#5e4a26] ${
        compact ? "size-9" : "size-11"
      }`}
      style={{ backgroundColor: item.color || "#fff8dc" }}
    >
      <Image
        src={iconForItem(item)}
        alt={`${item.name} icon`}
        width={16}
        height={16}
        className={compact ? "size-5" : "size-7"}
        style={{ imageRendering: "pixelated", width: size * 0.65, height: size * 0.65 }}
        unoptimized
      />
    </span>
  );
}

function iconForItem(item: InventoryViewItem) {
  const name = item.name.toLowerCase();

  if (name.includes("tomato")) {
    return "/inventory-icons/tomato.png";
  }

  if (name.includes("lettuce")) {
    return "/inventory-icons/lettuce.png";
  }

  if (name.includes("corn") || item.category === "seeds" || item.category === "feed") {
    return "/inventory-icons/corn.png";
  }

  if (name.includes("jam") || name.includes("strawberry") || item.category === "preserves") {
    return "/inventory-icons/strawberry.png";
  }

  if (name.includes("basil") || name.includes("herb") || item.category === "starts") {
    return "/inventory-icons/pea-pod.png";
  }

  if (item.category === "amendments") {
    return "/inventory-icons/mushroom.png";
  }

  if (item.category === "livestock") {
    return "/inventory-icons/egg.png";
  }

  if (item.category === "tools") {
    return "/inventory-icons/hammer.png";
  }

  return "/inventory-icons/potato.png";
}
