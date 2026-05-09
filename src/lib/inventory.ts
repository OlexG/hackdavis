import { getMongoDb } from "@/lib/mongodb";
import type { CatalogItem, InventoryCategory, InventoryItem, InventoryStatus, Plan } from "@/lib/models";

const demoUserEmail = "test@gmail.com";

export type InventoryViewItem = {
  id: string;
  name: string;
  category: InventoryCategory;
  status: InventoryStatus;
  quantity: {
    amount: number;
    unit: string;
  };
  reorderAt?: number;
  location: string;
  source: string;
  notes: string;
  color: string;
  useBy?: string;
  acquiredAt: string;
  updatedAt: string;
};

export type InventorySnapshot = {
  userEmail: string;
  displayName: string;
  source: "mongodb" | "demo";
  items: InventoryViewItem[];
  plan?: InventoryPlanSnapshot;
  lastUpdated: string;
};

export type InventoryPlanOutput = {
  id: string;
  name: string;
  source: string;
  category: "produce" | "livestock";
  startsAt: string;
  endsAt?: string;
  cadence: string;
  note: string;
  color: string;
};

export type InventoryPlanSnapshot = {
  name: string;
  season: string;
  currentDate: string;
  outputs: InventoryPlanOutput[];
};

const demoInventoryItems: InventoryViewItem[] = [
  {
    id: "demo-sun-gold-tomatoes",
    name: "Sun Gold tomatoes",
    category: "harvest",
    status: "ready",
    quantity: { amount: 7.5, unit: "lb" },
    location: "cool pantry crate",
    source: "south trellis",
    notes: "Sort into market pints tonight; keep blemished fruit for sauce.",
    color: "#e9783a",
    useBy: "2026-05-14T07:00:00.000Z",
    acquiredAt: "2026-05-09T07:00:00.000Z",
    updatedAt: "2026-05-09T07:00:00.000Z",
  },
  {
    id: "demo-lettuce",
    name: "Butter lettuce heads",
    category: "harvest",
    status: "ready",
    quantity: { amount: 12, unit: "heads" },
    location: "wash station",
    source: "shade bed A",
    notes: "Hydrocool before neighborhood swap pickup.",
    color: "#65a95a",
    useBy: "2026-05-11T07:00:00.000Z",
    acquiredAt: "2026-05-09T07:00:00.000Z",
    updatedAt: "2026-05-09T07:00:00.000Z",
  },
  {
    id: "demo-corn-seed",
    name: "Glass gem corn seed",
    category: "seeds",
    status: "stocked",
    quantity: { amount: 86, unit: "seeds" },
    reorderAt: 24,
    location: "seed library drawer 02",
    source: "saved seed",
    notes: "Dry, labeled, and ready for the summer block.",
    color: "#d7b64b",
    acquiredAt: "2026-04-18T07:00:00.000Z",
    updatedAt: "2026-05-09T07:00:00.000Z",
  },
  {
    id: "demo-basil-starts",
    name: "Basil starts",
    category: "starts",
    status: "stocked",
    quantity: { amount: 18, unit: "plants" },
    reorderAt: 6,
    location: "greenhouse bench",
    source: "propagation tray 4",
    notes: "Pinch tips before moving to the herb spiral.",
    color: "#3f8b58",
    acquiredAt: "2026-05-01T07:00:00.000Z",
    updatedAt: "2026-05-09T07:00:00.000Z",
  },
  {
    id: "demo-feed",
    name: "Layer feed",
    category: "feed",
    status: "low",
    quantity: { amount: 18, unit: "lb" },
    reorderAt: 20,
    location: "sealed bin by coop",
    source: "Davis co-op",
    notes: "Below reorder line; add oyster shell to next run.",
    color: "#b0834b",
    acquiredAt: "2026-04-26T07:00:00.000Z",
    updatedAt: "2026-05-09T07:00:00.000Z",
  },
  {
    id: "demo-compost",
    name: "Finished compost",
    category: "amendments",
    status: "stocked",
    quantity: { amount: 5, unit: "carts" },
    reorderAt: 2,
    location: "bay three",
    source: "home cycle",
    notes: "Screened and warm; reserve two carts for pepper bed.",
    color: "#6f8f55",
    acquiredAt: "2026-05-02T07:00:00.000Z",
    updatedAt: "2026-05-09T07:00:00.000Z",
  },
  {
    id: "demo-drip-kit",
    name: "Drip repair kit",
    category: "tools",
    status: "stocked",
    quantity: { amount: 1, unit: "kit" },
    location: "tool wall cubby",
    source: "farm shed",
    notes: "Emitters, goof plugs, punch, and two couplers.",
    color: "#48b9df",
    acquiredAt: "2026-03-20T07:00:00.000Z",
    updatedAt: "2026-05-09T07:00:00.000Z",
  },
  {
    id: "demo-strawberry-jam",
    name: "Strawberry basil jam",
    category: "preserves",
    status: "curing",
    quantity: { amount: 9, unit: "jars" },
    location: "pantry shelf B",
    source: "spring berry flush",
    notes: "Set aside three jars for crop-swap bundles.",
    color: "#c95b76",
    useBy: "2026-11-09T08:00:00.000Z",
    acquiredAt: "2026-05-07T07:00:00.000Z",
    updatedAt: "2026-05-09T07:00:00.000Z",
  },
  {
    id: "demo-nest-box-herbs",
    name: "Nest box herbs",
    category: "livestock",
    status: "low",
    quantity: { amount: 3, unit: "bundles" },
    reorderAt: 4,
    location: "coop shelf",
    source: "mint and lavender bed",
    notes: "Dry another batch before the weekend cleanout.",
    color: "#8a6f3f",
    acquiredAt: "2026-05-05T07:00:00.000Z",
    updatedAt: "2026-05-09T07:00:00.000Z",
  },
];

