"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { PixelGlyph } from "../_components/icons";
import type { ShopDisplaySlotView, ShopSnapshot } from "@/lib/shop";
import { HoursSelector, PaymentSelector, PickupLocationSelector } from "./shop-selectors";
import { PickupPinMap } from "./pickup-map";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type ShopViewMode = "edit" | "preview";
type ShopDetails = ShopSnapshot["details"];
type DetailGlyph = "sun" | "wagon" | "basket" | "leaf" | "scroll";
type SimpleDetailKey = "shopName" | "pickupInstructions" | "contact" | "availabilityNote";
type SimpleDetailField = {
  key: SimpleDetailKey;
  label: string;
  glyph: DetailGlyph;
  multiline?: boolean;
};

const simpleDetailFields: SimpleDetailField[] = [
  { key: "shopName", label: "Shop name", glyph: "leaf" },
  { key: "pickupInstructions", label: "Pickup instructions", glyph: "scroll", multiline: true },
  { key: "contact", label: "Contact", glyph: "scroll" },
  { key: "availabilityNote", label: "Availability note", glyph: "leaf", multiline: true },
];

export function ShopBoard({ initialSnapshot }: { initialSnapshot: ShopSnapshot }) {
  const [slots, setSlots] = useState(initialSnapshot.slots);
  const [details, setDetails] = useState(initialSnapshot.details);
  const [mode, setMode] = useState<ShopViewMode>("edit");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [isDirtyState, setIsDirtyState] = useState(false);
  const hasUserEdited = useRef(false);
  const saveTokenRef = useRef(0);

  const visibleSlots = useMemo(
    () => slots.filter((slot) => slot.visible).sort((left, right) => left.position - right.position),
    [slots],
  );
  const hiddenSlots = useMemo(
    () => slots.filter((slot) => !slot.visible).sort((left, right) => left.position - right.position),
    [slots],
  );
  const totalDisplayed = visibleSlots.reduce((total, slot) => total + slot.displayAmount, 0);

  async function saveChanges() {
    setSaveStatus("saving");
    setSaveError(null);
    const editId = ++saveTokenRef.current;

    try {
      const response = await fetch("/api/shop/display", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ details, slots: slots.map(toSaveSlot) }),
      });
      const data = (await response.json()) as Partial<ShopSnapshot> & { error?: string };

      if (!response.ok || data.error) {
        throw new Error("error" in data ? data.error : "Unable to save shop display");
      }

      if (editId !== saveTokenRef.current) {
        // Newer edit landed while saving — keep local state, don't overwrite.
        return;
      }

      hasUserEdited.current = false;
      setIsDirtyState(false);
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "Unable to save shop display");
    }
  }

  function markEdited() {
    hasUserEdited.current = true;
    setIsDirtyState(true);
    if (saveStatus === "saved" || saveStatus === "error") {
      setSaveStatus("idle");
    }
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

  function updateDetails(patch: Partial<ShopDetails>) {
    markEdited();
    setDetails((current) => normalizeDetails({ ...current, ...patch }));
  }

  function moveToShelf(itemId: string) {
    const slot = findSlot(itemId);

    if (!slot) {
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
      const slot = findSlot(itemId);
      formData.set("inventoryItemId", itemId);
      if (slot?.listingId) {
        formData.set("listingId", slot.listingId);
      }
      formData.set("file", file);

      const response = await fetch("/api/shop/display/image", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as { imageId?: string; imageUrl?: string; listingId?: string; error?: string };

      if (!response.ok || !data.imageId || !data.imageUrl) {
        throw new Error(data.error ?? "Unable to upload image");
      }

      updateSlot(itemId, { imageId: data.imageId, imageUrl: data.imageUrl, listingId: data.listingId ?? slot?.listingId });
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
      <ShopModeTabs mode={mode} onChange={setMode} />

      <FarmStandPanel
        displayName={initialSnapshot.displayName}
        details={details}
        mode={mode}
        visibleSlots={visibleSlots}
        totalDisplayed={totalDisplayed}
        saveStatus={saveStatus}
        saveError={saveError}
        actionMessage={actionMessage}
        draggedItemId={draggedItemId}
        uploadingItemId={uploadingItemId}
        isDirty={isDirtyState}
        onSave={saveChanges}
        onDragStart={handleDragStart}
        onDropShelf={handleDropOnShelf}
        onDetailsChange={updateDetails}
        onUpdate={updateSlot}
        onUpload={uploadImage}
        onHide={(itemId) => updateSlot(itemId, { visible: false })}
      />

      {mode === "edit" ? (
        <BackStockPanel
          hiddenSlots={hiddenSlots}
          draggedItemId={draggedItemId}
          uploadingItemId={uploadingItemId}
          onDragStart={handleDragStart}
          onDropTray={handleDropOnTray}
          onMoveToShelf={moveToShelf}
          onUpload={uploadImage}
        />
      ) : null}
    </div>
  );
}

export function PublicShopfrontPreview({ snapshot }: { snapshot: ShopSnapshot }) {
  const visibleSlots = snapshot.slots
    .filter((slot) => slot.visible)
    .sort((left, right) => left.position - right.position);
  const totalDisplayed = visibleSlots.reduce((total, slot) => total + slot.displayAmount, 0);
  const noop = () => undefined;
  const noopAsync = async () => undefined;

  return (
    <FarmStandPanel
      displayName={snapshot.displayName}
      details={snapshot.details}
      mode="preview"
      visibleSlots={visibleSlots}
      totalDisplayed={totalDisplayed}
      saveStatus="idle"
      saveError={null}
      actionMessage={null}
      draggedItemId={null}
      uploadingItemId={null}
      isDirty={false}
      onSave={noopAsync}
      onDragStart={noop}
      onDropShelf={noop}
      onDetailsChange={noop}
      onUpdate={noop}
      onUpload={noopAsync}
      onHide={noop}
    />
  );
}

function ShopModeTabs({
  mode,
  onChange,
}: {
  mode: ShopViewMode;
  onChange: (mode: ShopViewMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="font-mono text-xs font-black uppercase tracking-[0.14em] text-[#6f3f1c]">
        Shopfront
      </div>
      <div className="grid grid-cols-2 rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] p-1 shadow-[0_2px_0_#3b2a14]">
        {(["edit", "preview"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`h-8 px-4 font-mono text-[11px] font-black uppercase tracking-[0.1em] transition ${
              mode === value
                ? "bg-[#365833] text-[#fffdf5]"
                : "bg-transparent text-[#5e4a26] hover:bg-[#fff3cf]"
            }`}
          >
            {value === "edit" ? "Edit" : "Preview"}
          </button>
        ))}
      </div>
    </div>
  );
}

function FarmStandPanel({
  displayName,
  details,
  mode,
  visibleSlots,
  totalDisplayed,
  saveStatus,
  saveError,
  actionMessage,
  draggedItemId,
  uploadingItemId,
  isDirty,
  onSave,
  onDragStart,
  onDropShelf,
  onDetailsChange,
  onUpdate,
  onUpload,
  onHide,
}: {
  displayName: string;
  details: ShopDetails;
  mode: ShopViewMode;
  visibleSlots: ShopDisplaySlotView[];
  totalDisplayed: number;
  saveStatus: SaveStatus;
  saveError: string | null;
  actionMessage: string | null;
  draggedItemId: string | null;
  uploadingItemId: string | null;
  isDirty: boolean;
  onSave: () => Promise<void>;
  onDragStart: (itemId: string) => void;
  onDropShelf: (targetItemId?: string) => void;
  onDetailsChange: (patch: Partial<ShopDetails>) => void;
  onUpdate: (itemId: string, patch: Partial<ShopDisplaySlotView>) => void;
  onUpload: (itemId: string, file: File) => Promise<void>;
  onHide: (itemId: string) => void;
}) {
  const isEditing = mode === "edit";
  const shopName = details.shopName || displayName;

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
                {shopName}
              </h1>
              <p className="text-xs font-semibold text-[#5f563f]">
                {isEditing ? "Editing shopfront" : "Public shop preview"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {isEditing ? <StatusBadge status={saveStatus} error={saveError} dirty={isDirty} /> : null}
            <span className="rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] px-2.5 py-1 font-mono text-[11px] font-black uppercase tracking-[0.1em] text-[#5e4a26] shadow-[0_2px_0_#3b2a14]">
              {visibleSlots.length} on shelf · {Math.round(totalDisplayed * 10) / 10} units
            </span>
            {isEditing ? (
              <button
                type="button"
                onClick={() => onSave()}
                disabled={!isDirty || saveStatus === "saving"}
                className={`rounded-none border-2 px-3 py-1 font-mono text-[11px] font-black uppercase tracking-[0.1em] shadow-[0_2px_0_#3b2a14] transition active:translate-y-0.5 active:shadow-[0_1px_0_#3b2a14] ${
                  isDirty && saveStatus !== "saving"
                    ? "border-[#3b2a14] bg-[#7da854] text-[#fffdf5] hover:bg-[#9bc278]"
                    : "cursor-not-allowed border-[#a8916a] bg-[#f1e4c2] text-[#7a6843] opacity-70"
                }`}
              >
                {saveStatus === "saving" ? "Saving…" : isDirty ? "Save changes" : "Saved"}
              </button>
            ) : null}
          </div>
          {actionMessage ? (
            <p className="rounded-none border-2 border-[#d8a05a] bg-[#fff4dc] px-3 py-1 font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#7a461f] shadow-[0_2px_0_#a8761c]">
              {actionMessage}
            </p>
          ) : null}
        </div>
      </div>

      {isEditing ? (
        <ShopDetailsEditor details={details} onChange={onDetailsChange} />
      ) : (
        <FarmStandInfoStrip details={details} visibleSlots={visibleSlots} />
      )}

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => onDropShelf()}
        className={`pixel-dots relative min-h-[420px] border-t-2 border-[#3b2a14] bg-[#fcf6e4] p-4 ${
          draggedItemId ? "outline outline-2 -outline-offset-4 outline-dashed outline-[#c9a64a]" : ""
        }`}
      >
        {visibleSlots.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleSlots.map((slot) => (
              <ShopShelfCard
                key={slot.inventoryItemId}
                slot={slot}
                mode={mode}
                pickupLocation={details.pickupLocation}
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
                {isEditing ? "Drag produce up from back stock" : "No produce listed"}
              </div>
              <p className="mx-auto mt-1 max-w-xs text-[11px] text-[#9a8a66]">
                {isEditing
                  ? "Each item needs a photo before it can ride the wagon to the shelf."
                  : "Check back when this shopfront has produce on the shelf."}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="border-t-2 border-[#3b2a14] bg-[linear-gradient(to_bottom,#a8916a_0_4px,#8b6f3e_4px_8px,#5e4a26_8px_100%)] py-2 text-center">
        <span className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#fffdf5] drop-shadow-[1px_1px_0_#3b2a14]">
          {isEditing ? "Edit shopfront" : details.hours || "Hours not set"}
        </span>
      </div>
    </section>
  );
}

function ShopDetailsEditor({
  details,
  onChange,
}: {
  details: ShopDetails;
  onChange: (patch: Partial<ShopDetails>) => void;
}) {
  const cardClass = "pixel-frame grid gap-2 self-start border-2 border-[#c9b88a] bg-[#fffdf5] p-2.5 shadow-[0_2px_0_#b29c66]";

  const shopNameField = simpleDetailFields.find((f) => f.key === "shopName")!;
  const contactField = simpleDetailFields.find((f) => f.key === "contact")!;
  const pickupInstructionsField = simpleDetailFields.find((f) => f.key === "pickupInstructions")!;
  const availabilityField = simpleDetailFields.find((f) => f.key === "availabilityNote")!;

  return (
    <div className="grid gap-2 bg-[#fffaf0] p-3">
      <div className="grid gap-2 lg:grid-cols-2">
        <SimpleDetailEditor field={shopNameField} details={details} onChange={onChange} />
        <SimpleDetailEditor field={contactField} details={details} onChange={onChange} />
      </div>

      <div style={{ ["--pixel-frame-bg" as string]: "#fffaf0" }} className={cardClass}>
        <HoursSelector
          value={details.hoursSchedule}
          onChange={(next) => onChange({ hoursSchedule: next })}
        />
      </div>

      <div style={{ ["--pixel-frame-bg" as string]: "#fffaf0" }} className={cardClass}>
        <PaymentSelector
          value={details.payment}
          onChange={(next) => onChange({ payment: next })}
        />
      </div>

      <div style={{ ["--pixel-frame-bg" as string]: "#fffaf0" }} className={cardClass}>
        <PickupLocationSelector
          address={details.pickupLocation}
          coords={details.pickupCoords}
          onAddressChange={(value) => onChange({ pickupLocation: value })}
          onCoordsChange={(value) => onChange({ pickupCoords: value })}
        />
      </div>

      <SimpleDetailEditor field={pickupInstructionsField} details={details} onChange={onChange} />
      <SimpleDetailEditor field={availabilityField} details={details} onChange={onChange} />
    </div>
  );
}

function SimpleDetailEditor({
  field,
  details,
  onChange,
}: {
  field: SimpleDetailField;
  details: ShopDetails;
  onChange: (patch: Partial<ShopDetails>) => void;
}) {
  return (
    <label
      style={{ ["--pixel-frame-bg" as string]: "#fffaf0" }}
      className={`pixel-frame grid gap-1.5 border-2 border-[#c9b88a] bg-[#fffdf5] p-2.5 shadow-[0_2px_0_#b29c66] ${
        field.multiline ? "lg:col-span-2" : ""
      }`}
    >
      <span className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#7a6843]">
        <PixelGlyph name={field.glyph} className="size-4" />
        {field.label}
      </span>
      {field.multiline ? (
        <textarea
          value={details[field.key]}
          onChange={(event) => onChange({ [field.key]: event.target.value })}
          rows={3}
          className="min-h-20 w-full resize-y rounded-none border-2 border-[#c9b88a] bg-white px-2 py-1.5 text-sm font-bold leading-snug text-[#365833] outline-none focus:border-[#9bb979]"
        />
      ) : (
        <input
          value={details[field.key]}
          onChange={(event) => onChange({ [field.key]: event.target.value })}
          className="h-9 min-w-0 rounded-none border-2 border-[#c9b88a] bg-white px-2 text-sm font-bold text-[#365833] outline-none focus:border-[#9bb979]"
        />
      )}
    </label>
  );
}

function FarmStandInfoStrip({
  details,
  visibleSlots,
}: {
  details: ShopDetails;
  visibleSlots: ShopDisplaySlotView[];
}) {
  const freshestUntil = getSoonestUseByLabel(visibleSlots);
  const hasMap = Boolean(details.pickupCoords);
  type RemainingItem = { label: string; value: string; detail?: string; glyph: "wagon" | "scroll" };
  const remainingDetails: RemainingItem[] = [];
  if (!hasMap && details.pickupLocation) {
    remainingDetails.push({
      label: "Pickup",
      value: details.pickupLocation,
      detail: details.pickupInstructions,
      glyph: "wagon",
    });
  }
  if (hasMap && details.pickupInstructions) {
    remainingDetails.push({
      label: "Pickup notes",
      value: details.pickupInstructions,
      glyph: "scroll",
    });
  }
  if (details.contact) {
    remainingDetails.push({ label: "Contact", value: details.contact, glyph: "scroll" });
  }

  return (
    <div className="bg-[#fffaf0] p-3">
      <div className="grid items-start gap-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div
          style={{ ["--pixel-frame-bg" as string]: "#fffaf0" }}
          className="pixel-frame border-2 border-[#3b2a14] bg-[#fffdf5] p-3 shadow-[0_2px_0_#8b6f3e]"
        >
          <div className="flex flex-wrap items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#eef8df] shadow-[0_2px_0_#6f8d45]">
              <PixelGlyph name="leaf" className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[11px] font-black uppercase tracking-[0.14em] text-[#6f3f1c]">
                {details.shopName || "Shopfront"}
              </div>
              {details.availabilityNote ? (
                <p className="mt-1 text-sm font-bold leading-snug text-[#2d311f]">
                  {details.availabilityNote}
                </p>
              ) : null}
            </div>
            <span className="rounded-none border-2 border-[#3b2a14] bg-[#eef8df] px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#335a2d] shadow-[0_2px_0_#6f8d45]">
              {freshestUntil}
            </span>
          </div>
          {hasMap && details.pickupCoords ? (
            <div className="mt-3 grid gap-2">
              <PickupPinMap
                coords={details.pickupCoords}
                label={details.pickupLocation}
                heightClass="h-44"
              />
              {details.pickupLocation ? (
                <div className="flex items-start gap-2 rounded-none border-2 border-[#c9b88a] bg-[#fffaf0] p-2">
                  <PixelGlyph name="wagon" className="mt-0.5 size-4 shrink-0 text-[#7a6843]" />
                  <p className="text-xs font-bold leading-snug text-[#2d311f]">
                    {details.pickupLocation}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid content-start gap-2">
          <HoursPreviewCard details={details} />
          <PaymentPreviewCard details={details} />
          {remainingDetails.map((item) => (
            <PreviewMiniCard
              key={item.label}
              label={item.label}
              glyph={item.glyph}
              value={item.value}
              detail={item.detail}
            />
          ))}
          {!remainingDetails.length && !details.hoursSchedule && !details.payment && !details.hours && !details.paymentOptions ? (
            <div className="rounded-none border-2 border-dashed border-[#d4c39a] bg-[#fffdf5] px-3 py-5 text-center font-mono text-xs font-black uppercase tracking-[0.12em] text-[#9a8a66]">
              Shop details not published yet
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PreviewMiniCard({
  label,
  glyph,
  value,
  detail,
}: {
  label: string;
  glyph: "wagon" | "scroll" | "sun" | "basket" | "leaf";
  value: string;
  detail?: string;
}) {
  return (
    <div
      style={{ ["--pixel-frame-bg" as string]: "#fffaf0" }}
      className="pixel-frame flex gap-2 border-2 border-[#c9b88a] bg-[#fffdf5] p-2 shadow-[0_2px_0_#b29c66]"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-none border-2 border-[#8b6f3e] bg-[#fff8dc] shadow-[0_1px_0_#5e4a26]">
        <PixelGlyph name={glyph} className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#7a6843]">
          {label}
        </div>
        <div className="mt-0.5 text-xs font-black leading-tight text-[#2d311f]">{value}</div>
        {detail ? (
          <p className="mt-1 text-[11px] font-semibold leading-snug text-[#7a6843]">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}

function HoursPreviewCard({ details }: { details: ShopDetails }) {
  const schedule = details.hoursSchedule;

  if (!schedule && !details.hours) {
    return null;
  }

  if (!schedule) {
    return (
      <PreviewMiniCard label="Hours" glyph="sun" value={details.hours || "Hours not posted"} />
    );
  }

  const dayShorts = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const activeDays = new Set(schedule.days);
  const range = schedule.openMinutes === schedule.closeMinutes
    ? null
    : `${formatMinutes(schedule.openMinutes)} – ${formatMinutes(schedule.closeMinutes)}`;

  return (
    <div
      style={{ ["--pixel-frame-bg" as string]: "#fffaf0" }}
      className="pixel-frame grid gap-2 border-2 border-[#c9b88a] bg-[#fffdf5] p-2 shadow-[0_2px_0_#b29c66]"
    >
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-none border-2 border-[#8b6f3e] bg-[#fff8dc] shadow-[0_1px_0_#5e4a26]">
          <PixelGlyph name="sun" className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#7a6843]">
            Open days &amp; hours
          </div>
          {range ? (
            <div className="mt-0.5 font-mono text-xs font-black text-[#2d311f]">{range}</div>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dayShorts.map((short, index) => {
          const active = activeDays.has(index);
          return (
            <span
              key={short}
              aria-label={`${short}${active ? " open" : " closed"}`}
              className={`grid h-7 min-w-0 place-items-center rounded-none border-2 font-mono text-[10px] font-black uppercase tracking-[0.04em] ${
                active
                  ? "border-[#3b2a14] bg-[#7da854] text-[#fffdf5] shadow-[0_2px_0_#3b2a14]"
                  : "border-[#c9b88a] bg-[#fff8dc] text-[#9a8a66]"
              }`}
            >
              {short}
            </span>
          );
        })}
      </div>
      {schedule.note ? (
        <p className="text-[11px] font-semibold leading-snug text-[#7a6843]">{schedule.note}</p>
      ) : null}
    </div>
  );
}

function PaymentPreviewCard({ details }: { details: ShopDetails }) {
  const payment = details.payment;

  if (!payment && !details.paymentOptions) {
    return null;
  }

  if (!payment || !payment.methods.length) {
    return (
      <PreviewMiniCard
        label="Payment"
        glyph="basket"
        value={details.paymentOptions || payment?.note || "Ask the farmer"}
      />
    );
  }

  const methodLabels: Record<string, string> = {
    venmo: "Venmo",
    cashapp: "Cash App",
    zelle: "Zelle",
    paypal: "PayPal",
    cash: "Cash",
    card: "Card",
    check: "Check",
    trade: "Trade",
  };

  return (
    <div
      style={{ ["--pixel-frame-bg" as string]: "#fffaf0" }}
      className="pixel-frame grid gap-2 border-2 border-[#c9b88a] bg-[#fffdf5] p-2 shadow-[0_2px_0_#b29c66]"
    >
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-none border-2 border-[#8b6f3e] bg-[#fff8dc] shadow-[0_1px_0_#5e4a26]">
          <PixelGlyph name="basket" className="size-4" />
        </span>
        <div className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#7a6843]">
          Payment or trade
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {payment.methods.map((method) => (
          <span
            key={method.kind}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-none border-2 border-[#3b2a14] bg-[#7da854] px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#fffdf5] shadow-[0_2px_0_#3b2a14]"
          >
            {methodLabels[method.kind] ?? method.kind}
            {method.handle ? <span className="text-[9px] font-bold normal-case opacity-90">{method.handle}</span> : null}
          </span>
        ))}
      </div>
      {payment.note ? (
        <p className="text-[11px] font-semibold leading-snug text-[#7a6843]">{payment.note}</p>
      ) : null}
    </div>
  );
}

function formatMinutes(minutes: number) {
  const total = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const period = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:${m.toString().padStart(2, "0")} ${period}`;
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
            Drag onto the shelf when ready
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
  mode,
  pickupLocation,
  isUploading,
  onDragStart,
  onDrop,
  onUpdate,
  onUpload,
  onHide,
}: {
  slot: ShopDisplaySlotView;
  mode: ShopViewMode;
  pickupLocation: string;
  isUploading: boolean;
  onDragStart: (itemId: string) => void;
  onDrop: () => void;
  onUpdate: (itemId: string, patch: Partial<ShopDisplaySlotView>) => void;
  onUpload: (itemId: string, file: File) => Promise<void>;
  onHide: () => void;
}) {
  const isEditing = mode === "edit";
  const freshness = getFreshnessLabel(slot);
  const harvested = formatShortDate(slot.item.acquiredAt);
  const farmSource = toTitleCase(slot.item.source);

  return (
    <article
      draggable={isEditing}
      onDragStart={() => isEditing && onDragStart(slot.inventoryItemId)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (isEditing) {
          onDrop();
        }
      }}
      style={{ ["--pixel-frame-bg" as string]: "#fcf6e4" }}
      className={`pixel-frame grid gap-2 rounded-none border-2 border-[#a8916a] bg-[#fffdf5] p-2.5 shadow-[0_3px_0_#8b6f3e] ${
        isEditing ? "cursor-grab transition hover:-translate-y-0.5 active:cursor-grabbing" : ""
      }`}
    >
      <ImageSlot
        slot={slot}
        isUploading={isUploading}
        onUpload={(file) => onUpload(slot.inventoryItemId, file)}
        height="h-32"
        editable={isEditing}
      />

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black leading-tight text-[#2d311f]">{slot.item.name}</div>
          <div className="mt-0.5 font-mono text-[11px] font-bold text-[#5e4a26]">
            {slot.item.quantity.amount} {slot.item.quantity.unit} available
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded-none border border-[#9bc278] bg-[#eef8df] px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.08em] text-[#335a2d]">
              {freshness}
            </span>
            {pickupLocation ? (
              <span className="rounded-none border border-[#d8a05a] bg-[#fff4dc] px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.08em] text-[#7a461f]">
                Pick up: {pickupLocation}
              </span>
            ) : null}
          </div>
        </div>
        {isEditing ? (
          <button
            type="button"
            onClick={onHide}
            className="grid size-7 shrink-0 place-items-center rounded-none border-2 border-[#8b6f3e] bg-[#fff8dc] text-[#7a6843] shadow-[0_2px_0_#5e4a26] transition hover:bg-[#fff3cf] active:translate-y-0.5 active:shadow-[0_1px_0_#5e4a26]"
            aria-label={`Move ${slot.item.name} to back stock`}
          >
            <PixelGlyph name="basket" className="size-3.5" />
          </button>
        ) : null}
      </div>

      {isEditing ? (
        <>
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
        </>
      ) : (
        <div className="rounded-none border-2 border-[#c9b88a] bg-[#fffaf0] px-2 py-1.5">
          <div className="text-sm font-black leading-snug text-[#6f3f1c]">{slot.signText}</div>
          <div className="mt-1 font-mono text-xs font-black text-[#365833]">
            {formatPrice(slot.priceCents)} / {slot.displayAmount} {slot.displayUnit}
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-1.5 rounded-none border-2 border-[#e1d0a8] bg-[#fffaf0] p-2">
        <div className="min-w-0">
          <dt className="font-mono text-[9px] font-black uppercase tracking-[0.1em] text-[#8b6f3e]">Harvested</dt>
          <dd className="truncate text-[11px] font-bold text-[#4f442d]">{harvested}</dd>
        </div>
        <div className="min-w-0">
          <dt className="font-mono text-[9px] font-black uppercase tracking-[0.1em] text-[#8b6f3e]">From</dt>
          <dd className="truncate text-[11px] font-bold text-[#4f442d]">{farmSource}</dd>
        </div>
      </dl>
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
  return (
    <div
      draggable
      onDragStart={() => onDragStart(slot.inventoryItemId)}
      style={{ ["--pixel-frame-bg" as string]: "#fcf6e4" }}
      className="pixel-frame grid cursor-grab gap-2 rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] p-2 shadow-[0_2px_0_#b29c66] active:cursor-grabbing"
    >
      <ImageSlot
        slot={slot}
        isUploading={isUploading}
        onUpload={(file) => onUpload(slot.inventoryItemId, file)}
        height="h-24"
        editable
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
        className="flex h-8 items-center justify-center gap-1.5 rounded-none border-2 border-[#3b2a14] bg-[#fff3cf] font-mono text-[11px] font-black uppercase tracking-[0.1em] text-[#5e4a26] shadow-[0_2px_0_#3b2a14] transition hover:bg-[#ffe89a] active:translate-y-0.5 active:shadow-[0_1px_0_#3b2a14]"
      >
        <PixelGlyph name="wagon" className="size-3.5" />
        Send to shelf
      </button>
    </div>
  );
}

function ImageSlot({
  slot,
  isUploading,
  onUpload,
  height,
  editable,
}: {
  slot: ShopDisplaySlotView;
  isUploading: boolean;
  onUpload: (file: File) => Promise<void>;
  height: string;
  editable: boolean;
}) {
  const inputId = `shop-image-${slot.inventoryItemId}`;

  return (
    <div
      className={`relative grid ${height} place-items-center overflow-hidden rounded-none border-2 ${
        slot.imageUrl ? "border-[#3b2a14] bg-[#fff8dc]" : "border-dashed border-[#c9a64a] bg-[#fff8dc]"
      } ${editable ? "cursor-pointer" : ""}`}
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
      ) : !editable ? (
        <div
          className="grid h-full w-full place-items-center text-center"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(255,255,255,0.28) 25%, transparent 25% 50%, rgba(59,42,20,0.08) 50% 75%, transparent 75%)",
            backgroundColor: slot.item.color,
            backgroundSize: "6px 6px",
          }}
        >
          <div className="rounded-none border-2 border-[#3b2a14] bg-[#fffdf5]/90 px-3 py-2 shadow-[0_2px_0_#3b2a14]">
            <PixelGlyph name="leaf" className="mx-auto mb-1 size-5 text-[#365833]" />
            <div className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#5e4a26]">
              Fresh from farm
            </div>
          </div>
        </div>
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
      {slot.imageUrl && editable ? (
        <span className="absolute right-1.5 top-1.5 rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#5e4a26] shadow-[0_1px_0_#3b2a14]">
          Replace
        </span>
      ) : null}
      {editable ? (
        <label htmlFor={inputId} className="absolute inset-0 cursor-pointer">
          <span className="sr-only">Upload {slot.item.name} photo</span>
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
      ) : null}
    </div>
  );
}

function StatusBadge({ status, error, dirty }: { status: SaveStatus; error: string | null; dirty: boolean }) {
  const text = status === "saving"
    ? "Saving"
    : status === "error"
      ? "Save error"
      : dirty
        ? "Unsaved"
        : status === "saved"
          ? "Saved"
          : "Ready";
  const classes = status === "error"
    ? "border-[#efb16b] bg-[#fff1dc] text-[#7a461f]"
    : status === "saving"
      ? "border-[#68b8c9] bg-[#e4f7f8] text-[#245c65]"
      : dirty
        ? "border-[#d8a05a] bg-[#fff1dc] text-[#7a461f]"
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

function normalizeDetails(details: ShopDetails): ShopDetails {
  return {
    ...details,
    shopName: details.shopName.slice(0, 60),
    hours: details.hours.slice(0, 80),
    pickupLocation: details.pickupLocation.slice(0, 80),
    pickupInstructions: details.pickupInstructions.slice(0, 160),
    paymentOptions: details.paymentOptions.slice(0, 120),
    contact: details.contact.slice(0, 100),
    availabilityNote: details.availabilityNote.slice(0, 160),
  };
}

function toSaveSlot(slot: ShopDisplaySlotView) {
  return {
    inventoryItemId: slot.inventoryItemId,
    listingId: slot.listingId,
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

function getFreshnessLabel(slot: ShopDisplaySlotView) {
  if (!slot.item.useBy) {
    return "Best this week";
  }

  const daysLeft = daysUntil(slot.item.useBy);

  if (daysLeft <= 0) {
    return "Best today";
  }

  if (daysLeft === 1) {
    return "1 day left";
  }

  return `${daysLeft} days left`;
}

function getSoonestUseByLabel(slots: ShopDisplaySlotView[]) {
  const soonest = slots
    .map((slot) => slot.item.useBy)
    .filter((date): date is string => Boolean(date))
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];

  if (!soonest) {
    return "Freshness posted";
  }

  const daysLeft = daysUntil(soonest);

  if (daysLeft <= 0) {
    return "Use freshest today";
  }

  return `Freshest item: ${daysLeft}d`;
}

function daysUntil(value: string) {
  const date = Date.parse(value);

  if (!Number.isFinite(date)) {
    return 0;
  }

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfTarget = new Date(date);
  startOfTarget.setHours(0, 0, 0, 0);

  return Math.max(0, Math.ceil((startOfTarget.getTime() - startOfToday) / 86_400_000));
}

function formatShortDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}
