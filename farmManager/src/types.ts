export type Point = [number, number];

export type ObjectType = "cropArea" | "cropField" | "livestock" | "structure" | "path";
export type DrawType = ObjectType;
export type ViewMode = "grid" | "satellite";
export type Units = "ft" | "m";

export interface CropCatalogEntry {
  key: string;
  name: string;
  visual: "fruiting" | "grain" | "leafy" | "herb" | "mound" | "vine" | "root" | "groundcover" | "generic";
  defaultCount: number;
  growth: number;
  scientificName?: string;
  description?: string;
  cropCategory?: string;
  lifeSpan?: string;
  idealSpaceSqft?: number;
  harvestCycles?: number;
  soilPhMin?: number;
  soilPhMax?: number;
  lightRequirement?: string;
  soilTexture?: string;
  waterConsumptionMl?: number;
  rainfallMaxMl?: number;
  howToGrow?: string;
  insectControl?: string;
  tips?: string;
  isCustom?: boolean;
}

export interface LivestockCatalogEntry {
  key: string;
  name: string;
  breed: string;
  breeds: string[];
  defaultCount: number;
  description?: string;
  idealSpaceSqft?: number;
  feed?: string;
  careInstructions?: string;
  meatYield?: number;
  yieldTypes?: string[];
  yieldFrequency?: string;
  isCustom?: boolean;
}

export interface StructureCatalogEntry {
  key: string;
  name: string;
  material: string;
  height: number;
}

export interface Catalog {
  crops: CropCatalogEntry[];
  livestock: LivestockCatalogEntry[];
  structures: StructureCatalogEntry[];
}

export interface CropAreaAttrs {
  status: string;
  soil: string;
}

export interface CropFieldAttrs {
  status: string;
  planted: string;
  soil: string;
  rows: number;
  cropKey: string | null;
  cropName: string;
  count: number;
  visual: CropCatalogEntry["visual"];
  growth: number;
  idealSpaceSqft?: number;
  harvestCycles?: number;
  catalogKnown?: boolean;
}

export interface LivestockAttrs {
  speciesKey?: string | null;
  species: string;
  breed: string;
  count: number;
  status: string;
  idealSpaceSqft?: number;
  yieldTypes?: string[];
  catalogKnown?: boolean;
}

export interface StructureAttrs {
  kind: string;
  height: number;
  material: string;
  status: string;
}

export interface PathAttrs {
  status: string;
  material: string;
}

export interface BaseFarmObject {
  id: string;
  label: string;
  type: ObjectType;
  attrs: unknown;
}

export interface CropAreaObject extends BaseFarmObject {
  type: "cropArea";
  polygon: Point[];
  height: number;
  attrs: CropAreaAttrs;
}

export interface CropFieldObject extends BaseFarmObject {
  type: "cropField";
  parentId: string | null;
  polygon: Point[];
  height: number;
  attrs: CropFieldAttrs;
}

export interface LivestockObject extends BaseFarmObject {
  type: "livestock";
  polygon: Point[];
  height: number;
  attrs: LivestockAttrs;
}

export interface StructureObject extends BaseFarmObject {
  type: "structure";
  polygon: Point[];
  height: number;
  attrs: StructureAttrs;
}

export interface PathObject extends BaseFarmObject {
  type: "path";
  points: Point[];
  attrs: PathAttrs;
}

export type FarmObject = CropAreaObject | CropFieldObject | LivestockObject | StructureObject | PathObject;

export interface FarmCommit {
  id: string;
  timestamp: string;
  name: string;
  autoName: string;
  objects: FarmObject[];
}

export interface PointerDownState {
  x: number;
  y: number;
  panX: number;
  panY: number;
}

export interface HitCycleState {
  key: string;
  index: number;
  world: Point;
}