const demoPlan: InventoryPlanSnapshot = {
  name: "Balanced Test Plan",
  season: "spring",
  currentDate: "2026-06-01T08:00:00.000Z",
  outputs: [
    {
      id: "demo-output-tomatoes",
      name: "Tomato harvest",
      source: "Tomato Bed",
      category: "produce",
      startsAt: "2026-06-16T00:00:00.000Z",
      endsAt: "2026-07-30T00:00:00.000Z",
      cadence: "weekly flush",
      note: "Fruiting stage begins after the first 46 days in the latest plan.",
      color: "#e9783a",
    },
    {
      id: "demo-output-lettuce",
      name: "Lettuce harvest",
      source: "Lettuce Bed",
      category: "produce",
      startsAt: "2026-05-22T00:00:00.000Z",
      endsAt: "2026-07-05T00:00:00.000Z",
      cadence: "one cut window",
      note: "Ready once the seeded bed reaches its harvest-ready stage.",
      color: "#65a95a",
    },
    {
      id: "demo-output-eggs",
      name: "Eggs",
      source: "Chicken Coop",
      category: "livestock",
      startsAt: "2026-06-01T08:00:00.000Z",
      cadence: "daily",
      note: "Adult flock is active at the latest simulation date.",
      color: "#d7b64b",
    },
  ],
};

