"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { PixelGlyph } from "../_components/icons";
import type { InventoryViewItem } from "@/lib/inventory";
import type { ShopDisplaySlotView, ShopSnapshot } from "@/lib/shop";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ShopBoard({ initialSnapshot }: { initialSnapshot: ShopSnapshot }) {
  const [slots, setSlots] = useState(initialSnapshot.slots);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const hasUserEdited = useRef(false);

  const visibleSlots = useMemo(
    () => slots.filter((slot) => slot.visible).sort((left, right) => left.position - right.position),
    [slots],
  );
  const hiddenSlots = useMemo(
    () => slots.filter((slot) => !slot.visible).sort((left, right) => left.position - right.position),
    [slots],
  );
  const totalDisplayed = visibleSlots.reduce((total, slot) => total + slot.displayAmount, 0);

  useEffect(() => {
    if (!hasUserEdited.current) {
      return;
    }

    setSaveStatus("saving");
    setSaveError(null);
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/shop/display", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slots: slots.map(toSaveSlot) }),
        });
        const data = (await response.json()) as Partial<ShopSnapshot> & { error?: string };

        if (!response.ok || data.error) {
          throw new Error("error" in data ? data.error : "Unable to save shop display");
        }

        if (!Array.isArray(data.slots)) {
          throw new Error("Shop display response was missing slots");
        }

        hasUserEdited.current = false;
        setSlots(data.slots);
        setSaveStatus("saved");
      } catch (error) {
        setSaveStatus("error");
        setSaveError(error instanceof Error ? error.message : "Unable to save shop display");
      }
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [slots]);

  function markEdited() {
    hasUserEdited.current = true;
  }

  function handleDragStart(itemId: string) {
    setDraggedItemId(itemId);
  }

  function handleDropOnShelf(targetItemId?: string) {
    if (!draggedItemId) {
      return;
    }

    markEdited();
    setSlots((current) => reorderSlots(current, draggedItemId, targetItemId, true));
    setDraggedItemId(null);
  }

  function handleDropOnTray() {
    if (!draggedItemId) {
      return;
    }

    markEdited();
    setSlots((current) => reorderSlots(current, draggedItemId, undefined, false));
    setDraggedItemId(null);
  }

  function updateSlot(itemId: string, patch: Partial<ShopDisplaySlotView>) {
    markEdited();
    setSlots((current) =>
      current.map((slot) =>
        slot.inventoryItemId === itemId
          ? normalizeSlot({ ...slot, ...patch })
          : slot,
      ),
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_320px]">
      <section
        style={{ ["--pixel-frame-bg" as string]: "#fbf6e8" }}
        className="pixel-frame overflow-hidden rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] shadow-[0_4px_0_#3b2a14]"
      >
        <div className="pixel-gradient-sky relative overflow-hidden border-b-2 border-[#3b2a14] px-4 pb-7 pt-4">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-3 items-end gap-1 px-3 opacity-75">
            {Array.from({ length: 36 }).map((_, index) => (
              <span
                key={index}
                className="flex-1 bg-[#7da854]"
                style={{ height: `${5 + ((index * 5) % 6)}px` }}
              />
            ))}
          </div>
          <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fff8dc] text-[#e9823a] shadow-[inset_0_2px_0_rgba(255,255,255,0.6),inset_0_-4px_0_rgba(95,80,43,0.22),0_2px_0_#3b2a14]">
                <PixelGlyph name="wagon" className="size-7" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate font-mono text-lg font-black uppercase tracking-[0.18em] text-[#34432b] drop-shadow-[1px_1px_0_#fffdf5]">
                  Farm Stand
                </h1>
                <p className="truncate text-xs font-semibold text-[#5f563f]">
                  {initialSnapshot.displayName}&apos;s market shelf
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={saveStatus} error={saveError} />
              <span className="rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] px-2.5 py-1 font-mono text-[11px] font-black uppercase tracking-[0.1em] text-[#5e4a26] shadow-[0_2px_0_#3b2a14]">
                {visibleSlots.length} displays · {Math.round(totalDisplayed * 10) / 10} units
              </span>
            </div>
          </div>
        </div>

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => handleDropOnShelf()}
          className="pixel-dots min-h-[520px] bg-[#fcf6e4] p-3"
        >
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {visibleSlots.map((slot) => (
              <ShopShelfCard
                key={slot.inventoryItemId}
                slot={slot}
                onDragStart={handleDragStart}
                onDrop={() => handleDropOnShelf(slot.inventoryItemId)}
                onUpdate={updateSlot}
                onHide={() => updateSlot(slot.inventoryItemId, { visible: false })}
              />
            ))}
          </div>
          {!visibleSlots.length ? (
            <div className="grid min-h-64 place-items-center rounded-none border-2 border-dashed border-[#c9b88a] bg-[#fffdf5]/80 text-center">
              <div>
                <PixelGlyph name="basket" className="mx-auto mb-2 size-8 text-[#c9a64a]" />
                <div className="font-mono text-xs font-black uppercase tracking-[0.12em] text-[#7a6843]">
                  Drag produce here
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <aside
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDropOnTray}
        style={{ ["--pixel-frame-bg" as string]: "#fbf6e8" }}
        className="pixel-frame h-fit overflow-hidden rounded-none border-2 border-[#3b2a14] bg-[#fffaf0] shadow-[0_4px_0_#3b2a14]"
      >
        <div className="pixel-gradient-need flex items-center gap-2 border-b-2 border-[#3b2a14] px-3 py-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] text-[#5e4a26] shadow-[0_1px_0_#3b2a14]">
            <PixelGlyph name="basket" className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="font-mono text-sm font-black uppercase tracking-[0.14em] text-[#6f3f1c]">
              Back Stock
            </div>
            <div className="text-[10px] font-semibold text-[#7a6843]">Only produce-to-sell items</div>
          </div>
        </div>
        <div className="grid gap-2 bg-[#fcf6e4] p-2">
          {hiddenSlots.map((slot) => (
            <button
              key={slot.inventoryItemId}
              type="button"
              draggable
              onDragStart={() => handleDragStart(slot.inventoryItemId)}
              onClick={() => updateSlot(slot.inventoryItemId, { visible: true })}
              style={{ ["--pixel-frame-bg" as string]: "#fcf6e4" }}
              className="pixel-frame grid grid-cols-[auto_1fr] items-center gap-2 rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] p-2 text-left shadow-[0_2px_0_#b29c66] transition hover:-translate-y-0.5"
            >
              <ShopToken item={slot.item} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-[#2d311f]">{slot.item.name}</span>
                <span className="block font-mono text-xs font-bold text-[#5e4a26]">
                  {slot.item.quantity.amount} {slot.item.quantity.unit} available
                </span>
              </span>
            </button>
          ))}
          {!hiddenSlots.length ? (
            <div className="rounded-none border-2 border-dashed border-[#d4c39a] bg-[#fffdf5] px-3 py-5 text-center font-mono text-xs font-black uppercase tracking-[0.12em] text-[#9a8a66]">
              All sellables are on display
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function ShopShelfCard({
  slot,
  onDragStart,
  onDrop,
  onUpdate,
  onHide,
}: {
  slot: ShopDisplaySlotView;
  onDragStart: (itemId: string) => void;
  onDrop: () => void;
  onUpdate: (itemId: string, patch: Partial<ShopDisplaySlotView>) => void;
  onHide: () => void;
}) {
  return (
    <article
      draggable
      onDragStart={() => onDragStart(slot.inventoryItemId)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDrop();
      }}
      style={{ ["--pixel-frame-bg" as string]: "#fcf6e4" }}
      className="pixel-frame grid cursor-grab gap-2 rounded-none border-2 border-[#a8916a] bg-[#fffdf5] p-2.5 shadow-[0_3px_0_#8b6f3e] transition hover:-translate-y-0.5 active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <ShopToken item={slot.item} large />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black leading-tight text-[#2d311f]">{slot.item.name}</div>
          <div className="mt-0.5 font-mono text-[11px] font-bold text-[#5e4a26]">
            {slot.item.quantity.amount} {slot.item.quantity.unit} available
          </div>
        </div>
        <button
          type="button"
          onClick={onHide}
          className="grid size-7 shrink-0 place-items-center rounded-none border-2 border-[#8b6f3e] bg-[#fff8dc] text-[#7a6843] shadow-[0_2px_0_#5e4a26] transition hover:bg-[#fff3cf] active:translate-y-0.5 active:shadow-[0_1px_0_#5e4a26]"
          aria-label={`Move ${slot.item.name} to back stock`}
        >
          <PixelGlyph name="basket" className="size-3.5" />
        </button>
      </div>

      <label className="grid gap-1">
        <span className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#7a6843]">Sign</span>
        <input
          aria-label={`${slot.item.name} sign text`}
          value={slot.signText}
          onChange={(event) => onUpdate(slot.inventoryItemId, { signText: event.target.value })}
          className="h-8 min-w-0 rounded-none border-2 border-[#c9b88a] bg-[#fffaf0] px-2 text-sm font-black text-[#6f3f1c] outline-none focus:border-[#9bb979]"
        />
      </label>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,80px)_minmax(0,96px)] gap-1.5">
        <label className="grid gap-1">
          <span className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#7a6843]">Amount</span>
          <input
            aria-label={`${slot.item.name} display amount`}
            type="number"
            min={0}
            max={slot.item.quantity.amount}
            step="0.1"
            value={slot.displayAmount}
            onChange={(event) => onUpdate(slot.inventoryItemId, { displayAmount: Number(event.target.value) })}
            className="h-8 min-w-0 rounded-none border-2 border-[#c9b88a] bg-white px-2 text-right font-mono text-sm font-bold text-[#365833] outline-none focus:border-[#9bb979]"
          />
        </label>
        <label className="grid gap-1">
          <span className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#7a6843]">Unit</span>
          <input
            aria-label={`${slot.item.name} display unit`}
            value={slot.displayUnit}
            onChange={(event) => onUpdate(slot.inventoryItemId, { displayUnit: event.target.value })}
            className="h-8 min-w-0 rounded-none border-2 border-[#c9b88a] bg-white px-2 font-mono text-sm font-bold text-[#365833] outline-none focus:border-[#9bb979]"
          />
        </label>
        <label className="grid gap-1">
          <span className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#7a6843]">Price</span>
          <input
            aria-label={`${slot.item.name} price`}
            value={formatPrice(slot.priceCents)}
            onChange={(event) => onUpdate(slot.inventoryItemId, { priceCents: parsePriceCents(event.target.value) })}
            className="h-8 min-w-0 rounded-none border-2 border-[#c9b88a] bg-white px-2 text-right font-mono text-sm font-bold text-[#365833] outline-none focus:border-[#9bb979]"
          />
        </label>
      </div>
    </article>
  );
}

function StatusBadge({ status, error }: { status: SaveStatus; error: string | null }) {
  const text = status === "saving" ? "Saving" : status === "saved" ? "Saved" : status === "error" ? "Save error" : "Ready";
  const classes = status === "error"
    ? "border-[#efb16b] bg-[#fff1dc] text-[#7a461f]"
    : status === "saving"
      ? "border-[#68b8c9] bg-[#e4f7f8] text-[#245c65]"
      : "border-[#9bc278] bg-[#eef8df] text-[#335a2d]";

  return (
    <span title={error ?? undefined} className={`rounded-none border-2 px-2.5 py-1 font-mono text-[11px] font-black uppercase tracking-[0.1em] shadow-[0_2px_0_#3b2a14] ${classes}`}>
      {text}
    </span>
  );
}

function ShopToken({ item, large = false }: { item: InventoryViewItem; large?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-none border-2 border-[#8b6f3e] shadow-[inset_0_2px_0_rgba(255,255,255,0.55),inset_0_-4px_0_rgba(95,80,43,0.22),0_2px_0_#5e4a26] ${
        large ? "size-14" : "size-11"
      }`}
      style={{ backgroundColor: item.color || "#fff8dc" }}
    >
      <Image
        src={iconForItem(item)}
        alt={`${item.name} icon`}
        width={32}
        height={32}
        className={large ? "size-9" : "size-6"}
        style={{ imageRendering: "pixelated" }}
        unoptimized
      />
    </span>
  );
}

function reorderSlots(
  current: ShopDisplaySlotView[],
  draggedItemId: string,
  targetItemId: string | undefined,
  visible: boolean,
) {
  const dragged = current.find((slot) => slot.inventoryItemId === draggedItemId);

  if (!dragged) {
    return current;
  }

  const nextDragged = { ...dragged, visible };
  const remaining = current.filter((slot) => slot.inventoryItemId !== draggedItemId);
  const targetIndex = targetItemId
    ? remaining.findIndex((slot) => slot.inventoryItemId === targetItemId)
    : -1;
  const insertIndex = targetIndex >= 0 ? targetIndex : remaining.length;

  return [
    ...remaining.slice(0, insertIndex),
    nextDragged,
    ...remaining.slice(insertIndex),
  ].map((slot, index) => ({ ...slot, position: index }));
}

function normalizeSlot(slot: ShopDisplaySlotView) {
  return {
    ...slot,
    displayAmount: Math.round(Math.min(Math.max(Number(slot.displayAmount) || 0, 0), slot.item.quantity.amount) * 10) / 10,
    displayUnit: slot.displayUnit.slice(0, 24),
    priceCents: Math.max(0, Math.round(Number(slot.priceCents) || 0)),
    signText: slot.signText.slice(0, 60),
  };
}

function toSaveSlot(slot: ShopDisplaySlotView) {
  return {
    inventoryItemId: slot.inventoryItemId,
    position: slot.position,
    displayAmount: slot.displayAmount,
    displayUnit: slot.displayUnit,
    priceCents: slot.priceCents,
    signText: slot.signText,
    visible: slot.visible,
  };
}

function formatPrice(priceCents: number) {
  return `$${(priceCents / 100).toFixed(2)}`;
}

function parsePriceCents(value: string) {
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function iconForItem(item: InventoryViewItem) {
  const name = item.name.toLowerCase();

  if (name.includes("tomato")) {
    return "/inventory-icons/tomato.png";
  }

  if (name.includes("lettuce")) {
    return "/inventory-icons/lettuce.png";
  }

  if (name.includes("jam") || name.includes("strawberry") || item.category === "preserves") {
    return "/inventory-icons/strawberry.png";
  }

  return "/inventory-icons/pea-pod.png";
}
