"use client";

import Image from "next/image";
import type { DragEvent } from "react";
import { useMemo, useState } from "react";
import { PixelGlyph, type PixelGlyphName } from "../_components/icons";
import type { InventoryPlanOutput, InventoryViewItem } from "@/lib/inventory";
import { yieldForecastDragType } from "./drag-types";

type InventoryColumn = "sell" | "need";

type InputPlan = {
  id: string;
  name: string;
  season: string;
  currentDate: string;
  objectsCount: number;
  summary: string;
};

type InventoryItemResponse = {
  item?: InventoryViewItem;
  error?: string;
};

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
  const [inputOpen, setInputOpen] = useState(false);
  const [inputPlans, setInputPlans] = useState<InputPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [inputPrompt, setInputPrompt] = useState("");
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isGeneratingInputs, setIsGeneratingInputs] = useState(false);
  const [isCommittingInputs, setIsCommittingInputs] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<InventoryViewItem[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  async function deleteItem(id: string) {
    if (deletingIds.has(id)) {
      return;
    }

    setDeleteError(null);

    if (!isPersistedInventoryId(id)) {
      setItems((current) => current.filter((item) => item.id !== id));
      return;
    }

    setDeletingIds((current) => new Set(current).add(id));

    try {
      const response = await fetch(`/api/inventory/items/${id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to delete inventory item");
      }

      setItems((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      setDeleteError(formatClientError(error));
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  async function moveItem(id: string, column: InventoryColumn, targetId?: string) {
    const currentItem = items.find((item) => item.id === id);
    if (!currentItem) {
      return;
    }

    const patch = columnToPatch(column);
    moveItemInState(id, column, targetId);

    if (!isPersistedInventoryId(id)) {
      return;
    }

    setDeleteError(null);

    try {
      const saved = await patchInventoryItem(id, patch);
      setItems((current) => mergeInventoryItems(current, [saved]));
    } catch (error) {
      setDeleteError(formatClientError(error));
      setItems((current) => mergeInventoryItems(current, [currentItem]));
    }
  }

  async function handleDrop(column: InventoryColumn, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const forecastOutput = readForecastDrop(event);

    if (forecastOutput && column === "sell") {
      await createForecastInventoryItem(forecastOutput);
      setDraggedId(null);
      return;
    }

    if (!draggedId) {
      return;
    }

    await moveItem(draggedId, column);
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

  async function handleDropOnItem(column: InventoryColumn, targetId: string, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    const forecastOutput = readForecastDrop(event);

    if (forecastOutput && column === "sell") {
      await createForecastInventoryItem(forecastOutput, targetId);
      setDraggedId(null);
      return;
    }

    if (!draggedId) {
      return;
    }

    await moveItem(draggedId, column, targetId);
    setDraggedId(null);
  }

  function handleTableDrop(targetId: string) {
    if (!draggedId) {
      return;
    }

    moveItemInState(draggedId, undefined, targetId);
    setDraggedId(null);
  }

  async function createForecastInventoryItem(output: InventoryPlanOutput, targetId?: string) {
    setDeleteError(null);
    const optimisticItem = optimisticForecastInventoryItem(output);
    setItems((current) => insertOrMergeInventoryItem(current, optimisticItem, targetId));

    try {
      const saved = await postInventoryItem(forecastToInventoryItem(output));
      setItems((current) =>
        insertOrMergeInventoryItem(
          current.filter((item) => item.id !== optimisticItem.id),
          saved,
          targetId,
        ),
      );
    } catch (error) {
      setDeleteError(formatClientError(error));
      setItems((current) => current.filter((item) => item.id !== optimisticItem.id));
    }
  }

  async function openInputPanel() {
    setInputOpen((current) => !current);
    setInputError(null);

    if (inputPlans.length) {
      return;
    }

    setIsLoadingPlans(true);

    try {
      const response = await fetch("/api/inventory/input", { cache: "no-store" });
      const data = (await response.json()) as { plans?: InputPlan[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load plans");
      }

      const plans = data.plans ?? [];
      setInputPlans(plans);
      setSelectedPlanId(plans[0]?.id ?? "");
    } catch (error) {
      setInputError(formatClientError(error));
    } finally {
      setIsLoadingPlans(false);
    }
  }

  async function generateInputs() {
    setInputError(null);
    setIsGeneratingInputs(true);
    setPreviewItems([]);
    setPreviewOpen(false);

    try {
      const response = await fetch("/api/inventory/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          planId: selectedPlanId,
          prompt: inputPrompt,
        }),
      });
      const data = (await response.json()) as { items?: InventoryViewItem[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to generate inputs");
      }

      const nextItems = data.items ?? [];
      setPreviewItems(nextItems);
      setPreviewOpen(true);
    } catch (error) {
      setInputError(formatClientError(error));
    } finally {
      setIsGeneratingInputs(false);
    }
  }

  async function commitPreviewItems() {
    setInputError(null);
    setIsCommittingInputs(true);

    try {
      const response = await fetch("/api/inventory/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "commit",
          planId: selectedPlanId,
          prompt: inputPrompt,
          items: previewItems.map(toCommitItem),
        }),
      });
      const data = (await response.json()) as { items?: InventoryViewItem[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to add inputs");
      }

      const nextItems = data.items ?? [];
      setItems((current) => mergeInventoryItems(current, nextItems));
      setPreviewItems([]);
      setPreviewOpen(false);
      setInputPrompt("");
    } catch (error) {
      setInputError(formatClientError(error));
    } finally {
      setIsCommittingInputs(false);
    }
  }

  function closePreviewModal() {
    if (isCommittingInputs) {
      return;
    }

    setPreviewOpen(false);
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
          onDeleteItem={deleteItem}
          deletingIds={deletingIds}
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
          onDeleteItem={deleteItem}
          deletingIds={deletingIds}
          inputOpen={inputOpen}
          inputPlans={inputPlans}
          selectedPlanId={selectedPlanId}
          inputPrompt={inputPrompt}
          isLoadingPlans={isLoadingPlans}
          isGeneratingInputs={isGeneratingInputs}
          inputError={inputError}
          setSelectedPlanId={setSelectedPlanId}
          setInputPrompt={setInputPrompt}
          onToggleInput={openInputPanel}
          onGenerateInputs={generateInputs}
        />
      </div>

      {deleteError ? (
        <div className="mt-3 rounded-md border-2 border-[#efb16b] bg-[#fff1dc] px-3 py-2 text-sm font-semibold text-[#7a461f]">
          {deleteError}
        </div>
      ) : null}

      <InventoryInputPreviewModal
        open={previewOpen}
        items={previewItems}
        isCommitting={isCommittingInputs}
        onClose={closePreviewModal}
        onConfirm={commitPreviewItems}
      />

      <InventoryTable
        items={items}
        draggedId={draggedId}
        setDraggedId={setDraggedId}
        onDropRow={handleTableDrop}
        onUpdateItem={updateItem}
        onUpdateQuantity={updateQuantity}
        onDeleteItem={deleteItem}
        deletingIds={deletingIds}
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
  onDeleteItem,
  deletingIds,
  inputOpen = false,
  inputPlans = [],
  selectedPlanId = "",
  inputPrompt = "",
  isLoadingPlans = false,
  isGeneratingInputs = false,
  inputError = null,
  setSelectedPlanId,
  setInputPrompt,
  onToggleInput,
  onGenerateInputs,
}: {
  title: string;
  column: InventoryColumn;
  items: InventoryViewItem[];
  draggedId: string | null;
  setDraggedId: (id: string | null) => void;
  onDropColumn: (column: InventoryColumn, event: DragEvent<HTMLElement>) => void;
  onDropItem: (column: InventoryColumn, targetId: string, event: DragEvent<HTMLElement>) => void;
  onUpdateItem: (id: string, patch: Partial<InventoryViewItem>) => void;
  onUpdateQuantity: (id: string, patch: Partial<InventoryViewItem["quantity"]>) => void;
  onDeleteItem: (id: string) => void;
  deletingIds: Set<string>;
  inputOpen?: boolean;
  inputPlans?: InputPlan[];
  selectedPlanId?: string;
  inputPrompt?: string;
  isLoadingPlans?: boolean;
  isGeneratingInputs?: boolean;
  inputError?: string | null;
  setSelectedPlanId?: (planId: string) => void;
  setInputPrompt?: (prompt: string) => void;
  onToggleInput?: () => void;
  onGenerateInputs?: () => void;
}) {
  const isSell = column === "sell";
  const headingClass = isSell
    ? "pixel-gradient-sell text-[#1f4f57]"
    : "pixel-gradient-need text-[#6f3f1c]";
  const subtitle = isSell ? "Pack the wagon for market day." : "Restock before the next sunrise.";

  return (
    <section
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => onDropColumn(column, event)}
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
        {!isSell ? (
          <InputPlanner
            open={inputOpen}
            plans={inputPlans}
            selectedPlanId={selectedPlanId}
            prompt={inputPrompt}
            isLoadingPlans={isLoadingPlans}
            isGenerating={isGeneratingInputs}
            error={inputError}
            setSelectedPlanId={setSelectedPlanId}
            setPrompt={setInputPrompt}
            onToggle={onToggleInput}
            onGenerate={onGenerateInputs}
          />
        ) : null}
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
            onDropItem={(event) => onDropItem(column, item.id, event)}
            onUpdateItem={onUpdateItem}
            onUpdateQuantity={onUpdateQuantity}
            onDeleteItem={onDeleteItem}
            isDeleting={deletingIds.has(item.id)}
          />
        ))}
      </div>
    </section>
  );
}

function InputPlanner({
  open,
  plans,
  selectedPlanId,
  prompt,
  isLoadingPlans,
  isGenerating,
  error,
  setSelectedPlanId,
  setPrompt,
  onToggle,
  onGenerate,
}: {
  open: boolean;
  plans: InputPlan[];
  selectedPlanId: string;
  prompt: string;
  isLoadingPlans: boolean;
  isGenerating: boolean;
  error: string | null;
  setSelectedPlanId?: (planId: string) => void;
  setPrompt?: (prompt: string) => void;
  onToggle?: () => void;
  onGenerate?: () => void;
}) {
  return (
    <div className="rounded-md border-2 border-[#c9b88a] bg-[#fffdf5] p-2 shadow-[0_2px_0_#b29c66]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-md border-2 border-[#8b6f3e] bg-[#fff1dc] px-2 py-1.5 text-left font-mono text-xs font-black uppercase tracking-[0.12em] text-[#6f3f1c] shadow-[0_2px_0_#5e4a26] active:translate-y-0.5 active:shadow-[0_1px_0_#5e4a26]"
      >
        <PixelGlyph name="seed" className="size-4" />
        <span>Input</span>
        <span className="ml-auto">{open ? "Close" : "Open"}</span>
      </button>

      {open ? (
        <div className="mt-2 grid gap-2">
          <select
            aria-label="Select plan for generated inputs"
            value={selectedPlanId}
            onChange={(event) => setSelectedPlanId?.(event.target.value)}
            disabled={isLoadingPlans || isGenerating}
            className="h-9 rounded-md border-2 border-[#c9b88a] bg-[#fffaf0] px-2 text-sm font-semibold text-[#5f563f]"
          >
            {isLoadingPlans ? <option>Loading plans...</option> : null}
            {!isLoadingPlans && !plans.length ? <option>No plans found</option> : null}
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} · {plan.season} · {plan.objectsCount} objects
              </option>
            ))}
          </select>
          <textarea
            aria-label="Describe plan input needs"
            value={prompt}
            onChange={(event) => setPrompt?.(event.target.value)}
            disabled={isGenerating}
            placeholder="Example: I want to expand the chicken area and start more tomatoes next week."
            className="min-h-20 resize-y rounded-md border-2 border-[#c9b88a] bg-white px-2 py-2 text-sm text-[#3b2a14] outline-none focus:border-[#9bb979]"
          />
          {error ? (
            <div className="rounded-md border-2 border-[#efb16b] bg-[#fff1dc] px-2 py-1 text-xs font-semibold text-[#7a461f]">
              {error}
            </div>
          ) : null}
          <button
            type="button"
            onClick={onGenerate}
            disabled={!selectedPlanId || prompt.trim().length < 8 || isGenerating || isLoadingPlans}
            className="rounded-md border-2 border-[#8b6f3e] bg-[#e4f7f8] px-3 py-2 font-mono text-xs font-black uppercase tracking-[0.12em] text-[#245c65] shadow-[0_2px_0_#5e4a26] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? "Generating..." : "Preview required items"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function InventoryInputPreviewModal({
  open,
  items,
  isCommitting,
  onClose,
  onConfirm,
}: {
  open: boolean;
  items: InventoryViewItem[];
  isCommitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-input-preview-title"
      className="inventory-modal-backdrop fixed inset-0 z-50 grid place-items-center bg-[#1d291bcc]/70 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
        className="inventory-modal-panel pixel-frame-2 w-full max-w-2xl overflow-hidden rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] shadow-[0_6px_0_#3b2a14]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="pixel-gradient-meadow flex items-center gap-2 border-b-2 border-[#a8916a] px-3 py-2">
          <span className="grid size-8 place-items-center rounded-md border-2 border-[#8b6f3e] bg-[#fffdf5] text-[#5e4a26] shadow-[0_1px_0_#5e4a26]">
            <PixelGlyph name="seed" className="size-4" />
          </span>
          <div className="min-w-0">
            <h2
              id="inventory-input-preview-title"
              className="font-mono text-sm font-black uppercase tracking-[0.14em] text-[#2d311f]"
            >
              Confirm input list
            </h2>
            <div className="text-xs font-semibold text-[#5f563f]">{items.length} items ready to add</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isCommitting}
            className="ml-auto grid size-8 place-items-center rounded-md border-2 border-[#8b6f3e] bg-[#fffdf5] font-mono text-sm font-black text-[#5e4a26] shadow-[0_2px_0_#5e4a26] disabled:opacity-50"
            aria-label="Close input preview"
          >
            X
          </button>
        </div>

        <div className="grid max-h-[60vh] gap-2 overflow-y-auto bg-[#fcf6e4] p-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              style={{ ["--preview-item-index" as string]: index }}
              className="inventory-preview-item grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md border-2 border-[#c9b88a] bg-[#fffdf5] px-2 py-2 shadow-[0_2px_0_#b29c66]"
            >
              <InventoryToken item={item} compact />
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-[#2d311f]">{item.name}</div>
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <span className={`rounded-md border-2 px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusStyles[item.status]}`}>
                    {categoryLabels[item.category]}
                  </span>
                  <span className="rounded-md border border-[#d8c8a2] bg-[#fff8dc] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#5e4a26]">
                    {item.quantity.amount} {item.quantity.unit}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-[#68583a]">{item.notes}</p>
              </div>
              <PixelGlyph name="sparkle" className="size-5 text-[#c9a64a]" />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t-2 border-[#a8916a] bg-[#fffaf0] px-3 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isCommitting}
            className="rounded-md border-2 border-[#8b6f3e] bg-[#fffdf5] px-3 py-2 font-mono text-xs font-black uppercase tracking-[0.12em] text-[#5e4a26] shadow-[0_2px_0_#5e4a26] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!items.length || isCommitting}
            className="rounded-md border-2 border-[#4d7c48] bg-[#d8f0c2] px-3 py-2 font-mono text-xs font-black uppercase tracking-[0.12em] text-[#2f5a2b] shadow-[0_2px_0_#365833] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCommitting ? "Adding..." : "Add to inventory"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InventoryCard({
  item,
  sellMode,
  setDraggedId,
  onDropItem,
  onUpdateItem,
  onUpdateQuantity,
  onDeleteItem,
  isDeleting,
}: {
  item: InventoryViewItem;
  sellMode: boolean;
  setDraggedId: (id: string | null) => void;
  onDropItem: (event: DragEvent<HTMLElement>) => void;
  onUpdateItem: (id: string, patch: Partial<InventoryViewItem>) => void;
  onUpdateQuantity: (id: string, patch: Partial<InventoryViewItem["quantity"]>) => void;
  onDeleteItem: (id: string) => void;
  isDeleting: boolean;
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
        onDropItem(event);
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
        <div className="flex items-center justify-end gap-1">
          {sellMode ? (
            <span className="grid size-6 place-items-center rounded-md border-2 border-[#7eb3bd] bg-[#e4f7f8] text-[#245c65] shadow-[0_1px_0_#5e8a91]">
              <PixelGlyph name="wagon" className="size-3.5" />
            </span>
          ) : null}
          <button
            type="button"
            aria-label={`Delete ${item.name}`}
            disabled={isDeleting}
            onClick={(event) => {
              event.stopPropagation();
              onDeleteItem(item.id);
            }}
            className="grid size-6 place-items-center rounded-md border-2 border-[#c98989] bg-[#fff0f0] text-[#8a3434] shadow-[0_1px_0_#8b6f3e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PixelGlyph name="trash" className="size-3.5" />
          </button>
        </div>
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
  onDeleteItem,
  deletingIds,
}: {
  items: InventoryViewItem[];
  draggedId: string | null;
  setDraggedId: (id: string | null) => void;
  onDropRow: (targetId: string) => void;
  onUpdateItem: (id: string, patch: Partial<InventoryViewItem>) => void;
  onUpdateQuantity: (id: string, patch: Partial<InventoryViewItem["quantity"]>) => void;
  onDeleteItem: (id: string) => void;
  deletingIds: Set<string>;
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
        <table className="w-full min-w-[1040px] border-collapse text-left">
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
              <th className="w-[72px] px-3 py-2">Action</th>
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
                <td className="px-3 py-2">
                  <button
                    type="button"
                    aria-label={`Delete ${item.name} row`}
                    disabled={deletingIds.has(item.id)}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteItem(item.id);
                    }}
                    className="grid size-8 place-items-center rounded-md border-2 border-[#c98989] bg-[#fff0f0] text-[#8a3434] shadow-[0_1px_0_#8b6f3e] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <PixelGlyph name="trash" className="size-4" />
                  </button>
                </td>
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

function columnToPatch(column: InventoryColumn): Partial<InventoryViewItem> {
  return column === "sell"
    ? { category: "harvest", status: "ready" }
    : { category: "seeds", status: "low" };
}

function readForecastDrop(event: DragEvent<HTMLElement>) {
  const raw = event.dataTransfer.getData(yieldForecastDragType);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<InventoryPlanOutput>;

    if (typeof parsed.id !== "string" || typeof parsed.name !== "string") {
      return null;
    }

    return parsed as InventoryPlanOutput;
  } catch {
    return null;
  }
}

function forecastToInventoryItem(output: InventoryPlanOutput) {
  return {
    name: output.name,
    category: "harvest" as const,
    status: "ready" as const,
    quantity: {
      amount: 1,
      unit: output.category === "livestock" ? "dozen" : "basket",
    },
    location: "harvest station",
    source: output.source || "yield forecast",
    notes: `Added from today's yield forecast. ${output.note}`.trim(),
    color: output.color || "#6f8f55",
  };
}

function optimisticForecastInventoryItem(output: InventoryPlanOutput): InventoryViewItem {
  const now = new Date().toISOString();
  const item = forecastToInventoryItem(output);

  return {
    id: `optimistic-${output.id}-${Date.now()}`,
    ...item,
    acquiredAt: now,
    updatedAt: now,
  };
}

async function postInventoryItem(payload: ReturnType<typeof forecastToInventoryItem>) {
  const response = await fetch("/api/inventory/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as InventoryItemResponse;

  if (!response.ok || !data.item) {
    throw new Error(data.error ?? "Unable to add inventory item");
  }

  return data.item;
}

async function patchInventoryItem(id: string, patch: Partial<InventoryViewItem>) {
  const response = await fetch(`/api/inventory/items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = (await response.json()) as InventoryItemResponse;

  if (!response.ok || !data.item) {
    throw new Error(data.error ?? "Unable to update inventory item");
  }

  return data.item;
}

function insertOrMergeInventoryItem(current: InventoryViewItem[], item: InventoryViewItem, targetId?: string) {
  const withoutItem = current.filter((currentItem) => currentItem.id !== item.id);
  const targetIndex = targetId ? withoutItem.findIndex((currentItem) => currentItem.id === targetId) : -1;
  const insertIndex = targetIndex >= 0 ? targetIndex : withoutItem.length;

  return [
    ...withoutItem.slice(0, insertIndex),
    item,
    ...withoutItem.slice(insertIndex),
  ];
}

function mergeInventoryItems(current: InventoryViewItem[], next: InventoryViewItem[]) {
  const byId = new Map(current.map((item) => [item.id, item]));

  for (const item of next) {
    byId.set(item.id, item);
  }

  return Array.from(byId.values());
}

function formatClientError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

function isPersistedInventoryId(id: string) {
  return /^[0-9a-f]{24}$/i.test(id);
}

function toCommitItem(item: InventoryViewItem) {
  return {
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    reason: item.notes,
    location: item.location,
  };
}
