import type { ReactNode } from "react";

export function ViewHeader({
  kicker,
  title,
  text,
}: {
  kicker: string;
  title: string;
  text: string;
}) {
  return (
    <div>
      <p className="text-sm font-black uppercase text-[#8a3c2f]">{kicker}</p>
      <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-3xl text-base leading-7 text-[#5f4b2c]">
        {text}
      </p>
    </div>
  );
}

export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="border-2 border-[#2d2313] bg-[#fff8dc] p-4">
      <h2 className="text-sm font-black uppercase text-[#2f6f4e]">{title}</h2>
      <div className="mt-3">{children}</div>
    </article>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="grid min-h-40 place-items-center border-2 border-dashed border-[#a77d46] bg-[#fff3cf] p-6 text-center text-sm font-bold text-[#8a6a3c]">
      {text}
    </div>
  );
}

export function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-[#fff8dc] p-2">
      <p className="text-lg font-black">{value}</p>
      <p className="text-[10px] font-bold uppercase">{label}</p>
    </div>
  );
}

export function BigStat({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="border-2 border-[#2d2313] p-3" style={{ background: color }}>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-[10px] font-bold uppercase">{label}</p>
    </div>
  );
}

export function Meter({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-black uppercase">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-4 border-2 border-[#2d2313] bg-[#fff3cf]">
        <div className="h-full bg-[#4e9f5d]" style={{ width: value }} />
      </div>
    </div>
  );
}
