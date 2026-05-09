import { impactRows } from "../_components/data";
import { Panel, ViewHeader } from "../_components/ui";

export default function ImpactPage() {
  return (
    <section className="game-panel bg-[#d9f0e1] p-5">
      <ViewHeader
        kicker="Ecological impact view"
        title="Track the farm's footprint and local food advantage"
        text="A scorecard for water usage, carbon output, and comparisons against large farms and grocery purchasing."
      />
      <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="border-2 border-[#2d2313] bg-[#fff8dc] p-5 text-center">
          <p className="text-sm font-black uppercase text-[#2f6f4e]">
            Ecological impact score
          </p>
          <p className="mt-4 text-8xl font-black text-[#2f6f4e]">B+</p>
          <p className="mt-3 text-sm leading-6 text-[#5f4b2c]">
            Placeholder grade based on planned local trade, lower food miles,
            and moderate water demand.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {impactRows.map(([label, value, note]) => (
            <Panel key={label} title={label}>
              <p className="text-3xl font-black">{value}</p>
              <p className="mt-2 text-sm leading-6 text-[#5f4b2c]">{note}</p>
            </Panel>
          ))}
        </div>
      </div>
    </section>
  );
}
