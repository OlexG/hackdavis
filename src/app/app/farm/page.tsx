import { EmptyState, Panel, ViewHeader } from "../_components/ui";
import { plots } from "../_components/data";

export default function FarmPage() {
  return (
    <section className="game-panel bg-[#fff8dc] p-5">
      <ViewHeader
        kicker="Main farm graphical view"
        title="Partitioned space and upcoming harvests"
        text="A blank farm canvas for plot planning, crop placement, paths, water, animals, buildings, and harvest projections."
      />
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="farm-board min-h-[520px] border-2 border-[#2d2313] bg-[#7ab16f] p-4">
          <div className="grid h-full grid-cols-8 gap-2">
            {plots.map((plot) => (
              <div
                key={plot}
                className="min-h-12 border-2 border-[#7a5638] bg-[#c98852]"
              />
            ))}
          </div>
        </div>
        <div className="grid gap-4">
          <Panel title="Producing next">
            <EmptyState text="No crops assigned yet." />
          </Panel>
          <Panel title="Next harvest">
            <EmptyState text="Harvest windows will appear here." />
          </Panel>
        </div>
      </div>
    </section>
  );
}
