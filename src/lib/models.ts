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
  iconPath?: string;
  fruitColor?: string;
  heightMultiplier?: number;
  scale?: number;
};

export type FarmObjectType = "crop" | "livestock" | "structure";

export type GeometryPoint = {
  x: number;
  y: number;
  lat?: number;
  lng?: number;
};

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
  cropProfile?: CropTypeProfile;
  livestockProfile?: LivestockTypeProfile;
  structureProfile?: StructureTypeProfile;
  growthStages?: LifecycleStage[];
  lifeStages?: LifecycleStage[];
  dailyBehavior?: DailyBehavior[];
  createdAt: Date;
  updatedAt: Date;
};

export type User = {
  _id: ObjectId;
  uuid: string;
  email: string;
  username?: string;
  passwordHash: string;
  pushTokens?: string[];
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
};

export type UserSession = {
  _id: ObjectId;
  userId: ObjectId;
  tokenHash: string;
  expiresAt: Date;
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

export type InventoryCategory =
  | "harvest"
  | "seeds"
  | "starts"
  | "feed"
  | "amendments"
  | "tools"
  | "preserves"
  | "livestock";

export type InventoryStatus = "stocked" | "low" | "ready" | "curing";

export type InventoryItem = {
  _id: ObjectId;
  userId: ObjectId;
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
  useBy?: Date;
  acquiredAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ShopDisplaySlot = {
  inventoryItemId: ObjectId;
  listingId: string;
  position: number;
  displayAmount: number;
  displayUnit: string;
  priceCents: number;
  signText: string;
  visible: boolean;
  imageId?: ObjectId;
  imageMimeType?: string;
};

export type ShopOffering = {
  _id: ObjectId;
  listingId: string;
  userId: ObjectId;
  userUuid: string;
  inventoryItemId: ObjectId;
  name: string;
  category: InventoryCategory;
  amount: number;
  unit: string;
  priceCents: number;
  signText: string;
  visible: boolean;
  position: number;
  imageId?: ObjectId;
  imageMimeType?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ShopHoursSchedule = {
  days: number[];
  openMinutes: number;
  closeMinutes: number;
  note?: string;
};

export type ShopPaymentMethodKind =
  | "venmo"
  | "cashapp"
  | "zelle"
  | "paypal"
  | "cash"
  | "card"
  | "check"
  | "trade";

export type ShopPaymentMethod = {
  kind: ShopPaymentMethodKind;
  handle?: string;
};

export type ShopPaymentDetails = {
  methods: ShopPaymentMethod[];
  note?: string;
};

export type ShopPickupCoords = {
  lat: number;
  lng: number;
};

export type ShopDisplayDetails = {
  shopName: string;
  hours: string;
  hoursSchedule?: ShopHoursSchedule;
  pickupLocation: string;
  pickupCoords?: ShopPickupCoords;
  pickupInstructions: string;
  paymentOptions: string;
  payment?: ShopPaymentDetails;
  contact: string;
  availabilityNote: string;
};

export type ShopDisplay = {
  _id: ObjectId;
  userId: ObjectId;
  theme: "farm-stand";
  layoutMode: "shelves";
  details?: ShopDisplayDetails;
  slots: ShopDisplaySlot[];
  createdAt: Date;
  updatedAt: Date;
};

export type FarmReview = {
  _id: ObjectId;
  farmUserId: ObjectId;
  reviewerName: string;
  rating: number;
  comment: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type SocialOfferStatus = "sent" | "accepted" | "declined" | "cancelled";

export type SocialOffer = {
  _id: ObjectId;
  farmUserId: ObjectId;
  senderUserId: ObjectId;
  senderName: string;
  inventoryItemId?: ObjectId;
  itemName: string;
  quantity: string;
  priceCents?: number;
  message: string;
  status: SocialOfferStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type PushDeviceToken = {
  _id: ObjectId;
  userId: ObjectId;
  token: string;
  platform?: string;
  deviceName?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Farm = {
  _id: ObjectId;
  userId?: ObjectId;
  userUuid?: string;
  slug?: string;
  name: string;
  shortName?: string;
  distance?: string;
  neighborhood?: string;
  response?: string;
  rating?: number;
  reviews?: number;
  ratings?: {
    quality: number;
    fairness: number;
    pickup: number;
  };
  offerings?: Array<{
    slug: string;
    name: string;
    category: string;
    amount: number;
    unit: string;
    priceCents: number;
    signText: string;
    icon: string;
    color: string;
  }>;
  isShopFarm?: boolean;
  sortOrder?: number;
  units: "meters" | "feet";
  bounds: ObjectSize;
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
  coordinates?: {
    latitude: number;
    longitude: number;
    x?: number;
    y?: number;
  };
  createdAt: Date;
  updatedAt: Date;
};

export type OfferNotification = {
  _id: ObjectId;
  type: "offer";
  status: "pending" | "accepted" | "declined";
  listingId: string;
  offeringName: string;
  farmId?: ObjectId;
  farmName?: string;
  recipientUserUuid: string;
  actorUserUuid: string;
  actorName: string;
  mode: "cash" | "barter";
  cashOfferCents?: number;
  barterListingIds?: string[];
  note?: string;
  pushEvents?: {
    offerMadeAt?: Date;
    offerAcceptedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
};

export type LocalPoint = [number, number];

export type GeoPoint = [number, number];

export type FarmV2ObjectType = "cropArea" | "cropField" | "livestock" | "structure" | "path";

export type FarmV2BaseObject = {
  id: string;
  label: string;
  type: FarmV2ObjectType;
  attrs: Record<string, string | number | boolean | null | undefined>;
};

export type FarmV2CropAreaObject = FarmV2BaseObject & {
  type: "cropArea";
  polygon: LocalPoint[];
  height: number;
};

export type FarmV2CropFieldObject = FarmV2BaseObject & {
  type: "cropField";
  parentId: string | null;
  polygon: LocalPoint[];
  height: number;
  attrs: {
    status: string;
    planted?: string;
    soil?: string;
    rows?: number;
    cropKey?: string | null;
    cropName?: string;
    count?: number;
    visual?: string;
    growth?: number;
  };
};

export type FarmV2LivestockObject = FarmV2BaseObject & {
  type: "livestock";
  polygon: LocalPoint[];
  height: number;
  attrs: {
    species: string;
    breed: string;
    count: number;
    status: string;
  };
};

export type FarmV2StructureObject = FarmV2BaseObject & {
  type: "structure";
  polygon: LocalPoint[];
  height: number;
  attrs: {
    kind: string;
    height?: number;
    material: string;
    status: string;
  };
};

export type FarmV2PathObject = FarmV2BaseObject & {
  type: "path";
  points: LocalPoint[];
  attrs: {
    status: string;
    material: string;
  };
};

export type FarmV2Object =
  | FarmV2CropAreaObject
  | FarmV2CropFieldObject
  | FarmV2LivestockObject
  | FarmV2StructureObject
  | FarmV2PathObject;

export type FarmV2Commit = {
  id: string;
  timestamp: Date;
  name: string;
  autoName: string;
  objects: FarmV2Object[];
};

export type FarmV2Plan = {
  _id: ObjectId;
  farmId: ObjectId;
  userId: ObjectId;
  schema: "farmv2";
  version: 8;
  name: string;
  status: "draft" | "active" | "archived";
  units: "ft" | "m";
  view: "grid" | "satellite";
  selectedId?: string | null;
  camera: {
    zoom: number;
    panX: number;
    panY: number;
    rotation: number;
  };
  boundary: {
    source: "map" | "demo";
    geo: GeoPoint[] | null;
    local: LocalPoint[];
    areaSquareFeet: number;
  };
  objects: FarmV2Object[];
  commits: FarmV2Commit[];
  commitIndex: number;
  summary: {
    description: string;
    highlights: string[];
    maintenanceLevel: "low" | "medium" | "high";
  };
  generation: {
    mode: "manual" | "deterministic-draft";
    strategy: string;
    prompt: string;
    constraints: Record<string, unknown>;
    score: number;
  };
  createdAt: Date;
  updatedAt: Date;
};

export type GeometryPolygon = {
  points: GeometryPoint[];
  areaSquareFeet: number;
};

export type CostBreakdown = {
  seeds?: number;
  starts?: number;
  feed?: number;
  bedding?: number;
  amendments?: number;
  fertilizer?: number;
  manure?: number;
  compost?: number;
  pesticides?: number;
  labor?: number;
  infrastructure?: number;
  utilities?: number;
  other?: number;
};

export type RecurringCost = {
  weekly: number;
  monthly: number;
  yearly: number;
};

export type RevenueMetrics = {
  weekly: number;
  monthly: number;
  yearly: number;
  perSquareFoot?: number;
  perPlant?: number;
  totalPlot?: number;
};

export type MaterialApplication = {
  type: string;
  status: "none" | "planned" | "applied";
  appliedAt?: string;
  notes?: string;
};

export type HarvestEvent = {
  eventId: string;
  date: string;
  quantity: number;
  unit: string;
  revenue?: number;
  removeOnHarvest?: boolean;
  storageUnitId?: string;
  externalStorage?: boolean;
};

export type DeathEvent = {
  eventId: string;
  date: string;
  count?: number;
  reason: string;
};

export type CropTypeProfile = {
  idealSoilTypes: string[];
  idealSun: "full" | "partial" | "shade";
  idealWater: "low" | "medium" | "high";
  daysToGermination: [number, number];
  daysToMaturity: [number, number];
  harvestWindowDays: [number, number];
  spacingInches: number;
  yieldPerSquareFoot: number;
  yieldUnit: string;
  expectedPricePerUnit: number;
  failureRate: number;
  waterGallonsPerSqFtWeek: number;
};

export type CropObjectData = {
  cropType: string;
  cropTypeSourceId?: ObjectId | null;
  seedLot: string;
  seedSource: string;
  seedOrTransplantDate: string;
  soilType: string;
  soilWarning?: string;
  sunExposure: "full" | "partial" | "shade";
  sunWarning?: string;
  fertilizer: MaterialApplication;
  manure: MaterialApplication;
  compost: MaterialApplication;
  pesticides: MaterialApplication[];
  priorCrops: string[];
  harvestEvents: HarvestEvent[];
  deathEvents: DeathEvent[];
  producedMetrics: {
    expectedGerminationDays: [number, number];
    daysToMaturity: [number, number];
    expectedHarvestWindow: [string, string];
    averageSpacingInches: number;
    yieldPerSquareFoot: number;
    yieldPerPlant: number;
    daysFromPlantingToFirstHarvest: number;
    daysInProduction: number;
    cropFailureRate: number;
  };
};

export type LivestockTypeProfile = {
  species: string;
  feedCostPerHeadWeek: number;
  eggsPerHeadWeek?: number;
  milkGallonsPerHeadWeek?: number;
  expectedPricePerEggDozen?: number;
  expectedPricePerMilkGallon?: number;
  spaceSquareFeetPerHead: number;
  waterGallonsPerHeadWeek: number;
};

export type LivestockObjectData = {
  animalId: string;
  species: string;
  breed: string;
  birthOrHatchDate: string;
  source: string;
  weight: {
    amount: number;
    unit: string;
  };
  vaccinations: {
    name: string;
    date: string;
    notes?: string;
  }[];
  feedType: string;
  headCount: number;
  harvestEvents: HarvestEvent[];
  deathEvents: DeathEvent[];
  producedMetrics: {
    feedCost: RecurringCost;
    eggsPerPeriod?: RecurringCost;
    milkGallonsPerPeriod?: RecurringCost;
    revenue: RevenueMetrics;
  };
};

export type StructureTypeProfile = {
  structureType: "storage" | "greenhouse" | "coop" | "compost" | "irrigation" | "other";
  storageCapacity?: {
    amount: number;
    unit: string;
  };
};

export type StoredItem = {
  itemType: string;
  quantity: {
    amount: number;
    unit: string;
  };
  forSale?: boolean;
  pricePerUnit?: number;
};

export type StructureObjectData = {
  structureType: StructureTypeProfile["structureType"];
  storedItems?: StoredItem[];
  invisibleExternalStorage?: boolean;
};

export type PlanObject = {
  instanceId: string;
  type: FarmObjectType;
  slug: string;
  sourceId?: ObjectId | null;
  displayName: string;
  status: "planned" | "active" | "removed" | "optional";
  plantedAtDay?: number;
  addedAtDay?: number;
  ageDaysAtStart?: number;
  position: Vector3;
  rotation: Vector3;
  size: ObjectSize;
  geometry?: GeometryPolygon;
  areaSquareFeet?: number;
  costBreakdown?: CostBreakdown;
  recurringCost?: RecurringCost;
  revenue?: RevenueMetrics;
  waterGallonsPerWeek?: number;
  crop?: CropObjectData;
  livestock?: LivestockObjectData;
  structure?: StructureObjectData;
  renderOverrides: Partial<RenderConfig>;
  notes?: string;
};

export type PlanPartition = {
  partitionId: string;
  label: string;
  type:
    | "annual_beds"
    | "perennial_guild"
    | "livestock"
    | "greenhouse"
    | "water"
    | "habitat";
  assignmentSlug: string;
  assignmentName: string;
  geometry: {
    corners: GeometryPoint[];
    center: GeometryPoint;
  };
  areaSquareMeters: number;
  sunExposure: "full" | "partial" | "shade";
  waterNeed: "low" | "medium" | "high";
  soilStrategy: string;
  render: RenderConfig;
  notes: string;
};

export type PlanTileType =
  | "tomato"
  | "lettuce"
  | "corn"
  | "potato"
  | "strawberry"
  | "pea"
  | "mushroom"
  | "herb"
  | "pollinator"
  | "chicken"
  | "goat"
  | "storage"
  | "greenhouse"
  | "compost"
  | "path";

export type PlanTile = {
  tileId: string;
  tileType: PlanTileType;
  objectType?: FarmObjectType;
  objectInstanceId?: string;
  assignmentSlug: string;
  assignmentName: string;
  grid: {
    x: number;
    y: number;
  };
  position: {
    x: number;
    z: number;
  };
  sizeFeet: 1;
  areaSquareFeet: 1;
  color: string;
  iconPath: string;
  sunExposure: "full" | "partial" | "shade";
  waterNeed: "low" | "medium" | "high";
  soilStrategy: string;
  notes: string;
};

export type FarmPlanContext = {
  averageWeather: string;
  yearlyRainfallInches: number;
  bounds: {
    points: GeometryPoint[];
    dimensions: ObjectSize;
    areaSquareFeet: number;
  };
};

export type FarmPlanAnalytics = {
  costBreakdown: {
    weekly: CostBreakdown & { total: number };
    monthly: CostBreakdown & { total: number };
    yearly: CostBreakdown & { total: number };
  };
  potentialMonthlyEarnings: number;
  revenue: {
    weekly: number;
    monthly: number;
    yearly: number;
  };
  profit: {
    weekly: number;
    monthly: number;
    yearly: number;
  };
  waterGallonsPerWeek: number;
  storage: {
    unitId: string;
    itemType: string;
    quantity: number;
    unit: string;
    weeksRemaining?: number;
    forSale?: boolean;
    pricePerUnit?: number;
  }[];
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
  baseGeometry?: {
    source: "satellite-drawn";
    locationLabel: string;
    points: GeometryPoint[];
    centroid: GeometryPoint;
    areaSquareMeters: number;
    areaSquareFeet?: number;
  };
  farmContext?: FarmPlanContext;
  partitions?: PlanPartition[];
  tiles?: PlanTile[];
  objects: PlanObject[];
  analytics?: FarmPlanAnalytics;
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
