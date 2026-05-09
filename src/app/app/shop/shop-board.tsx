"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { PixelGlyph } from "../_components/icons";
import type { ShopDisplaySlotView, ShopSnapshot } from "@/lib/shop";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ShopBoard({ initialSnapshot }: { initialSnapshot: ShopSnapshot }) {
  const [slots, setSlots] = useState(initialSnapshot.slots);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
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

  function flashAction(message: string) {
    setActionMessage(message);
    window.setTimeout(() => {
      setActionMessage((current) => (current === message ? null : current));
    }, 2200);
  }

  function handleDragStart(itemId: string) {
    setDraggedItemId(itemId);
  }

  function findSlot(itemId: string) {
    return slots.find((slot) => slot.inventoryItemId === itemId);
  }

  function handleDropOnShelf(targetItemId?: string) {
    if (!draggedItemId) {
      return;
    }

    const dragged = findSlot(draggedItemId);

    if (!dragged) {
      setDraggedItemId(null);
      return;
    }

    if (!dragged.imageId) {
      flashAction(`Add a photo of ${dragged.item.name} before placing it on the stand.`);
      setDraggedItemId(null);
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

  function moveToShelf(itemId: string) {
    const slot = findSlot(itemId);

    if (!slot) {
      return;
    }

    if (!slot.imageId) {
      flashAction(`Add a photo of ${slot.item.name} first — every farm-stand item needs one.`);
      return;
    }

    updateSlot(itemId, { visible: true });
  }

  async function uploadImage(itemId: string, file: File) {
    setUploadingItemId(itemId);
    setSaveError(null);
    setActionMessage(null);

    try {
      const formData = new FormData();
      formData.set("inventoryItemId", itemId);
      formData.set("file", file);

      const response = await fetch("/api/shop/display/image", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as { imageId?: string; imageUrl?: string; error?: string };

      if (!response.ok || !data.imageId || !data.imageUrl) {
        throw new Error(data.error ?? "Unable to upload image");
      }

      updateSlot(itemId, { imageId: data.imageId, imageUrl: data.imageUrl });
      flashAction("Photo saved.");
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "Unable to upload image");
    } finally {
      setUploadingItemId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
      <FarmStandPanel
        displayName={initialSnapshot.displayName}
        visibleSlots={visibleSlots}
        totalDisplayed={totalDisplayed}
        saveStatus={saveStatus}
        saveError={saveError}
        actionMessage={actionMessage}
        draggedItemId={draggedItemId}
        uploadingItemId={uploadingItemId}
        onDragStart={handleDragStart}
        onDropShelf={handleDropOnShelf}
        onUpdate={updateSlot}
        onUpload={uploadImage}
        onHide={(itemId) => updateSlot(itemId, { visible: false })}
      />

      <BackStockPanel
        hiddenSlots={hiddenSlots}
        draggedItemId={draggedItemId}
        uploadingItemId={uploadingItemId}
        onDragStart={handleDragStart}
        onDropTray={handleDropOnTray}
        onMoveToShelf={moveToShelf}
        onUpload={uploadImage}
      />
    </div>
  );
}

function FarmStandPanel({
  displayName,
  visibleSlots,
  totalDisplayed,
  saveStatus,
  saveError,
  actionMessage,
  draggedItemId,
  uploadingItemId,
  onDragStart,
  onDropShelf,
  onUpdate,
  onUpload,
  onHide,
}: {
  displayName: string;
  visibleSlots: ShopDisplaySlotView[];
  totalDisplayed: number;
  saveStatus: SaveStatus;
  saveError: string | null;
  actionMessage: string | null;
  draggedItemId: string | null;
  uploadingItemId: string | null;
  onDragStart: (itemId: string) => void;
  onDropShelf: (targetItemId?: string) => void;
  onUpdate: (itemId: string, patch: Partial<ShopDisplaySlotView>) => void;
  onUpload: (itemId: string, file: File) => Promise<void>;
  onHide: (itemId: string) => void;
}) {
  return (
    <section
      style={{ ["--pixel-frame-bg" as string]: "#fbf6e8" }}
      className="pixel-frame overflow-hidden rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] shadow-[0_4px_0_#3b2a14]"
    >
      <Awning />

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
        <div className="relative flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fff8dc] text-[#e9823a] shadow-[inset_0_2px_0_rgba(255,255,255,0.6),inset_0_-4px_0_rgba(95,80,43,0.22),0_2px_0_#3b2a14]">
              <PixelGlyph name="wagon" className="size-7" />
            </span>
            <div className="min-w-0 text-left">
              <h1 className="font-mono text-lg font-black uppercase tracking-[0.18em] text-[#34432b] drop-shadow-[1px_1px_0_#fffdf5]">
                Farm Stand
              </h1>
              <p className="text-xs font-semibold text-[#5f563f]">
                {displayName}&apos;s market shelf
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <StatusBadge status={saveStatus} error={saveError} />
            <span className="rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] px-2.5 py-1 font-mono text-[11px] font-black uppercase tracking-[0.1em] text-[#5e4a26] shadow-[0_2px_0_#3b2a14]">
              {visibleSlots.length} on shelf · {Math.round(totalDisplayed * 10) / 10} units
            </span>
          </div>
          {actionMessage ? (
            <p className="rounded-none border-2 border-[#d8a05a] bg-[#fff4dc] px-3 py-1 font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#7a461f] shadow-[0_2px_0_#a8761c]">
              {actionMessage}
            </p>
          ) : null}
        </div>
      </div>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => onDropShelf()}
        className={`pixel-dots relative min-h-[420px] bg-[#fcf6e4] p-4 ${
          draggedItemId ? "outline outline-2 -outline-offset-4 outline-dashed outline-[#c9a64a]" : ""
        }`}
      >
        {visibleSlots.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleSlots.map((slot) => (
              <ShopShelfCard
                key={slot.inventoryItemId}
                slot={slot}
                isUploading={uploadingItemId === slot.inventoryItemId}
                onDragStart={onDragStart}
                onDrop={() => onDropShelf(slot.inventoryItemId)}
                onUpdate={onUpdate}
                onUpload={onUpload}
                onHide={() => onHide(slot.inventoryItemId)}
              />
            ))}
          </div>
        ) : (
          <div className="grid min-h-72 place-items-center rounded-none border-2 border-dashed border-[#c9b88a] bg-[#fffdf5]/80 text-center">
            <div className="px-4">
              <PixelGlyph name="basket" className="mx-auto mb-2 size-8 text-[#c9a64a]" />
              <div className="font-mono text-xs font-black uppercase tracking-[0.12em] text-[#7a6843]">
                Drag produce up from back stock
              </div>
              <p className="mx-auto mt-1 max-w-xs text-[11px] text-[#9a8a66]">
                Each item needs a photo before it can ride the wagon to the shelf.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="border-t-2 border-[#3b2a14] bg-[linear-gradient(to_bottom,#a8916a_0_4px,#8b6f3e_4px_8px,#5e4a26_8px_100%)] py-2 text-center">
        <span className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#fffdf5] drop-shadow-[1px_1px_0_#3b2a14]">
          ☼ Open Today ☼
        </span>
      </div>
    </section>
  );
}

function Awning() {
  return (
    <div
      aria-hidden
      className="h-3 border-b-2 border-[#3b2a14]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(90deg, #c1492f 0 16px, #fffdf5 16px 32px)",
      }}
    />
  );
}