export interface FarmState {
  mode: "select" | "draw";
  drawType: DrawType;
  view: ViewMode;
  units: Units;
  selectedId: string | null;
  draft: Point[];
  mouse: Point | null;
  zoom: number;
  panX: number;
  panY: number;
  rotation: number;
  pointerDown: PointerDownState | null;
  isPanning: boolean;
  lastHitCycle: HitCycleState | null;
  playing: boolean;
  playTimer: number | null;
  boundaryConfirmed: boolean;
  boundaryGeo: Point[] | null;
  boundaryLocal: Point[];
  objects: FarmObject[];
  commits: FarmCommit[];
  commitIndex: number;
  dirtyPanelKey: string;
  pendingCatalogMode: "crop" | "livestock" | "structure" | null;
}

export interface FarmManagerSnapshot {
  version: 1;
  boundaryConfirmed: boolean;
  boundaryGeo: Point[] | null;
  boundaryLocal: Point[];
  objects: FarmObject[];
  commits: FarmCommit[];
  commitIndex: number;
  units: Units;
  view: ViewMode;
  selectedId: string | null;
}

export interface FarmManagerChromeState {
  mode: FarmState["mode"];
  drawType: DrawType;
  view: ViewMode;
  units: Units;
  onboardingVisible: boolean;
  setupChoiceVisible: boolean;
  ready: boolean;
  backendMessage: string | null;
  backendError: boolean;
}

export interface FarmManagerTimelineState {
  commits: FarmCommit[];
  commitIndex: number;
  playing: boolean;
  snapshotDate: string;
  snapshotLabel: string;
}

export interface FarmManagerContentState {
  selectedObject: FarmObject | null;
  objects: FarmObject[];
  timeline: FarmManagerTimelineState;
  draftCount: number;
  boundaryPointCount: number;
  boundarySource: "Map" | "Demo";
  units: Units;
  catalog: Catalog;
  commitModalOpen: boolean;
  savingCommit: boolean;
}

export interface FarmManagerActions {
  setMode: (mode: FarmState["mode"]) => void;
  setDrawType: (drawType: DrawType) => void;
  setView: (view: ViewMode) => void;
  setUnits: (units: Units) => void;
  finishDraft: () => void;
  clearDraft: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  rotateView: () => void;
  resetView: () => void;
  openBoundarySettings: () => void;
  useDemoBoundary: () => void;
  clearBoundary: () => void;
  saveBoundary: () => void;
  startManualSetup: () => void;
  startAiSetup: () => void;
  loadCommit: (index: number) => void;
  togglePlayback: () => void;
  openCommitModal: () => void;
  closeCommitModal: () => void;
  saveCommit: (name: string) => Promise<boolean>;
  renameSelectedObject: (name: string) => void;
  deleteSelectedObject: () => void;
  setCropCount: (count: number) => void;
  setCropType: (cropKey: string) => void;
  setCustomCropName: (name: string) => void;
  setLivestockSpecies: (speciesKey: string) => void;
  setCustomLivestockName: (name: string) => void;
  setLivestockBreed: (breed: string) => void;
  setLivestockCount: (count: number) => void;
  setStructureType: (structureKey: string) => void;
  handleCanvasPointerDown: (event: PointerEvent) => void;
  handleCanvasPointerMove: (event: PointerEvent) => void;
  handleCanvasPointerUp: (event: PointerEvent) => void;
  handleCanvasPointerLeave: () => void;
  handleCanvasClick: (event: MouseEvent) => void;
  handleCanvasWheel: (event: WheelEvent) => void;
  handleKeyDown: (event: KeyboardEvent) => void;
}

export interface FarmManagerMountOptions {
  onChromeChange?: (state: FarmManagerChromeState) => void;
  onContentChange?: (state: FarmManagerContentState) => void;
}

export interface FarmManagerMount {
  cleanup: () => void;
  actions: FarmManagerActions;
  getChromeState: () => FarmManagerChromeState;
  getContentState: () => FarmManagerContentState;
}

export interface BBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ZoomLimits {
  min: number;
  max: number;
}

export interface BoundaryMapUi {
  boundaryMap: HTMLElement;
  mapFallback: HTMLElement;
  clearBoundary?: HTMLButtonElement;
  useDemoBoundary?: HTMLButtonElement;
  saveBoundary?: HTMLButtonElement;
}
