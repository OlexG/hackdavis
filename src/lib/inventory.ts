import { AuthenticationError, requireUserSession } from "@/lib/auth";
import { getMongoDb } from "@/lib/mongodb";
import type { FarmV2Plan, InventoryCategory, InventoryItem, InventoryStatus } from "@/lib/models";

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
    const currentUser = await requireUserSession();

    const [profile, items, latestPlan] = await Promise.all([
      db.collection("profiles").findOne({ userId: currentUser.userId }),
      db
        .collection<InventoryItem>("inventory_items")
        .find({ userId: currentUser.userId })
        .sort({ category: 1, status: 1, name: 1 })
        .toArray(),
      db.collection<FarmV2Plan>("plans").findOne({ userId: currentUser.userId, schema: "farmv2" }, { sort: { createdAt: -1 } }),
    ]);

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

    return {
      userEmail: currentUser.email,
      displayName: typeof profile?.displayName === "string" ? profile.displayName : currentUser.displayName,
      source: "mongodb",
      items: viewItems,
      plan: latestPlan ? buildPlanSnapshot(latestPlan) : undefined,
      lastUpdated: newestTimestamp(viewItems) ?? new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return getDemoSnapshot();
  }
}

function getDemoSnapshot(): InventorySnapshot {
  return {
    userEmail: "demo@sunpatch.local",
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

function buildPlanSnapshot(plan: FarmV2Plan): InventoryPlanSnapshot {
  const now = new Date(plan.updatedAt);
  const outputs = plan.objects
    .reduce<InventoryPlanOutput[]>((items, object) => {
      if (object.type === "cropField" && object.attrs.cropKey) {
        items.push({
          id: object.id,
          name: `${object.attrs.cropName || object.attrs.cropKey} harvest`,
          source: object.label,
          category: "produce" as const,
          startsAt: addDays(now, 30).toISOString(),
          endsAt: addDays(now, 90).toISOString(),
          cadence: "planned harvest window",
          note: `${object.label} is tracked from Farmv2 crop field data.`,
          color: "#65a95a",
        });
        return items;
      }

      if (object.type === "livestock") {
        items.push({
          id: object.id,
          name: `${object.attrs.species} output`,
          source: object.label,
          category: "livestock" as const,
          startsAt: now.toISOString(),
          endsAt: undefined,
          cadence: "daily",
          note: `${object.attrs.count} ${object.attrs.species.toLowerCase()} tracked from Farmv2 livestock data.`,
          color: "#d7b64b",
        });
        return items;
      }

      return items;
    }, []);

  return {
    name: plan.name,
    season: "spring",
    currentDate: now.toISOString(),
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

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}
