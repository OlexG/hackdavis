"use client";

import { useMemo, useRef, useState } from "react";
import { PixelGlyph } from "../_components/icons";
import { PickupPinMap } from "./pickup-map";
import type {
  ShopHoursSchedule,
  ShopPaymentDetails,
  ShopPaymentMethod,
  ShopPaymentMethodKind,
  ShopPickupCoords,
} from "@/lib/models";

const dayLongLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekdayMask = [false, true, true, true, true, true, false];
const weekendMask = [true, false, false, false, false, false, true];

const paymentPresets: { kind: ShopPaymentMethodKind; label: string; placeholder: string; glyph: "wagon" | "basket" | "scroll" | "leaf" | "sun" | "jar" }[] = [
  { kind: "venmo", label: "Venmo", placeholder: "@handle", glyph: "scroll" },
  { kind: "cashapp", label: "Cash App", placeholder: "$cashtag", glyph: "scroll" },
  { kind: "zelle", label: "Zelle", placeholder: "phone or email", glyph: "scroll" },
  { kind: "paypal", label: "PayPal", placeholder: "@handle", glyph: "scroll" },
  { kind: "cash", label: "Cash", placeholder: "", glyph: "basket" },
  { kind: "card", label: "Card", placeholder: "", glyph: "basket" },
  { kind: "check", label: "Check", placeholder: "payable to…", glyph: "leaf" },
  { kind: "trade", label: "Trade", placeholder: "what you'll swap for", glyph: "wagon" },
];

