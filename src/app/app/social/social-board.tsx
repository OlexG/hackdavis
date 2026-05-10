"use client";

import Image from "next/image";
import { useState } from "react";
import { PixelGlyph, PixelIcon } from "../_components/icons";
import { PublicShopfrontPreview } from "../shop/shop-board";
import { FarmsLeafletMap } from "./farms-leaflet-map";
import type { ShopDisplaySlotView } from "@/lib/shop";
import type { SocialFarmCard, SocialFarmReview, SocialSnapshot } from "@/lib/social";

type ReviewDraft = {
  reviewerName: string;
  rating: number;
  comment: string;
};

type SocialView = "list" | "map";

export function SocialBoard({ snapshot }: { snapshot: SocialSnapshot }) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [view, setView] = useState<SocialView>("list");
  const [farms, setFarms] = useState(snapshot.farms);
  const selectedFarm = selectedUserId
    ? farms.find((farm) => farm.userId === selectedUserId)
    : undefined;

  function addReview(farmUserId: string, review: SocialFarmReview, created: boolean) {
    setFarms((current) =>
      current
        .map((farm) => {
          if (farm.userId !== farmUserId) {
            return farm;
          }

          const replaced = farm.reviews.some((item) => item.id === review.id);
          const reviews = [
            review,
            ...farm.reviews.filter((item) => item.id !== review.id),
          ].slice(0, 6);
          const reviewCount = created && !replaced ? farm.reviewCount + 1 : farm.reviewCount;
          const previousRatingTotal = replaced
            ? farm.rating * farm.reviewCount - (farm.reviews.find((item) => item.id === review.id)?.rating ?? 0)
            : farm.rating * farm.reviewCount;
          const rating = Math.round(((previousRatingTotal + review.rating) / Math.max(reviewCount, 1)) * 10) / 10;

          return {
            ...farm,
            reviews,
            reviewCount,
            rating,
            tags: Array.from(new Set([...review.tags, ...farm.tags])).slice(0, 4),
          };
        })
        .sort((left, right) => right.rating - left.rating || right.reviewCount - left.reviewCount),
    );
  }

  if (!snapshot.farms.length) {
    return (
      <section
        style={{ ["--pixel-frame-bg" as string]: "#fbf6e8" }}
        className="pixel-frame grid min-h-[calc(100vh-7rem)] place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] p-6 text-center shadow-[0_4px_0_#3b2a14]"
      >
        <div>
          <PixelIcon name="social" className="mx-auto mb-3 size-10 text-[#c95b76]" />
          <h1 className="font-mono text-lg font-black uppercase tracking-[0.16em] text-[#34432b]">
            No public farms yet
          </h1>
          <p className="mt-2 max-w-sm text-sm font-semibold text-[#6b5a35]">
            Run the seed script to add nearby farm shopfronts and example reviews.
          </p>
        </div>
      </section>
    );
  }

  if (selectedFarm) {
    return (
      <div className="mx-auto grid w-full max-w-5xl gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setSelectedUserId(null)}
            className="flex h-9 items-center gap-2 rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] px-3 font-mono text-[11px] font-black uppercase tracking-[0.1em] text-[#5e4a26] shadow-[0_2px_0_#3b2a14] transition hover:bg-[#fff3cf] active:translate-y-0.5 active:shadow-[0_1px_0_#3b2a14]"
          >
            <PixelGlyph name="basket" className="size-4" />
            Farms
          </button>
          <div className="min-w-0 text-right">
            <div className="truncate font-mono text-xs font-black uppercase tracking-[0.14em] text-[#6f3f1c]">
              {selectedFarm.farmName}
            </div>
            <div className="text-[11px] font-semibold text-[#7a6843]">
              {selectedFarm.distanceLabel} · {selectedFarm.rating.toFixed(1)} rating
            </div>
          </div>
        </div>

        <PublicShopfrontPreview snapshot={selectedFarm.snapshot} />
        <ReviewPanel
          farm={selectedFarm}
          onReviewPosted={(review, created) => addReview(selectedFarm.userId, review, created)}
        />
      </div>
    );
  }

  const farmsWithCoords = farms.filter(
    (farm) =>
      typeof farm.snapshot.details.pickupCoords?.lat === "number" &&
      typeof farm.snapshot.details.pickupCoords?.lng === "number",
  );

  return (
    <div className="mx-auto w-full max-w-6xl">
      <section
        style={{ ["--pixel-frame-bg" as string]: "#fbf6e8" }}
        className="pixel-frame overflow-hidden rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] shadow-[0_4px_0_#3b2a14]"
      >
        <div className="pixel-gradient-meadow border-b-2 border-[#3b2a14] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fff8dc] text-[#c95b76] shadow-[0_2px_0_#3b2a14]">
                <PixelIcon name="social" className="size-7" />
              </span>
              <div className="min-w-0">
                <h1 className="font-mono text-lg font-black uppercase tracking-[0.16em] text-[#34432b]">
                  Top farms nearby
                </h1>
                <p className="text-xs font-semibold text-[#5f563f]">
                  {view === "list"
                    ? `${farms.length} public ${farms.length === 1 ? "shelf" : "shelves"} to browse`
                    : `${farmsWithCoords.length} pinned on the map`}
                </p>
              </div>
            </div>
            <ViewTabs view={view} onChange={setView} />
          </div>
        </div>

        {view === "list" ? (
          <div className="grid gap-5 bg-[#fcf6e4] p-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
            {farms.map((farm) => (
              <FarmCard
                key={farm.userId}
                farm={farm}
                selected={false}
                onSelect={() => setSelectedUserId(farm.userId)}
              />
            ))}
          </div>
        ) : (
          <FarmsMapView
            farms={farmsWithCoords}
            allFarmsCount={farms.length}
            onSelect={(userId) => setSelectedUserId(userId)}
          />
        )}
      </section>
    </div>
  );
}