function BackStockPanel({
  hiddenSlots,
  draggedItemId,
  uploadingItemId,
  onDragStart,
  onDropTray,
  onMoveToShelf,
  onUpload,
}: {
  hiddenSlots: ShopDisplaySlotView[];
  draggedItemId: string | null;
  uploadingItemId: string | null;
  onDragStart: (itemId: string) => void;
  onDropTray: () => void;
  onMoveToShelf: (itemId: string) => void;
  onUpload: (itemId: string, file: File) => Promise<void>;
}) {
  return (
    <section
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDropTray}
      style={{ ["--pixel-frame-bg" as string]: "#fbf6e8" }}
      className={`pixel-frame overflow-hidden rounded-none border-2 border-[#3b2a14] bg-[#fffaf0] shadow-[0_4px_0_#3b2a14] ${
        draggedItemId ? "outline outline-2 outline-offset-2 outline-[#e8d690]" : ""
      }`}
    >
      <div className="pixel-gradient-need flex flex-wrap items-center gap-2 border-b-2 border-[#3b2a14] px-3 py-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] text-[#5e4a26] shadow-[0_1px_0_#3b2a14]">
          <PixelGlyph name="basket" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-sm font-black uppercase tracking-[0.14em] text-[#6f3f1c]">
            Back Stock
          </div>
          <div className="text-[10px] font-semibold text-[#7a6843]">
            Add a photo · drag onto the shelf when ready
          </div>
        </div>
        <span className="ml-auto rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] px-2 py-0.5 font-mono text-xs font-bold text-[#5e4a26] shadow-[0_1px_0_#3b2a14]">
          {hiddenSlots.length}
        </span>
      </div>
      <div className="bg-[#fcf6e4] p-3">
        {hiddenSlots.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {hiddenSlots.map((slot) => (
              <BackStockCard
                key={slot.inventoryItemId}
                slot={slot}
                isUploading={uploadingItemId === slot.inventoryItemId}
                onDragStart={onDragStart}
                onMoveToShelf={() => onMoveToShelf(slot.inventoryItemId)}
                onUpload={onUpload}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-none border-2 border-dashed border-[#d4c39a] bg-[#fffdf5] px-3 py-5 text-center font-mono text-xs font-black uppercase tracking-[0.12em] text-[#9a8a66]">
            All sellables are on display
          </div>
        )}
      </div>
    </section>
  );
}

function ShopShelfCard({
  slot,
  isUploading,
  onDragStart,
  onDrop,
  onUpdate,
  onUpload,
  onHide,
}: {
  slot: ShopDisplaySlotView;
  isUploading: boolean;
  onDragStart: (itemId: string) => void;
  onDrop: () => void;
  onUpdate: (itemId: string, patch: Partial<ShopDisplaySlotView>) => void;
  onUpload: (itemId: string, file: File) => Promise<void>;
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
      <ImageSlot
        slot={slot}
        isUploading={isUploading}
        onUpload={(file) => onUpload(slot.inventoryItemId, file)}
        height="h-32"
      />

      <div className="flex items-start gap-2">
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

function BackStockCard({
  slot,
  isUploading,
  onDragStart,
  onMoveToShelf,
  onUpload,
}: {
  slot: ShopDisplaySlotView;
  isUploading: boolean;
  onDragStart: (itemId: string) => void;
  onMoveToShelf: () => void;
  onUpload: (itemId: string, file: File) => Promise<void>;
}) {
  const ready = Boolean(slot.imageId);

  return (
    <div
      draggable={ready}
      onDragStart={() => ready && onDragStart(slot.inventoryItemId)}
      style={{ ["--pixel-frame-bg" as string]: "#fcf6e4" }}
      className={`pixel-frame grid gap-2 rounded-none border-2 p-2 shadow-[0_2px_0_#b29c66] ${
        ready
          ? "cursor-grab border-[#c9b88a] bg-[#fffdf5]"
          : "cursor-default border-[#d8a05a] bg-[#fff7e3]"
      }`}
    >
      <ImageSlot
        slot={slot}
        isUploading={isUploading}
        onUpload={(file) => onUpload(slot.inventoryItemId, file)}
        height="h-24"
      />

      <div className="min-w-0">
        <div className="truncate text-sm font-black leading-tight text-[#2d311f]">{slot.item.name}</div>
        <div className="font-mono text-[11px] font-bold text-[#5e4a26]">
          {slot.item.quantity.amount} {slot.item.quantity.unit} available
        </div>
      </div>

      <button
        type="button"
        onClick={onMoveToShelf}
        disabled={!ready}
        className={`flex h-8 items-center justify-center gap-1.5 rounded-none border-2 font-mono text-[11px] font-black uppercase tracking-[0.1em] shadow-[0_2px_0_#3b2a14] transition active:translate-y-0.5 active:shadow-[0_1px_0_#3b2a14] ${
          ready
            ? "border-[#3b2a14] bg-[#fff3cf] text-[#5e4a26] hover:bg-[#ffe89a]"
            : "cursor-not-allowed border-[#a8916a] bg-[#f1e4c2] text-[#7a6843] opacity-70"
        }`}
      >
        <PixelGlyph name="wagon" className="size-3.5" />
        {ready ? "Send to shelf" : "Add a photo first"}
      </button>
    </div>
  );
}

function ImageSlot({
  slot,
  isUploading,
  onUpload,
  height,
}: {
  slot: ShopDisplaySlotView;
  isUploading: boolean;
  onUpload: (file: File) => Promise<void>;
  height: string;
}) {
  const inputId = `shop-image-${slot.inventoryItemId}`;

  return (
    <label
      htmlFor={inputId}
      className={`relative grid ${height} cursor-pointer place-items-center overflow-hidden rounded-none border-2 ${
        slot.imageUrl ? "border-[#3b2a14] bg-[#fff8dc]" : "border-dashed border-[#c9a64a] bg-[#fff8dc]"
      }`}
    >
      {slot.imageUrl ? (
        <Image
          src={slot.imageUrl}
          alt={`${slot.item.name} photo`}
          fill
          sizes="(max-width: 768px) 100vw, 320px"
          className="object-cover"
          unoptimized
        />
      ) : (
        <div className="grid place-items-center text-center">
          <PixelGlyph name="sparkle" className="mx-auto mb-1 size-5 text-[#c9a64a]" />
          <div className="font-mono text-[11px] font-black uppercase tracking-[0.1em] text-[#7a6843]">
            Add a photo
          </div>
          <div className="mt-0.5 text-[10px] text-[#9a8a66]">PNG · JPG · WEBP · ≤ 4 MB</div>
        </div>
      )}
      {isUploading ? (
        <div className="absolute inset-0 grid place-items-center bg-[rgba(255,253,245,0.8)]">
          <span className="font-mono text-[11px] font-black uppercase tracking-[0.12em] text-[#5e4a26]">
            Uploading…
          </span>
        </div>
      ) : null}
      {slot.imageUrl ? (
        <span className="absolute right-1.5 top-1.5 rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#5e4a26] shadow-[0_1px_0_#3b2a14]">
          Replace
        </span>
      ) : null}
      <input
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onUpload(file).finally(() => {
              event.target.value = "";
            });
          }
        }}
      />
    </label>
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
    imageId: slot.imageId ?? null,
  };
}

function formatPrice(priceCents: number) {
  return `$${(priceCents / 100).toFixed(2)}`;
}

function parsePriceCents(value: string) {
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}