export async function getInventorySnapshot(): Promise<InventorySnapshot> {
  try {
    const db = await getMongoDb();
    const user = await db.collection("users").findOne({ email: demoUserEmail });

    if (!user) {
      return getDemoSnapshot();
    }

    const [profile, items, latestPlan] = await Promise.all([
      db.collection("profiles").findOne({ userId: user._id }),
      db
        .collection<InventoryItem>("inventory_items")
        .find({ userId: user._id })
        .sort({ category: 1, status: 1, name: 1 })
        .toArray(),
      db.collection<Plan>("plans").findOne({ userId: user._id }, { sort: { createdAt: -1 } }),
    ]);

    if (!items.length) {
      return getDemoSnapshot();
    }

    const viewItems = items.map((item) => ({
      id: item._id.toString(),
      name: item.name,
      category: item.category,
      status: item.status,
      quantity: item.quantity,
      reorderAt: item.reorderAt,
      location: item.location,
      source: item.source,
      notes: item.notes,
      color: item.color,
      useBy: item.useBy?.toISOString(),
      acquiredAt: item.acquiredAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));

    const catalogItems = latestPlan?.objects.length
      ? await db
          .collection<CatalogItem>("catalog_items")
          .find({ _id: { $in: latestPlan.objects.map((object) => object.sourceId) } })
          .toArray()
      : [];
    const catalogById = new Map(catalogItems.map((item) => [item._id.toString(), item]));

    return {
      userEmail: user.email,
      displayName: typeof profile?.displayName === "string" ? profile.displayName : "Test Farmer",
      source: "mongodb",
      items: viewItems,
      plan: latestPlan ? buildPlanSnapshot(latestPlan, catalogById) : undefined,
      lastUpdated: newestTimestamp(viewItems),
    };
  } catch {
    return getDemoSnapshot();
  }
}

function getDemoSnapshot(): InventorySnapshot {
  return {
    userEmail: demoUserEmail,
    displayName: "Test Farmer",
    source: "demo",
    items: demoInventoryItems,
    plan: demoPlan,
    lastUpdated: newestTimestamp(demoInventoryItems),
  };
}

function newestTimestamp(items: InventoryViewItem[]) {
  return items
    .map((item) => item.updatedAt)
    .sort((left, right) => right.localeCompare(left))[0];
}

function buildPlanSnapshot(plan: Plan, catalogById: Map<string, CatalogItem>): InventoryPlanSnapshot {
  const outputs = plan.objects
    .filter((object) => object.status !== "removed")
    .map((object) => {
      const catalogItem = catalogById.get(object.sourceId.toString());
      const startDay = getOutputStartDay(object.plantedAtDay ?? object.addedAtDay ?? 0, catalogItem);
      const maxDay = getOutputEndDay(object.plantedAtDay ?? object.addedAtDay ?? 0, catalogItem);
      const category: InventoryPlanOutput["category"] =
        object.type === "livestock" ? "livestock" : "produce";
      const startsAt =
        object.type === "livestock" ? plan.simulation.currentDate : addDays(plan.simulation.startDate, startDay);

      return {
        id: object.instanceId,
        name: getOutputName(object.slug, object.displayName, object.type),
        source: object.displayName,
        category,
        startsAt: startsAt.toISOString(),
        endsAt: maxDay ? addDays(plan.simulation.startDate, maxDay).toISOString() : undefined,
        cadence: object.type === "livestock" ? "daily" : getCropCadence(catalogItem),
        note: getOutputNote(object.slug, object.type),
        color: catalogItem?.render.fruitColor ?? catalogItem?.render.color ?? "#6f8f55",
      };
    });

  return {
    name: plan.name,
    season: plan.simulation.season,
    currentDate: plan.simulation.currentDate.toISOString(),
    outputs: dedupePlanOutputs(outputs).sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
  };
}

function dedupePlanOutputs(outputs: InventoryPlanOutput[]) {
  const outputsByKey = new Map<string, InventoryPlanOutput & { sourceCount: number }>();

  for (const output of outputs) {
    const key = `${output.name}:${output.startsAt}:${output.cadence}`;
    const existing = outputsByKey.get(key);

    if (existing) {
      existing.sourceCount += 1;
      existing.source = `${existing.sourceCount} plan spots`;
      continue;
    }

    outputsByKey.set(key, { ...output, sourceCount: 1 });
  }

  return Array.from(outputsByKey.values()).map((output) => ({
    id: output.id,
    name: output.name,
    source: output.source,
    category: output.category,
    startsAt: output.startsAt,
    endsAt: output.endsAt,
    cadence: output.cadence,
    note: output.note,
    color: output.color,
  }));
}

function getOutputStartDay(baseDay: number, catalogItem?: CatalogItem) {
  const stage = catalogItem?.growthStages?.find((growthStage) =>
    ["fruiting", "harvest_ready", "mature"].includes(growthStage.name),
  );

  return baseDay + (stage?.minAgeDays ?? 0);
}

function getOutputEndDay(baseDay: number, catalogItem?: CatalogItem) {
  const stage = catalogItem?.growthStages?.find((growthStage) =>
    ["fruiting", "harvest_ready", "mature"].includes(growthStage.name),
  );

  return stage?.maxAgeDays ? baseDay + stage.maxAgeDays : undefined;
}

function getCropCadence(catalogItem?: CatalogItem) {
  const stageName = catalogItem?.growthStages?.at(-1)?.name;
  return stageName === "fruiting" ? "weekly flush" : "one cut window";
}

function getOutputName(slug: string, displayName: string, type: "crop" | "livestock") {
  if (slug === "chickens") {
    return "Eggs";
  }

  if (type === "crop") {
    return `${displayName.replace(/\s+bed$/i, "")} harvest`;
  }

  return `${displayName} output`;
}

function getOutputNote(slug: string, type: "crop" | "livestock") {
  if (slug === "chickens") {
    return "Adult flock output from the latest simulated plan.";
  }

  return type === "crop"
    ? "Projected from the crop lifecycle stage in the latest plan."
    : "Projected from livestock in the latest plan.";
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}
