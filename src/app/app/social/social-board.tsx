"use client";

import Image from "next/image";
import { useState } from "react";
import { PixelGlyph, PixelIcon } from "../_components/icons";
import { PublicShopfrontPreview } from "../shop/shop-board";
import type { ShopDisplaySlotView } from "@/lib/shop";
import type { SocialFarmCard, SocialSnapshot } from "@/lib/social";

export function SocialBoard({ snapshot }: { snapshot: SocialSnapshot }) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const selectedFarm = selectedUserId
    ? snapshot.farms.find((farm) => farm.userId === selectedUserId)
    : undefined;

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
          personalRating={ratings[selectedFarm.userId] ?? 0}
          onRate={(rating) => setRatings((current) => ({ ...current, [selectedFarm.userId]: rating }))}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <section
        style={{ ["--pixel-frame-bg" as string]: "#fbf6e8" }}
        className="pixel-frame overflow-hidden rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] shadow-[0_4px_0_#3b2a14]"
      >
        <div className="pixel-gradient-meadow border-b-2 border-[#3b2a14] p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fff8dc] text-[#c95b76] shadow-[0_2px_0_#3b2a14]">
              <PixelIcon name="social" className="size-7" />
            </span>
            <div className="min-w-0">
              <h1 className="font-mono text-lg font-black uppercase tracking-[0.16em] text-[#34432b]">
                Top farms nearby
              </h1>
              <p className="text-xs font-semibold text-[#5f563f]">
                See public shelves, ratings, and neighbor notes
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 bg-[#fcf6e4] p-3 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.farms.map((farm) => (
            <FarmCard
              key={farm.userId}
              farm={farm}
              selected={false}
              personalRating={ratings[farm.userId] ?? 0}
              onSelect={() => setSelectedUserId(farm.userId)}
              onRate={(rating) => setRatings((current) => ({ ...current, [farm.userId]: rating }))}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function FarmCard({
  farm,
  selected,
  personalRating,
  onSelect,
  onRate,
}: {
  farm: SocialFarmCard;
  selected: boolean;
  personalRating: number;
  onSelect: () => void;
  onRate: (rating: number) => void;
}) {
  const previewItems = farm.availablePreview.length
    ? farm.availablePreview.join(" · ")
    : "Shelf is being restocked";

  return (
    <article
      style={{ ["--pixel-frame-bg" as string]: "#fcf6e4" }}
      className={`pixel-frame rounded-none border-2 bg-[#fffdf5] p-3 shadow-[0_2px_0_#b29c66] transition ${
        selected ? "border-[#3b2a14] shadow-[0_4px_0_#3b2a14]" : "border-[#c9b88a] hover:-translate-y-0.5"
      }`}
    >
      <button type="button" onClick={onSelect} className="grid w-full gap-2 text-left">
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#eef8df] text-[#365833] shadow-[0_2px_0_#6f8d45]">
            <PixelIcon name="farm" className="size-7" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="min-w-0 truncate text-base font-black leading-tight text-[#2d311f]">
                {farm.farmName}
              </h2>
              <span className="rounded-none border border-[#9bc278] bg-[#eef8df] px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.08em] text-[#335a2d]">
                {farm.distanceLabel}
              </span>
            </div>
            <p className="mt-0.5 text-xs font-semibold leading-snug text-[#6b5a35]">
              {farm.bio}
            </p>
          </div>
          <RatingBadge rating={farm.rating} count={farm.reviewCount} />
        </div>

        <div className="rounded-none border-2 border-[#e1d0a8] bg-[#fffaf0] px-2 py-1.5 text-xs font-black leading-snug text-[#6f3f1c]">
          {previewItems}
        </div>

        <ShopImageRow slots={farm.snapshot.slots.filter((slot) => slot.visible).slice(0, 3)} />
      </button>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {farm.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-none border border-[#d8a05a] bg-[#fff4dc] px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.08em] text-[#7a461f]"
            >
              {tag}
            </span>
          ))}
        </div>
        <StarPicker value={personalRating} onChange={onRate} label={`Rate ${farm.farmName}`} />
      </div>
    </article>
  );
}

function ReviewPanel({
  farm,
  personalRating,
  onRate,
}: {
  farm: SocialFarmCard;
  personalRating: number;
  onRate: (rating: number) => void;
}) {
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
        <div className="ml-auto">
          <StarPicker value={personalRating} onChange={onRate} label={`Rate ${farm.farmName}`} />
        </div>
      </div>

      <div className="grid gap-2 bg-[#fcf6e4] p-3 sm:grid-cols-3">
        {farm.reviews.map((review) => (
          <article
            key={review.id}
            className="rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] p-2 shadow-[0_2px_0_#b29c66]"
          >
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
        ))}
      </div>
    </section>
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

function RatingBadge({ rating, count }: { rating: number; count: number }) {
  return (
    <span className="shrink-0 rounded-none border-2 border-[#3b2a14] bg-[#fff3cf] px-2 py-1 text-center font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#6f3f1c] shadow-[0_2px_0_#3b2a14]">
      {rating.toFixed(1)} / {count}
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