function ViewTabs({ view, onChange }: { view: SocialView; onChange: (next: SocialView) => void }) {
  const tabs: { value: SocialView; label: string; glyph: "ledger" | "wagon" }[] = [
    { value: "list", label: "List", glyph: "ledger" },
    { value: "map", label: "Map", glyph: "wagon" },
  ];
  return (
    <div className="flex rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] p-1 shadow-[0_2px_0_#3b2a14]">
      {tabs.map((tab) => {
        const active = view === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`flex h-8 items-center gap-1.5 px-3 font-mono text-[11px] font-black uppercase tracking-[0.1em] transition ${
              active ? "bg-[#365833] text-[#fffdf5]" : "bg-transparent text-[#5e4a26] hover:bg-[#fff3cf]"
            }`}
          >
            <PixelGlyph name={tab.glyph} className="size-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function FarmCard({
  farm,
  selected,
  onSelect,
}: {
  farm: SocialFarmCard;
  selected: boolean;
  onSelect: () => void;
}) {
  const visibleSlots = farm.snapshot.slots.filter((slot) => slot.visible).slice(0, 3);

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{ ["--pixel-frame-bg" as string]: "#fcf6e4" }}
      className={`pixel-frame grid gap-2 rounded-none border-2 bg-[#fffdf5] p-2.5 text-left shadow-[0_2px_0_#b29c66] transition ${
        selected ? "border-[#3b2a14] shadow-[0_4px_0_#3b2a14]" : "border-[#c9b88a] hover:-translate-y-0.5 hover:shadow-[0_3px_0_#8b6f3e]"
      }`}
    >
      <ShopImageRow slots={visibleSlots} />

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-black leading-tight text-[#2d311f]">
            {farm.farmName}
          </h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#7a6843]">
            <span className="text-[#335a2d]">{farm.distanceLabel}</span>
            <span aria-hidden>·</span>
            <span className="text-[#a8761c]">★ {farm.rating.toFixed(1)}</span>
            <span aria-hidden>·</span>
            <span>{farm.reviewCount} reviews</span>
          </div>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fff3cf] text-[#5e4a26] shadow-[0_2px_0_#3b2a14]">
          <PixelGlyph name="wagon" className="size-4" />
        </span>
      </div>
    </button>
  );
}

function ReviewPanel({
  farm,
  onReviewPosted,
}: {
  farm: SocialFarmCard;
  onReviewPosted: (review: SocialFarmReview, created: boolean) => void;
}) {
  const [draft, setDraft] = useState<ReviewDraft>({ reviewerName: "", rating: 5, comment: "" });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submitReview() {
    setStatus("saving");
    setError(null);

    try {
      const response = await fetch("/api/social/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmUserId: farm.userId,
          reviewerName: draft.reviewerName,
          rating: draft.rating,
          comment: draft.comment,
        }),
      });
      const data = (await response.json()) as { review?: SocialFarmReview; created?: boolean; error?: string };

      if (!response.ok || !data.review) {
        throw new Error(data.error ?? "Unable to post review");
      }

      onReviewPosted(data.review, data.created ?? true);
      setDraft({ reviewerName: "", rating: 5, comment: "" });
      setStatus("saved");
    } catch (reviewError) {
      setStatus("error");
      setError(reviewError instanceof Error ? reviewError.message : "Unable to post review");
    }
  }

  return (
    <section
      style={{ ["--pixel-frame-bg" as string]: "#fbf6e8" }}
      className="pixel-frame overflow-hidden rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] shadow-[0_4px_0_#3b2a14]"
    >
      <div className="pixel-gradient-need flex flex-wrap items-center gap-2 border-b-2 border-[#3b2a14] px-3 py-2">
        <PixelGlyph name="basket" className="size-5 text-[#6f3f1c]" />
        <h2 className="font-mono text-sm font-black uppercase tracking-[0.14em] text-[#6f3f1c]">
          Reviews
        </h2>
        <span className="ml-auto rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#6f3f1c] shadow-[0_1px_0_#3b2a14]">
          {farm.rating.toFixed(1)} · {farm.reviewCount}
        </span>
      </div>

      <div className="grid gap-3 bg-[#fcf6e4] p-3">
        <div
          style={{ ["--pixel-frame-bg" as string]: "#fcf6e4" }}
          className="pixel-frame grid gap-2 rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] p-3 shadow-[0_3px_0_#8b6f3e]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-mono text-[11px] font-black uppercase tracking-[0.14em] text-[#6f3f1c]">
              Leave a review
            </div>
            <StarPicker
              value={draft.rating}
              onChange={(rating) => setDraft((current) => ({ ...current, rating }))}
              label={`Rate ${farm.farmName}`}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
            <input
              value={draft.reviewerName}
              onChange={(event) => setDraft((current) => ({ ...current, reviewerName: event.target.value }))}
              placeholder="Your name"
              className="h-10 min-w-0 rounded-none border-2 border-[#c9b88a] bg-white px-2 text-sm font-bold text-[#365833] outline-none focus:border-[#9bb979]"
            />
            <input
              value={draft.comment}
              onChange={(event) => setDraft((current) => ({ ...current, comment: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && status !== "saving") {
                  event.preventDefault();
                  submitReview();
                }
              }}
              placeholder="What was good about this farm?"
              className="h-10 min-w-0 rounded-none border-2 border-[#c9b88a] bg-white px-2 text-sm font-bold text-[#365833] outline-none focus:border-[#9bb979]"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`font-mono text-[10px] font-black uppercase tracking-[0.1em] ${
              status === "error" ? "text-[#a8761c]" : "text-[#7a6843]"
            }`}>
              {status === "saving"
                ? "Posting review"
                : status === "saved"
                  ? "Review posted"
                  : error ?? "Reviews are public example community notes"}
            </p>
            <button
              type="button"
              onClick={submitReview}
              disabled={status === "saving"}
              className="rounded-none border-2 border-[#3b2a14] bg-[#fff3cf] px-3 py-1.5 font-mono text-[11px] font-black uppercase tracking-[0.1em] text-[#5e4a26] shadow-[0_2px_0_#3b2a14] transition hover:bg-[#ffe89a] active:translate-y-0.5 active:shadow-[0_1px_0_#3b2a14] disabled:opacity-60"
            >
              {status === "saving" ? "Posting" : "Post review"}
            </button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {farm.reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ReviewCard({ review }: { review: SocialFarmReview }) {
  return (
    <article className="rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] p-2 shadow-[0_2px_0_#b29c66]">
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-sm font-black text-[#2d311f]">{review.reviewerName}</div>
        <RatingStars rating={review.rating} />
      </div>
      <p className="mt-1 text-xs font-semibold leading-snug text-[#6b5a35]">{review.comment}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {review.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-none border border-[#9bc278] bg-[#eef8df] px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.08em] text-[#335a2d]"
          >
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}

function FarmsMapView({
  farms,
  allFarmsCount,
  onSelect,
}: {
  farms: SocialFarmCard[];
  allFarmsCount: number;
  onSelect: (userId: string) => void;
}) {
  const [activeUserId, setActiveUserId] = useState<string | null>(farms[0]?.userId ?? null);

  if (!farms.length) {
    return (
      <div className="grid place-items-center bg-[#fcf6e4] p-8 text-center">
        <div>
          <PixelGlyph name="wagon" className="mx-auto mb-2 size-8 text-[#c9a64a]" />
          <p className="font-mono text-xs font-black uppercase tracking-[0.12em] text-[#7a6843]">
            No farms have dropped a pin yet
          </p>
          <p className="mt-1 max-w-xs text-[11px] text-[#9a8a66]">
            {allFarmsCount} farms are listed but none have shared a pickup location.
            Check back soon, or browse the list view.
          </p>
        </div>
      </div>
    );
  }

  const activeFarm = farms.find((farm) => farm.userId === activeUserId) ?? farms[0];

  return (
    <div className="grid gap-3 bg-[#fcf6e4] p-3">
      <div
        style={{ ["--pixel-frame-bg" as string]: "#fcf6e4" }}
        className="pixel-frame relative overflow-hidden rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] shadow-[0_3px_0_#3b2a14]"
      >
        <FarmsLeafletMap
          farms={farms}
          activeUserId={activeFarm?.userId ?? null}
          onSelect={(userId) => setActiveUserId(userId)}
        />
      </div>

      {activeFarm ? (
        <div
          style={{ ["--pixel-frame-bg" as string]: "#fcf6e4" }}
          className="pixel-frame grid gap-3 rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] p-3 shadow-[0_3px_0_#3b2a14] sm:grid-cols-[160px_1fr_auto] sm:items-center"
        >
          <ShopImageRow slots={activeFarm.snapshot.slots.filter((slot) => slot.visible).slice(0, 3)} />
          <div className="min-w-0">
            <h3 className="truncate text-base font-black text-[#2d311f]">{activeFarm.farmName}</h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#7a6843]">
              <span className="text-[#335a2d]">{activeFarm.distanceLabel}</span>
              <span aria-hidden>·</span>
              <span className="text-[#a8761c]">★ {activeFarm.rating.toFixed(1)}</span>
              <span aria-hidden>·</span>
              <span>{activeFarm.reviewCount} reviews</span>
            </div>
            <p className="mt-1 truncate text-xs font-semibold text-[#6b5a35]">
              {activeFarm.snapshot.details.pickupLocation || "Pickup details on the shopfront"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelect(activeFarm.userId)}
            className="inline-flex h-9 items-center gap-2 rounded-none border-2 border-[#3b2a14] bg-[#7da854] px-3 font-mono text-[11px] font-black uppercase tracking-[0.1em] text-[#fffdf5] shadow-[0_2px_0_#3b2a14] transition hover:bg-[#9bc278] active:translate-y-0.5 active:shadow-[0_1px_0_#3b2a14]"
          >
            <PixelGlyph name="wagon" className="size-3.5" />
            Visit shopfront
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ShopImageRow({ slots }: { slots: ShopDisplaySlotView[] }) {
  if (!slots.length) {
    return (
      <div className="grid h-20 place-items-center rounded-none border-2 border-dashed border-[#c9b88a] bg-[#fff8dc] text-center font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#9a8a66]">
        Shelf is being restocked
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {slots.map((slot) => (
        <ShopImageTile key={slot.inventoryItemId} slot={slot} />
      ))}
      {Array.from({ length: Math.max(0, 3 - slots.length) }).map((_, index) => (
        <span
          key={`empty-${index}`}
          className="grid h-20 place-items-center rounded-none border-2 border-dashed border-[#d4c39a] bg-[#fff8dc]/70"
        >
          <PixelGlyph name="basket" className="size-5 text-[#c9a64a]" />
        </span>
      ))}
    </div>
  );
}

function ShopImageTile({ slot }: { slot: ShopDisplaySlotView }) {
  return (
    <span
      className="relative grid h-20 place-items-center overflow-hidden rounded-none border-2 border-[#3b2a14] bg-[#fff8dc] shadow-[0_2px_0_#5e4a26]"
      style={
        slot.imageUrl
          ? undefined
          : {
              backgroundColor: slot.item.color,
              backgroundImage:
                "linear-gradient(135deg, rgba(255,255,255,0.24) 25%, transparent 25% 50%, rgba(59,42,20,0.08) 50% 75%, transparent 75%)",
              backgroundSize: "6px 6px",
            }
      }
    >
      {slot.imageUrl ? (
        <Image
          src={slot.imageUrl}
          alt={`${slot.item.name} photo`}
          fill
          sizes="(max-width: 768px) 33vw, 200px"
          className="object-cover"
          unoptimized
        />
      ) : null}
      <span className="absolute inset-x-1 bottom-1 truncate rounded-none border border-[#3b2a14] bg-[#fffdf5]/95 px-1 py-0.5 text-center text-[10px] font-black leading-tight text-[#2d311f]">
        {slot.item.name}
      </span>
    </span>
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="font-mono text-[11px] font-black tracking-[0.04em] text-[#c98225]" aria-label={`${rating} stars`}>
      {Array.from({ length: 5 }).map((_, index) => (index < Math.round(rating) ? "★" : "☆")).join("")}
    </span>
  );
}

function StarPicker({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (rating: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-0.5" aria-label={label}>
      {Array.from({ length: 5 }).map((_, index) => {
        const rating = index + 1;

        return (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            className={`grid size-6 place-items-center rounded-none border font-mono text-xs font-black shadow-[0_1px_0_#8b6f3e] transition active:translate-y-0.5 ${
              rating <= value
                ? "border-[#8b6f3e] bg-[#ffe89a] text-[#7a461f]"
                : "border-[#c9b88a] bg-[#fffdf5] text-[#9a8a66] hover:bg-[#fff3cf]"
            }`}
            aria-label={`${rating} stars`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
