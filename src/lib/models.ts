import type { ObjectId } from "mongodb";

export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type ObjectSize = {
  width: number;
  depth: number;
  height: number;
};

export type RenderConfig = {
  model: string;
  color: string;
  label?: string;
  fruitColor?: string;
  heightMultiplier?: number;
  scale?: number;
};

export type FarmObjectType = "crop" | "livestock";

export type LifecycleStage = {
  name: string;
  minAgeDays: number;
  maxAgeDays: number | null;
  render: RenderConfig;
};

export type DailyBehavior = {
  from: string;
  to: string;
  animation: string;
  visibleIn: string;
};

export type CatalogItem = {
  _id: ObjectId;
  slug: string;
  type: FarmObjectType;
  name: string;
  defaultSize: ObjectSize;
  render: RenderConfig;
  growthStages?: LifecycleStage[];
  lifeStages?: LifecycleStage[];
  dailyBehavior?: DailyBehavior[];
  createdAt: Date;
  updatedAt: Date;
};

export type User = {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
};

export type Profile = {
  _id: ObjectId;
  userId: ObjectId;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Farm = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  units: "meters";
  bounds: ObjectSize;
  createdAt: Date;
  updatedAt: Date;
};

export type PlanObject = {
  instanceId: string;
  type: FarmObjectType;
  slug: string;
  sourceId: ObjectId;
  displayName: string;
  status: "planned" | "active" | "removed" | "optional";
  plantedAtDay?: number;
  addedAtDay?: number;
  ageDaysAtStart?: number;
  position: Vector3;
  rotation: Vector3;
  size: ObjectSize;
  renderOverrides: Partial<RenderConfig>;
  notes?: string;
};

export type Plan = {
  _id: ObjectId;
  farmId: ObjectId;
  userId: ObjectId;
  name: string;
  status: "draft" | "active" | "archived";
  version: number;
  simulation: {
    startDate: Date;
    currentDate: Date;
    day: number;
    timeOfDay: string;
    season: "spring" | "summer" | "fall" | "winter";
    speed: number;
    paused: boolean;
  };
  objects: PlanObject[];
  summary: {
    description: string;
    highlights: string[];
    maintenanceLevel: "low" | "medium" | "high";
  };
  generation: {
    strategy: string;
    prompt: string;
    constraints: Record<string, unknown>;
    score: number;
  };
  createdAt: Date;
  updatedAt: Date;
};
