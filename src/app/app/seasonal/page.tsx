import { seasons } from "../_components/data";
import { ViewHeader } from "../_components/ui";

export default function SeasonalPage() {
  return (
    <section className="game-panel bg-[#e8f3b6] p-5">
      <ViewHeader
        kicker="Seasonal view"
        title="Plan the rhythm of the growing year"
        text="A season board for upcoming tasks, harvest windows, crop timing, and weather-aware planning."
      />
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {seasons.map(([season, taskA, taskB, taskC]) => (
          <article
            key={season}
            className="border-2 border-[#2d2313] bg-[#fff8dc] p-4"
          >
            <h2 className="text-2xl font-black">{season}</h2>
            <div className="mt-4 space-y-2">
              {[taskA, taskB, taskC].map((task) => (
                <div
                  key={task}
                  className="border-2 border-[#2d2313] bg-[#fff3cf] px-3 py-2 text-sm font-bold"
                >
                  {task}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
      <div className="mt-5 border-2 border-[#2d2313] bg-[#fff8dc] p-4">
        <p className="text-sm font-black uppercase text-[#2f6f4e]">
          Calendar placeholder
        </p>
        <div className="mt-3 grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }, (_, index) => (
            <div
              key={index}
              className="aspect-square border-2 border-[#d5b56f] bg-[#fff3cf]"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
