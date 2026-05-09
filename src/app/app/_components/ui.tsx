import type { ReactNode } from "react";

export function AppPage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <section className="min-h-[calc(100vh-7rem)] rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Workspace
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-800">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>
      <div className="p-6">{children ?? <BlankState />}</div>
    </section>
  );
}

export function BlankState() {
  return (
    <div className="min-h-[420px] rounded-md border border-dashed border-slate-300 bg-slate-50" />
  );
}