export function HoursSelector({
  value,
  onChange,
}: {
  value: ShopHoursSchedule | undefined;
  onChange: (next: ShopHoursSchedule | undefined) => void;
}) {
  const days = value?.days ?? [];
  const open = value?.openMinutes ?? 9 * 60;
  const close = value?.closeMinutes ?? 17 * 60;
  const note = value?.note ?? "";

  function commit(next: Partial<ShopHoursSchedule>) {
    const merged: ShopHoursSchedule = {
      days: next.days ?? days,
      openMinutes: next.openMinutes ?? open,
      closeMinutes: next.closeMinutes ?? close,
      note: next.note ?? note,
    };

    if (!merged.days.length) {
      onChange(undefined);
      return;
    }
    if (!merged.note) {
      delete merged.note;
    }
    onChange(merged);
  }

  function toggleDay(day: number) {
    const set = new Set(days);
    if (set.has(day)) {
      set.delete(day);
    } else {
      set.add(day);
    }
    commit({ days: [...set].sort((left, right) => left - right) });
  }

  function applyPreset(mask: boolean[]) {
    const next = mask
      .map((on, index) => (on ? index : -1))
      .filter((index) => index >= 0);
    commit({ days: next });
  }

  return (
    <div className="grid gap-2">
      <span className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#7a6843]">
        <PixelGlyph name="sun" className="size-4" />
        Open days &amp; hours
      </span>

      <div className="grid grid-cols-7 gap-1">
        {dayLongLabels.map((long, index) => {
          const active = days.includes(index);
          return (
            <button
              key={index}
              type="button"
              onClick={() => toggleDay(index)}
              aria-pressed={active}
              aria-label={`Toggle ${long}`}
              className={`grid h-9 min-w-0 place-items-center rounded-none border-2 font-mono text-[11px] font-black uppercase tracking-[0.04em] shadow-[0_2px_0_#3b2a14] transition active:translate-y-0.5 active:shadow-[0_1px_0_#3b2a14] ${
                active
                  ? "border-[#3b2a14] bg-[#7da854] text-[#fffdf5]"
                  : "border-[#8b6f3e] bg-[#fff8dc] text-[#7a6843] hover:bg-[#fff3cf]"
              }`}
            >
              {long.slice(0, 3)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <PresetButton label="Weekdays" onClick={() => applyPreset(weekdayMask)} />
        <PresetButton label="Weekends" onClick={() => applyPreset(weekendMask)} />
        <PresetButton label="Every day" onClick={() => applyPreset([true, true, true, true, true, true, true])} />
        <PresetButton label="Clear" onClick={() => applyPreset([false, false, false, false, false, false, false])} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <TimeField
          label="Open"
          value={open}
          disabled={!days.length}
          onChange={(next) => commit({ openMinutes: next })}
        />
        <TimeField
          label="Close"
          value={close}
          disabled={!days.length}
          onChange={(next) => commit({ closeMinutes: next })}
        />
      </div>

      <input
        value={note}
        placeholder="Optional note (e.g. closed holidays)"
        onChange={(event) => commit({ note: event.target.value })}
        className="h-9 min-w-0 rounded-none border-2 border-[#c9b88a] bg-white px-2 text-sm font-bold text-[#365833] outline-none focus:border-[#9bb979]"
      />

      {!days.length ? (
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#7a6843]">
          Pick at least one day to set hours.
        </p>
      ) : null}
    </div>
  );
}

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-none border-2 border-[#8b6f3e] bg-[#fffdf5] px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#5e4a26] shadow-[0_2px_0_#5e4a26] transition hover:bg-[#fff3cf] active:translate-y-0.5 active:shadow-[0_1px_0_#5e4a26]"
    >
      {label}
    </button>
  );
}

function TimeField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  const time = `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  return (
    <label className="grid gap-1">
      <span className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#7a6843]">
        {label}
      </span>
      <input
        type="time"
        value={time}
        disabled={disabled}
        onChange={(event) => {
          const [hh, mm] = event.target.value.split(":");
          const minutes = (Number(hh) || 0) * 60 + (Number(mm) || 0);
          onChange(minutes);
        }}
        className="h-9 min-w-0 rounded-none border-2 border-[#c9b88a] bg-white px-2 font-mono text-sm font-bold text-[#365833] outline-none focus:border-[#9bb979] disabled:bg-[#f6efd6] disabled:text-[#9a8a66]"
      />
    </label>
  );
}

type GeoResult = { displayName: string; lat: number; lng: number };

export function PickupLocationSelector({
  address,
  coords,
  onAddressChange,
  onCoordsChange,
}: {
  address: string;
  coords: ShopPickupCoords | undefined;
  onAddressChange: (address: string) => void;
  onCoordsChange: (coords: ShopPickupCoords | undefined) => void;
}) {
  const [query, setQuery] = useState(address);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const lastQuery = useRef("");

  async function runSearch(input: string) {
    const trimmed = input.trim();
    if (trimmed.length < 3) {
      setError("Type at least 3 characters to search.");
      setResults([]);
      return;
    }
    if (trimmed === lastQuery.current && results.length) {
      return;
    }
    setIsSearching(true);
    setError(null);
    setSearched(true);
    lastQuery.current = trimmed;

    try {
      const response = await fetch(`/api/geo/search?q=${encodeURIComponent(trimmed)}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as { results?: GeoResult[] };
      const nextResults = Array.isArray(data.results) ? data.results : [];
      setResults(nextResults);
      if (nextResults[0]) {
        dropPin(nextResults[0], true);
      } else {
        setPinMessage(null);
      }
    } catch {
      setError("Search is unavailable right now.");
      setResults([]);
      setPinMessage(null);
    } finally {
      setIsSearching(false);
    }
  }

  function dropPin(result: GeoResult, keepResults = false) {
    onAddressChange(result.displayName);
    onCoordsChange({ lat: result.lat, lng: result.lng });
    setQuery(result.displayName);
    setPinMessage("Pin dropped");
    if (!keepResults) {
      setResults([]);
    }
  }

  function clearPin() {
    onCoordsChange(undefined);
    setPinMessage(null);
  }

  return (
    <div className="grid gap-2">
      <span className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#7a6843]">
        <PixelGlyph name="wagon" className="size-4" />
        Pickup location
      </span>

      <div className="flex gap-1.5">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            onAddressChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              runSearch(query);
            }
          }}
          placeholder="123 Apple Ln, Davis CA"
          className="h-9 min-w-0 flex-1 rounded-none border-2 border-[#c9b88a] bg-white px-2 text-sm font-bold text-[#365833] outline-none focus:border-[#9bb979]"
        />
        <button
          type="button"
          onClick={() => runSearch(query)}
          disabled={isSearching}
          className="rounded-none border-2 border-[#3b2a14] bg-[#fff3cf] px-3 font-mono text-[11px] font-black uppercase tracking-[0.1em] text-[#5e4a26] shadow-[0_2px_0_#3b2a14] transition hover:bg-[#ffe89a] active:translate-y-0.5 active:shadow-[0_1px_0_#3b2a14] disabled:opacity-60"
        >
          {isSearching ? "…" : "Search"}
        </button>
      </div>

      {error ? (
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#a8761c]">{error}</p>
      ) : null}
      {pinMessage && coords ? (
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#365833]">{pinMessage}</p>
      ) : null}

      {results.length ? (
        <ul className="grid gap-1 rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] p-1.5">
          {results.map((result) => (
            <li key={`${result.lat},${result.lng}`}>
              <button
                type="button"
                onClick={() => dropPin(result)}
                className="flex w-full items-start gap-2 rounded-none border-2 border-transparent bg-transparent px-2 py-1.5 text-left text-xs font-bold text-[#365833] hover:border-[#c9b88a] hover:bg-[#fff8dc]"
              >
                <PixelGlyph name="leaf" className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0 flex-1">{result.displayName}</span>
                <span className="shrink-0 font-mono text-[9px] font-black uppercase tracking-[0.1em] text-[#7a6843]">
                  Drop pin
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : searched && !isSearching && !error ? (
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#7a6843]">
          No matches found.
        </p>
      ) : null}

      {coords ? (
        <PickupPinMap coords={coords} label={address} onClear={clearPin} />
      ) : (
        <div className="grid place-items-center rounded-none border-2 border-dashed border-[#c9b88a] bg-[#fffdf5] py-6 text-center">
          <PixelGlyph name="wagon" className="mx-auto mb-1 size-6 text-[#c9a64a]" />
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#7a6843]">
            Search to drop a pin on the map
          </p>
        </div>
      )}
    </div>
  );
}

export function PaymentSelector({
  value,
  onChange,
}: {
  value: ShopPaymentDetails | undefined;
  onChange: (next: ShopPaymentDetails | undefined) => void;
}) {
  const methods = useMemo(() => value?.methods ?? [], [value?.methods]);
  const note = value?.note ?? "";
  const methodMap = useMemo(() => {
    const map = new Map<ShopPaymentMethodKind, ShopPaymentMethod>();
    methods.forEach((method) => map.set(method.kind, method));
    return map;
  }, [methods]);

  function commit(nextMethods: ShopPaymentMethod[], nextNote: string) {
    if (!nextMethods.length && !nextNote) {
      onChange(undefined);
      return;
    }
    onChange({
      methods: nextMethods,
      ...(nextNote ? { note: nextNote } : {}),
    });
  }

  function toggleMethod(kind: ShopPaymentMethodKind) {
    const next = methodMap.has(kind)
      ? methods.filter((method) => method.kind !== kind)
      : [...methods, { kind } as ShopPaymentMethod];
    commit(next, note);
  }

  function updateHandle(kind: ShopPaymentMethodKind, handle: string) {
    const next = methods.map((method) =>
      method.kind === kind
        ? handle
          ? { kind, handle }
          : { kind }
        : method,
    );
    commit(next, note);
  }

  return (
    <div className="grid gap-2">
      <span className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#7a6843]">
        <PixelGlyph name="basket" className="size-4" />
        Payment or trade
      </span>

      <div className="flex flex-wrap gap-1.5">
        {paymentPresets.map((preset) => {
          const selected = methodMap.has(preset.kind);
          return (
            <button
              key={preset.kind}
              type="button"
              onClick={() => toggleMethod(preset.kind)}
              aria-pressed={selected}
              className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-none border-2 px-3 font-mono text-[11px] font-black uppercase tracking-[0.08em] shadow-[0_2px_0_#3b2a14] transition active:translate-y-0.5 active:shadow-[0_1px_0_#3b2a14] ${
                selected
                  ? "border-[#3b2a14] bg-[#7da854] text-[#fffdf5]"
                  : "border-[#8b6f3e] bg-[#fff8dc] text-[#5e4a26] hover:bg-[#fff3cf]"
              }`}
            >
              <PixelGlyph name={preset.glyph} className="size-3.5 shrink-0" />
              {preset.label}
            </button>
          );
        })}
      </div>

      {methods.length ? (
        <div className="grid gap-1.5">
          {methods.map((method) => {
            const preset = paymentPresets.find((p) => p.kind === method.kind);
            if (!preset || !preset.placeholder) return null;
            return (
              <label
                key={method.kind}
                className="grid grid-cols-[88px_1fr] items-center gap-2 rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] px-2 py-1.5"
              >
                <span className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#7a6843]">
                  {preset.label}
                </span>
                <input
                  value={method.handle ?? ""}
                  onChange={(event) => updateHandle(method.kind, event.target.value)}
                  placeholder={preset.placeholder}
                  className="h-8 min-w-0 rounded-none border-2 border-[#c9b88a] bg-white px-2 text-sm font-bold text-[#365833] outline-none focus:border-[#9bb979]"
                />
              </label>
            );
          })}
        </div>
      ) : null}

      <input
        value={note}
        placeholder="Optional note (e.g. exact change preferred)"
        onChange={(event) => commit(methods, event.target.value)}
        className="h-9 min-w-0 rounded-none border-2 border-[#c9b88a] bg-white px-2 text-sm font-bold text-[#365833] outline-none focus:border-[#9bb979]"
      />
    </div>
  );
}
