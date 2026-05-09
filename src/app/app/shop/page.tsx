import { costs, shopStats } from "../_components/data";
import { Meter, Panel, ViewHeader } from "../_components/ui";

export default function ShopPage() {
  return (
    <section className="game-panel bg-[#fff8dc] p-5">
      <ViewHeader
        kicker="Cost / earnings / shop view"
        title="Decide what to keep, sell, list, and spend"
        text="A shop-style control room for yield estimates, harvest windows, local marketplace posting, reviews, and cost breakdowns."
      />
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="grid gap-4 md:grid-cols-2">
          {shopStats.map(([label, value, text]) => (
            <Panel key={label} title={label}>
              <p className="text-4xl font-black">{value}</p>
              <p className="mt-2 text-sm leading-6 text-[#5f4b2c]">{text}</p>
            </Panel>
          ))}
          <Panel title="Yield / harvest windows">
            <div className="space-y-3">
              <Meter label="Early window" value="35%" />
              <Meter label="Peak window" value="70%" />
              <Meter label="Late window" value="48%" />
            </div>
          </Panel>
          <Panel title="Shop ratings / reviews">
            <p className="text-3xl font-black">New shop</p>
            <p className="mt-2 text-sm leading-6 text-[#5f4b2c]">
              Ratings and buyer reviews will appear after the first local trade.
            </p>
          </Panel>
        </div>
        <Panel title="Cost breakdown">
          <div className="space-y-3">
            {costs.map(([label, cost, note]) => (
              <div
                key={label}
                className="grid grid-cols-[1fr_auto] gap-3 border-2 border-[#2d2313] bg-[#fff3cf] p-3"
              >
                <p className="font-black">{label}</p>
                <p className="font-mono font-black">{cost}</p>
                <p className="col-span-2 text-sm text-[#5f4b2c]">{note}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </section>
  );
}
