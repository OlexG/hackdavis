import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ImageSourcePropType } from "react-native";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import cornIcon from "./assets/inventory-icons/corn.png";
import eggIcon from "./assets/inventory-icons/egg.png";
import hammerIcon from "./assets/inventory-icons/hammer.png";
import lettuceIcon from "./assets/inventory-icons/lettuce.png";
import mushroomIcon from "./assets/inventory-icons/mushroom.png";
import peaPodIcon from "./assets/inventory-icons/pea-pod.png";
import potatoIcon from "./assets/inventory-icons/potato.png";
import strawberryIcon from "./assets/inventory-icons/strawberry.png";
import tomatoIcon from "./assets/inventory-icons/tomato.png";
import NativeFarmMap from "./components/NativeFarmMap";
import { getApiBaseUrl } from "./lib/api";
import {
  fetchMarketplaceSnapshot,
  type MarketFarm,
  type MarketOffering,
  type MarketplaceSnapshot,
} from "./lib/marketplace";

type MainTab = "market" | "shop";
type MarketView = "map" | "list";
type OfferMode = "cash" | "barter";
type Category = MarketOffering["category"];

type Offering = MarketOffering;
type RatingProfile = {
  quality: number;
  fairness: number;
  pickup: number;
};

type Farm = MarketFarm;

type ShopOffering = Offering & {
  status: "on shelf" | "back stock" | "barter preferred";
  tradeValueCents: number;
};

type TradeDraft = {
  farmId: string;
  offeringId: string;
  mode: OfferMode;
  cashOfferCents: number;
  barterIds: string[];
  note: string;
};

const colors = {
  parchment: "#fbf6e8",
  cream: "#fffdf5",
  warmCream: "#fff8dc",
  shelf: "#fcf6e4",
  soil: "#3b2a14",
  text: "#2d2313",
  leaf: "#2f6f4e",
  softLeaf: "#9bb979",
  wood: "#8b6f3e",
  woodLight: "#c9b88a",
  sky: "#b8dde6",
  skyDeep: "#68b8c9",
  gold: "#f2bd4b",
  sun: "#ffe89a",
  orange: "#e9823a",
  red: "#c1492f",
  pink: "#c95b76",
};

const inventoryIcons = {
  corn: cornIcon,
  egg: eggIcon,
  hammer: hammerIcon,
  lettuce: lettuceIcon,
  mushroom: mushroomIcon,
  pea: peaPodIcon,
  potato: potatoIcon,
  strawberry: strawberryIcon,
  tomato: tomatoIcon,
} satisfies Record<string, ImageSourcePropType>;

const categoryLabels: Record<Category, string> = {
  harvest: "Harvest",
  preserves: "Preserves",
  livestock: "Livestock",
  eggs: "Eggs",
  dairy: "Dairy",
  starts: "Starts",
};

const categoryTone: Record<Category, { bg: string; border: string; text: string }> = {
  harvest: { bg: "#eef8df", border: "#9bc278", text: "#335a2d" },
  preserves: { bg: "#fff0f4", border: "#d38aa0", text: "#7a3148" },
  livestock: { bg: "#fff1dc", border: "#efb16b", text: "#7a461f" },
  eggs: { bg: "#e4f7f8", border: "#68b8c9", text: "#245c65" },
  dairy: { bg: "#fff7e3", border: "#d8a05a", text: "#6f3f1c" },
  starts: { bg: "#eef8df", border: "#9bb979", text: "#365833" },
};

// Used only when the API is unreachable. Production data lives in the
// marketplace_farms collection on MongoDB and is served by /api/marketplace/farms.
const fallbackNearbyFarms: Farm[] = [
  {
    id: "riverbend",
    name: "Riverbend Microfarm",
    shortName: "RB",
    distance: "0.8 mi",
    neighborhood: "Putah Creek edge",
    response: "Replies in about 18 min",
    rating: 4.9,
    reviews: 128,
    location: { type: "Point", coordinates: [-121.7510, 38.5290] },
    coordinates: { x: 28, y: 32, latitude: 38.5290, longitude: -121.7510 },
    ratings: { quality: 4.9, fairness: 4.8, pickup: 4.7 },
    offerings: [
      {
        id: "sungold-tomatoes",
        name: "Sungold tomato basket",
        category: "harvest",
        amount: 18,
        unit: "lb",
        priceCents: 550,
        signText: "Sun-warmed and ready",
        icon: "tomato",
        color: "#e9503f",
      },
      {
        id: "duck-eggs",
        name: "Pasture duck eggs",
        category: "eggs",
        amount: 9,
        unit: "dozen",
        priceCents: 800,
        signText: "Big yolks from the splash yard",
        icon: "egg",
        color: "#68b8c9",
      },
      {
        id: "basil-starts",
        name: "Genovese basil starts",
        category: "starts",
        amount: 24,
        unit: "pots",
        priceCents: 300,
        signText: "Hardened off for raised beds",
        icon: "lettuce",
        color: "#4e9f5d",
      },
    ],
  },
  {
    id: "west-orchard",
    name: "West Orchard Cooperative",
    shortName: "WO",
    distance: "1.6 mi",
    neighborhood: "West Davis",
    response: "Replies in about 31 min",
    rating: 4.8,
    reviews: 94,
    location: { type: "Point", coordinates: [-121.7790, 38.5520] },
    coordinates: { x: 62, y: 24, latitude: 38.5520, longitude: -121.7790 },
    ratings: { quality: 4.8, fairness: 4.9, pickup: 4.6 },
    offerings: [
      {
        id: "early-peaches",
        name: "Early peach crate",
        category: "harvest",
        amount: 12,
        unit: "crates",
        priceCents: 2100,
        signText: "Jam ripe, pie ready",
        icon: "strawberry",
        color: "#e9823a",
      },
      {
        id: "pollinator-honey",
        name: "Pollinator row honey",
        category: "preserves",
        amount: 16,
        unit: "jars",
        priceCents: 1100,
        signText: "Small-batch pantry jars",
        icon: "pea",
        color: "#f2bd4b",
      },
      {
        id: "herb-bundles",
        name: "Kitchen herb bundles",
        category: "harvest",
        amount: 30,
        unit: "bundles",
        priceCents: 500,
        signText: "Mint, thyme, oregano, chives",
        icon: "lettuce",
        color: "#7eb56b",
      },
    ],
  },
  {
    id: "solar-acre",
    name: "Solar Acre Ranch",
    shortName: "SA",
    distance: "2.1 mi",
    neighborhood: "North Covell",
    response: "Replies in about 12 min",
    rating: 4.7,
    reviews: 73,
    location: { type: "Point", coordinates: [-121.7460, 38.5650] },
    coordinates: { x: 44, y: 62, latitude: 38.5650, longitude: -121.7460 },
    ratings: { quality: 4.7, fairness: 4.6, pickup: 4.8 },
    offerings: [
      {
        id: "goat-milk",
        name: "Dwarf goat milk",
        category: "dairy",
        amount: 10,
        unit: "half-gal",
        priceCents: 900,
        signText: "Chilled same day",
        icon: "egg",
        color: "#c9823e",
      },
      {
        id: "hen-pullets",
        name: "Heritage hen pullets",
        category: "livestock",
        amount: 6,
        unit: "birds",
        priceCents: 2800,
        signText: "Friendly started pullets",
        icon: "egg",
        color: "#f2bd4b",
      },
      {
        id: "blue-corn",
        name: "Blue corn meal",
        category: "preserves",
        amount: 22,
        unit: "bags",
        priceCents: 750,
        signText: "Stone-ground low-water corn",
        icon: "corn",
        color: "#7067c7",
      },
    ],
  },
  {
    id: "oakshade",
    name: "Oakshade Gardens",
    shortName: "OG",
    distance: "3.4 mi",
    neighborhood: "South Davis",
    response: "Replies in about 42 min",
    rating: 4.6,
    reviews: 57,
    location: { type: "Point", coordinates: [-121.7350, 38.5250] },
    coordinates: { x: 74, y: 68, latitude: 38.5250, longitude: -121.7350 },
    ratings: { quality: 4.6, fairness: 4.7, pickup: 4.4 },
    offerings: [
      {
        id: "lacinato-kale",
        name: "Lacinato kale bunches",
        category: "harvest",
        amount: 36,
        unit: "bunches",
        priceCents: 400,
        signText: "Crisp morning harvest",
        icon: "lettuce",
        color: "#2f6f4e",
      },
      {
        id: "rabbit-compost",
        name: "Rabbit compost blend",
        category: "livestock",
        amount: 18,
        unit: "bags",
        priceCents: 600,
        signText: "Screened for soil blocks",
        icon: "mushroom",
        color: "#9b7a4b",
      },
      {
        id: "medicinal-tea",
        name: "Medicinal tea herbs",
        category: "preserves",
        amount: 20,
        unit: "pouches",
        priceCents: 650,
        signText: "Tulsi, mint, calendula",
        icon: "pea",
        color: "#c95b76",
      },
    ],
  },
];

const myShopOfferings: ShopOffering[] = [
  {
    id: "my-tomatoes",
    name: "North bed tomatoes",
    category: "harvest",
    amount: 11,
    unit: "lb",
    priceCents: 425,
    tradeValueCents: 4700,
    signText: "Slicers with sunny shoulders",
    icon: "tomato",
    color: "#e9503f",
    status: "on shelf",
  },
  {
    id: "my-kale",
    name: "Kale and chard mix",
    category: "harvest",
    amount: 14,
    unit: "bunches",
    priceCents: 375,
    tradeValueCents: 5300,
    signText: "Soup greens and skillet greens",
    icon: "lettuce",
    color: "#4e9f5d",
    status: "barter preferred",
  },
  {
    id: "my-herbs",
    name: "Medicinal herb bundle",
    category: "preserves",
    amount: 10,
    unit: "bundles",
    priceCents: 550,
    tradeValueCents: 5500,
    signText: "Lavender, calendula, mint",
    icon: "pea",
    color: "#7067c7",
    status: "on shelf",
  },
  {
    id: "my-compost",
    name: "Finished compost starter",
    category: "preserves",
    amount: 7,
    unit: "bags",
    priceCents: 700,
    tradeValueCents: 4900,
    signText: "Leaf mold and worm castings",
    icon: "mushroom",
    color: "#c9823e",
    status: "back stock",
  },
];

const myShopRatings: RatingProfile = {
  quality: 4.8,
  fairness: 4.9,
  pickup: 4.7,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>("market");

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.app}>
        <TopBar />
        <View style={styles.screen}>
          {activeTab === "market" ? <MarketScreen /> : <ShopScreen />}
        </View>
        <View style={styles.tabBar}>
          <TabButton active={activeTab === "market"} label="Market" glyph="wagon" onPress={() => setActiveTab("market")} />
          <TabButton active={activeTab === "shop"} label="My Shop" glyph="basket" onPress={() => setActiveTab("shop")} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function TopBar() {
  return (
    <View style={styles.topBar}>
      <Awning />
      <View style={styles.topBarInner}>
        <View style={styles.logoBlock}>
          <PixelGlyph name="sun" />
        </View>
        <View style={styles.topCopy}>
          <Text style={styles.brandText}>Sunpatch</Text>
          <Text style={styles.brandSubtext}>Farm-stand trades nearby</Text>
        </View>
        <View style={styles.weatherBadge}>
          <Text style={styles.weatherValue}>74</Text>
          <Text style={styles.weatherLabel}>SUN</Text>
        </View>
      </View>
    </View>
  );
}

type FarmsRequestState =
  | { status: "loading" }
  | { status: "ready"; snapshot: MarketplaceSnapshot }
  | { status: "error"; message: string; snapshot: MarketplaceSnapshot };

function MarketScreen() {
  const [viewMode, setViewMode] = useState<MarketView>("map");
  const [request, setRequest] = useState<FarmsRequestState>({ status: "loading" });
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [tradeDraft, setTradeDraft] = useState<TradeDraft | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const loadFarms = useCallback(async () => {
    setRequest((current) => (current.status === "ready" ? current : { status: "loading" }));

    try {
      const snapshot = await fetchMarketplaceSnapshot();
      setRequest({ status: "ready", snapshot });
      setSelectedFarmId((current) => current ?? snapshot.farms[0]?.id ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load farms";
      const snapshot: MarketplaceSnapshot = {
        source: "fallback",
        fetchedAt: new Date().toISOString(),
        center: { latitude: 38.5449, longitude: -121.7405 },
        farms: fallbackNearbyFarms,
      };
      setRequest({ status: "error", message, snapshot });
      setSelectedFarmId((current) => current ?? snapshot.farms[0]?.id ?? null);
    }
  }, []);

  useEffect(() => {
    loadFarms();
  }, [loadFarms]);

  const farms =
    request.status === "loading"
      ? fallbackNearbyFarms
      : request.snapshot.farms;
  const center =
    request.status === "loading"
      ? { latitude: 38.5449, longitude: -121.7405 }
      : request.snapshot.center;
  const selectedFarm =
    farms.find((farm) => farm.id === selectedFarmId) ?? farms[0] ?? null;
  const totalShelfItems = farms.reduce((total, farm) => total + farm.offerings.length, 0);
  const dataLabel =
    request.status === "ready"
      ? request.snapshot.source === "mongodb"
        ? "Live from MongoDB"
        : "Fallback dataset"
      : request.status === "error"
        ? "Offline (cached)"
        : "Loading...";

  function startTrade(farm: Farm, offering: Offering, mode: OfferMode) {
    setSelectedFarmId(farm.id);
    setSentMessage(null);
    setTradeDraft({
      farmId: farm.id,
      offeringId: offering.id,
      mode,
      cashOfferCents: Math.max(100, Math.round(offering.priceCents * 0.9)),
      barterIds: mode === "barter" ? [myShopOfferings[0].id] : [],
      note: "",
    });
  }

  function submitTrade(farm: Farm, offering: Offering, draft: TradeDraft) {
    const message =
      draft.mode === "cash"
        ? `${formatMoney(draft.cashOfferCents)} offer sent for ${offering.name}.`
        : `${draft.barterIds.length} barter item${draft.barterIds.length === 1 ? "" : "s"} offered for ${offering.name}.`;

    setSentMessage(`${farm.shortName}: ${message}`);
    setTradeDraft(null);
  }

  return (
    <ScrollView contentContainerStyle={styles.screenScroll} showsVerticalScrollIndicator={false}>
      <PixelPanel headerTone="sky">
        <View style={styles.marketHeader}>
          <View style={styles.marketTitleGroup}>
            <Text style={styles.eyebrow}>Nearby marketplace</Text>
            <Text style={styles.title}>Farm stands open now</Text>
          </View>
          <SegmentedControl
            value={viewMode}
            options={[
              { label: "Map", value: "map" },
              { label: "List", value: "list" },
            ]}
            onChange={setViewMode}
          />
        </View>
        <View style={styles.headerStats}>
          <StatusTag label={`${farms.length} farms`} tone="green" />
          <StatusTag label={`${totalShelfItems} shelf items`} tone="gold" />
          <StatusTag label={dataLabel} tone="blue" />
        </View>
      </PixelPanel>

      {request.status === "error" ? (
        <View style={styles.notice}>
          <PixelGlyph name="sparkle" small />
          <View style={styles.noticeColumn}>
            <Text style={styles.noticeText}>Showing cached farms — couldn&apos;t reach the API.</Text>
            <Text style={styles.noticeMeta}>{request.message}</Text>
            <Text style={styles.noticeMeta}>API: {getApiBaseUrl()}/api/marketplace/farms</Text>
            <Pressable accessibilityRole="button" onPress={loadFarms} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {request.status === "loading" ? (
        <View style={[styles.notice, styles.loadingNotice]}>
          <ActivityIndicator color="#3b2a14" />
          <Text style={styles.noticeText}>Loading farms from MongoDB...</Text>
        </View>
      ) : null}

      {sentMessage ? (
        <View style={styles.notice}>
          <PixelGlyph name="sparkle" small />
          <Text style={styles.noticeText}>{sentMessage}</Text>
        </View>
      ) : null}

      {selectedFarm ? (
        viewMode === "map" ? (
          <>
            <FarmMap
              farms={farms}
              center={center}
              selectedFarmId={selectedFarm.id}
              onSelectFarm={setSelectedFarmId}
            />
            <FarmCard
              farm={selectedFarm}
              expanded
              tradeDraft={tradeDraft}
              onPress={() => setSelectedFarmId(selectedFarm.id)}
              onStartTrade={startTrade}
              onChangeDraft={setTradeDraft}
              onSubmitTrade={submitTrade}
            />
          </>
        ) : (
          farms.map((farm) => (
            <FarmCard
              key={farm.id}
              farm={farm}
              expanded={farm.id === selectedFarmId}
              tradeDraft={tradeDraft?.farmId === farm.id ? tradeDraft : null}
              onPress={() => {
                setSelectedFarmId(farm.id);
                setTradeDraft(null);
              }}
              onStartTrade={startTrade}
              onChangeDraft={setTradeDraft}
              onSubmitTrade={submitTrade}
            />
          ))
        )
      ) : null}
    </ScrollView>
  );
}

function FarmMap({
  farms,
  selectedFarmId,
  center,
  onSelectFarm,
}: {
  farms: Farm[];
  selectedFarmId: string;
  center: { latitude: number; longitude: number };
  onSelectFarm: (farmId: string) => void;
}) {
  if (Platform.OS === "web") {
    return (
      <LeafletFarmMap
        farms={farms}
        selectedFarmId={selectedFarmId}
        center={center}
        onSelectFarm={onSelectFarm}
      />
    );
  }

  return (
    <NativeFarmMap
      farms={farms}
      selectedFarmId={selectedFarmId}
      center={center}
      onSelectFarm={onSelectFarm}
    />
  );
}

function LeafletFarmMap({
  farms,
  selectedFarmId,
  center,
  onSelectFarm,
}: {
  farms: Farm[];
  selectedFarmId: string;
  center: { latitude: number; longitude: number };
  onSelectFarm: (farmId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerLayerRef = useRef<import("leaflet").LayerGroup | null>(null);

  useEffect(() => {
    let disposed = false;

    async function mountMap() {
      const leaflet = await import("leaflet");

      if (!containerRef.current || disposed) {
        return;
      }

      ensureLeafletStyles();

      const map = leaflet.map(containerRef.current, {
        attributionControl: true,
        scrollWheelZoom: true,
        zoomControl: false,
      });

      mapRef.current = map;
      map.setView([center.latitude, center.longitude], 13);
      leaflet
        .tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 20,
          subdomains: "abcd",
        })
        .addTo(map);
      leaflet.control.zoom({ position: "bottomright" }).addTo(map);

      const markerLayer = leaflet.layerGroup().addTo(map);
      markerLayerRef.current = markerLayer;
      farms.forEach((farm) => {
        const marker = leaflet.marker(
          [farm.coordinates.latitude, farm.coordinates.longitude],
          {
            icon: createShopMarkerIcon(leaflet, farm),
            title: farm.name,
          },
        );

        marker
          .addTo(markerLayer)
          .on("click", () => {
            onSelectFarm(farm.id);
            marker.openPopup();
          })
          .bindPopup(
            `<strong>${farm.name}</strong><br>${farm.distance} | ${farm.neighborhood}<br><span>Stand shelf opens below.</span>`,
            { closeButton: false },
          );
      });

      window.setTimeout(() => map.invalidateSize(), 0);
    }

    mountMap();

    return () => {
      disposed = true;
      markerLayerRef.current?.clearLayers();
      mapRef.current?.remove();
      markerLayerRef.current = null;
      mapRef.current = null;
    };
  }, [farms, center.latitude, center.longitude, onSelectFarm]);

  useEffect(() => {
    const selectedFarm = farms.find((farm) => farm.id === selectedFarmId);

    if (!selectedFarm || !mapRef.current) {
      return;
    }

    mapRef.current.flyTo(
      [selectedFarm.coordinates.latitude, selectedFarm.coordinates.longitude],
      Math.max(mapRef.current.getZoom(), 14),
      { duration: 0.65 },
    );
  }, [farms, selectedFarmId]);

  const selectedFarm = farms.find((farm) => farm.id === selectedFarmId);

  return (
    <View style={[styles.pixelPanel, styles.leafletPanel]}>
      <View style={styles.mapHud}>
        <View>
          <Text style={styles.legendLabel}>Real map</Text>
          <Text style={styles.legendValue}>CARTO Voyager | Davis, CA</Text>
        </View>
        {selectedFarm ? <StatusTag label={selectedFarm.name} tone="cream" /> : null}
      </View>
      {createElement("div", {
        className: "sunpatch-leaflet-host",
        ref: containerRef,
        style: leafletHostStyle,
      })}
    </View>
  );
}

function createShopMarkerIcon(leaflet: typeof import("leaflet"), farm: Farm) {
  return leaflet.divIcon({
    className: "sunpatch-shop-marker",
    html: `
      <button type="button" class="sunpatch-shop-marker-button" aria-label="Open ${escapeHtml(farm.name)} stand">
        <span class="sunpatch-shop-roof"></span>
        <span class="sunpatch-shop-body">${escapeHtml(farm.shortName)}</span>
        <span class="sunpatch-shop-wheels"></span>
      </button>
    `,
    iconAnchor: [26, 52],
    iconSize: [52, 56],
    popupAnchor: [0, -48],
  });
}

function ensureLeafletStyles() {
  if (typeof document === "undefined") {
    return;
  }

  if (!document.getElementById("sunpatch-leaflet-css")) {
    const link = document.createElement("link");
    link.id = "sunpatch-leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }

  if (document.getElementById("sunpatch-map-css")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "sunpatch-map-css";
  style.textContent = `
    .sunpatch-leaflet-host,
    .sunpatch-leaflet-host .leaflet-container {
      background: #b8dde6;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      height: 100%;
      width: 100%;
    }

    .sunpatch-leaflet-host .leaflet-control-attribution {
      border: 2px solid #3b2a14;
      color: #5e4a26;
      font-size: 10px;
      font-weight: 800;
    }

    .sunpatch-leaflet-host .leaflet-control-zoom {
      border: 2px solid #3b2a14;
      box-shadow: 0 2px 0 #3b2a14;
    }

    .sunpatch-leaflet-host .leaflet-control-zoom a {
      background: #fffdf5;
      color: #2d2313;
      font-weight: 900;
    }

    .sunpatch-shop-marker {
      background: transparent;
      border: 0;
    }

    .sunpatch-shop-marker-button {
      align-items: center;
      background: transparent;
      border: 0;
      cursor: pointer;
      display: grid;
      height: 56px;
      justify-items: center;
      padding: 0;
      width: 52px;
    }

    .sunpatch-shop-roof {
      background: repeating-linear-gradient(90deg, #c1492f 0 7px, #fffdf5 7px 14px);
      border: 2px solid #3b2a14;
      box-shadow: 0 2px 0 #3b2a14;
      height: 15px;
      width: 46px;
    }

    .sunpatch-shop-body {
      background: #ffe89a;
      border: 2px solid #3b2a14;
      box-shadow: 0 3px 0 #3b2a14;
      color: #2d2313;
      font-size: 12px;
      font-weight: 900;
      line-height: 24px;
      min-height: 28px;
      text-align: center;
      width: 38px;
    }

    .sunpatch-shop-wheels {
      background:
        linear-gradient(#3b2a14, #3b2a14) 8px 0 / 7px 7px no-repeat,
        linear-gradient(#3b2a14, #3b2a14) 30px 0 / 7px 7px no-repeat;
      height: 8px;
      width: 46px;
    }

    .leaflet-popup-content-wrapper {
      border: 2px solid #3b2a14;
      border-radius: 0;
      color: #2d2313;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      font-weight: 800;
      box-shadow: 0 3px 0 #3b2a14;
    }

    .leaflet-popup-tip {
      border: 2px solid #3b2a14;
      box-shadow: none;
    }
  `;
  document.head.appendChild(style);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function FarmCard({
  farm,
  expanded,
  tradeDraft,
  onPress,
  onStartTrade,
  onChangeDraft,
  onSubmitTrade,
}: {
  farm: Farm;
  expanded: boolean;
  tradeDraft: TradeDraft | null;
  onPress: () => void;
  onStartTrade: (farm: Farm, offering: Offering, mode: OfferMode) => void;
  onChangeDraft: (draft: TradeDraft | null) => void;
  onSubmitTrade: (farm: Farm, offering: Offering, draft: TradeDraft) => void;
}) {
  const shelfCount = farm.offerings.reduce((total, offering) => total + offering.amount, 0);

  return (
    <View style={[styles.pixelPanel, expanded && styles.panelActive]}>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.farmCardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{farm.shortName}</Text>
        </View>
        <View style={styles.farmHeaderCopy}>
          <Text style={styles.farmName}>{farm.name}</Text>
          <Text style={styles.farmMeta}>
            {farm.distance} | {farm.neighborhood}
          </Text>
        </View>
        <View style={styles.scoreSign}>
          <Text style={styles.scoreValue}>{farm.rating.toFixed(1)}</Text>
          <Text style={styles.scoreLabel}>{farm.reviews}</Text>
        </View>
      </Pressable>
      <View style={styles.farmChips}>
        <StatusTag label={`${shelfCount} units`} tone="green" />
        <StatusTag label={farm.response} tone="cream" />
      </View>

      {expanded ? (
        <View style={styles.expandedFarm}>
          <RatingGrid ratings={farm.ratings} />
          <Text style={styles.sectionLabel}>Shelf cards</Text>
          {farm.offerings.map((offering) => (
            <View key={offering.id} style={styles.offeringBlock}>
              <OfferingShelfCard
                offering={offering}
                onOffer={() => onStartTrade(farm, offering, "cash")}
                onBarter={() => onStartTrade(farm, offering, "barter")}
              />
              {tradeDraft?.offeringId === offering.id ? (
                <TradeComposer
                  draft={tradeDraft}
                  offering={offering}
                  farm={farm}
                  onChange={onChangeDraft}
                  onSubmit={() => onSubmitTrade(farm, offering, tradeDraft)}
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function OfferingShelfCard({
  offering,
  onOffer,
  onBarter,
}: {
  offering: Offering;
  onOffer: () => void;
  onBarter: () => void;
}) {
  return (
    <View style={styles.shelfCard}>
      <View style={[styles.imageSlot, { backgroundColor: `${offering.color}22` }]}>
        <Image alt={`${offering.name} icon`} source={inventoryIcons[offering.icon]} style={styles.itemIcon} resizeMode="contain" />
        <View style={[styles.colorTile, { backgroundColor: offering.color }]} />
      </View>
      <View style={styles.offeringCopy}>
        <View style={styles.cardTopLine}>
          <Text style={styles.offeringName}>{offering.name}</Text>
          <CategoryBadge category={offering.category} />
        </View>
        <Text style={styles.itemQuantity}>
          {offering.amount} {offering.unit} available
        </Text>
        <Text style={styles.signText}>{offering.signText}</Text>
      </View>
      <View style={styles.priceRail}>
        <Text style={styles.price}>{formatMoney(offering.priceCents)}</Text>
        <Text style={styles.unit}>/{singularUnit(offering.unit)}</Text>
        <View style={styles.cardActions}>
          <PixelButton label="Offer" tone="gold" onPress={onOffer} />
          <PixelButton label="Barter" tone="cream" onPress={onBarter} />
        </View>
      </View>
    </View>
  );
}

function TradeComposer({
  farm,
  offering,
  draft,
  onChange,
  onSubmit,
}: {
  farm: Farm;
  offering: Offering;
  draft: TradeDraft;
  onChange: (draft: TradeDraft | null) => void;
  onSubmit: () => void;
}) {
  const barterTotal = useMemo(
    () =>
      myShopOfferings
        .filter((item) => draft.barterIds.includes(item.id))
        .reduce((total, item) => total + item.tradeValueCents, 0),
    [draft.barterIds],
  );

  function setMode(mode: OfferMode) {
    onChange({
      ...draft,
      mode,
      barterIds: mode === "barter" && draft.barterIds.length === 0 ? [myShopOfferings[0].id] : draft.barterIds,
    });
  }

  function toggleBarter(itemId: string) {
    onChange({
      ...draft,
      barterIds: draft.barterIds.includes(itemId)
        ? draft.barterIds.filter((id) => id !== itemId)
        : [...draft.barterIds, itemId],
    });
  }

  return (
    <View style={styles.tradeBox}>
      <View style={styles.tradeHeader}>
        <View style={styles.tradeHeaderCopy}>
          <Text style={styles.tradeTitle}>Counter sign</Text>
          <Text style={styles.tradeSubtitle}>
            {farm.shortName} sees this with your shop rating for {offering.name}.
          </Text>
        </View>
        <SegmentedControl
          value={draft.mode}
          compact
          options={[
            { label: "Cash", value: "cash" },
            { label: "Barter", value: "barter" },
          ]}
          onChange={setMode}
        />
      </View>

      {draft.mode === "cash" ? (
        <View style={styles.cashControls}>
          <StepButton label="-" onPress={() => onChange({ ...draft, cashOfferCents: Math.max(50, draft.cashOfferCents - 50) })} />
          <Text style={styles.cashAmount}>{formatMoney(draft.cashOfferCents)}</Text>
          <StepButton label="+" onPress={() => onChange({ ...draft, cashOfferCents: draft.cashOfferCents + 50 })} />
        </View>
      ) : (
        <View style={styles.barterShelf}>
          {myShopOfferings.map((item) => {
            const active = draft.barterIds.includes(item.id);

            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => toggleBarter(item.id)}
                style={[styles.barterChip, active && styles.barterChipActive]}
              >
                <Image alt={`${item.name} icon`} source={inventoryIcons[item.icon]} style={styles.chipIcon} resizeMode="contain" />
                <Text style={[styles.barterChipText, active && styles.barterChipTextActive]}>{item.name}</Text>
              </Pressable>
            );
          })}
          <Text style={styles.barterTotal}>Trade value: {formatMoney(barterTotal)}</Text>
        </View>
      )}

      <TextInput
        value={draft.note}
        onChangeText={(note) => onChange({ ...draft, note })}
        placeholder="Pickup note"
        placeholderTextColor="#9a8a66"
        style={styles.noteInput}
      />
      <View style={styles.tradeActions}>
        <PixelButton label="Cancel" tone="cream" onPress={() => onChange(null)} />
        <PixelButton label="Send offer" tone="gold" wide onPress={onSubmit} />
      </View>
    </View>
  );
}

function ShopScreen() {
  const totalDisplayed = myShopOfferings
    .filter((item) => item.status === "on shelf" || item.status === "barter preferred")
    .reduce((sum, item) => sum + item.amount, 0);
  const averageRating = (myShopRatings.quality + myShopRatings.fairness + myShopRatings.pickup) / 3;

  return (
    <ScrollView contentContainerStyle={styles.screenScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.pixelPanel}>
        <Awning />
        <View style={styles.shopHero}>
          <View style={styles.logoBlockLarge}>
            <PixelGlyph name="wagon" />
          </View>
          <View style={styles.shopHeroCopy}>
            <Text style={styles.eyebrow}>Farm stand</Text>
            <Text style={styles.title}>North Bed Stand</Text>
            <Text style={styles.itemQuantity}>4 active shelf cards | Davis, CA</Text>
          </View>
          <View style={styles.scoreSign}>
            <Text style={styles.scoreValue}>{averageRating.toFixed(1)}</Text>
            <Text style={styles.scoreLabel}>rating</Text>
          </View>
        </View>
        <View style={styles.headerStats}>
          <StatusTag label={`${totalDisplayed} units`} tone="green" />
          <StatusTag label="14 min replies" tone="blue" />
          <StatusTag label="38 trades" tone="gold" />
        </View>
      </View>

      <View style={styles.pixelPanel}>
        <View style={styles.panelHeaderNeed}>
          <PixelGlyph name="sparkle" small />
          <Text style={styles.panelHeaderText}>Shop ratings</Text>
        </View>
        <View style={styles.panelBody}>
          <RatingGrid ratings={myShopRatings} />
        </View>
      </View>

      <View style={styles.pixelPanel}>
        <View style={styles.panelHeaderNeed}>
          <PixelGlyph name="basket" small />
          <Text style={styles.panelHeaderText}>Current offerings</Text>
        </View>
        <View style={styles.panelBody}>
          {myShopOfferings.map((offering) => (
            <ShopOfferingCard key={offering.id} offering={offering} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function ShopOfferingCard({ offering }: { offering: ShopOffering }) {
  return (
    <View style={styles.shopOfferingCard}>
      <View style={[styles.imageSlotSmall, { backgroundColor: `${offering.color}22` }]}>
        <Image alt={`${offering.name} icon`} source={inventoryIcons[offering.icon]} style={styles.itemIconSmall} resizeMode="contain" />
      </View>
      <View style={styles.shopOfferingCopy}>
        <View style={styles.cardTopLine}>
          <Text style={styles.offeringName}>{offering.name}</Text>
          <CategoryBadge category={offering.category} />
        </View>
        <Text style={styles.itemQuantity}>
          {offering.amount} {offering.unit} available | {formatMoney(offering.priceCents)}/{singularUnit(offering.unit)}
        </Text>
        <Text style={styles.signText}>{offering.signText}</Text>
      </View>
      <View style={styles.statusSign}>
        <Text style={styles.statusSignText}>{offering.status}</Text>
      </View>
    </View>
  );
}

function RatingGrid({ ratings }: { ratings: RatingProfile }) {
  return (
    <View style={styles.ratingGrid}>
      <RatingTile label="Quality" value={ratings.quality} />
      <RatingTile label="Fairness" value={ratings.fairness} />
      <RatingTile label="Pickup" value={ratings.pickup} />
    </View>
  );
}

function RatingTile({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.ratingTile}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <Text style={styles.ratingValue}>{value.toFixed(1)}</Text>
    </View>
  );
}

function CategoryBadge({ category }: { category: Category }) {
  const tone = categoryTone[category];

  return (
    <View style={[styles.categoryBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.categoryBadgeText, { color: tone.text }]}>{categoryLabels[category]}</Text>
    </View>
  );
}

function StatusTag({ label, tone }: { label: string; tone: "green" | "gold" | "blue" | "cream" }) {
  const toneStyle =
    tone === "green"
      ? styles.statusGreen
      : tone === "gold"
        ? styles.statusGold
        : tone === "blue"
          ? styles.statusBlue
          : styles.statusCream;

  return (
    <View style={[styles.statusTag, toneStyle]}>
      <Text style={styles.statusTagText}>{label}</Text>
    </View>
  );
}

function PixelPanel({
  children,
  headerTone,
}: {
  children: ReactNode;
  headerTone?: "sky";
}) {
  return (
    <View style={[styles.pixelPanel, headerTone === "sky" && styles.skyPanel]}>
      {children}
    </View>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  compact,
  onChange,
}: {
  value: T;
  options: { label: string; value: T }[];
  compact?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <View style={[styles.segmented, compact && styles.segmentedCompact]}>
      {options.map((option) => {
        const active = option.value === value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[styles.segmentButton, compact && styles.segmentButtonCompact, active && styles.segmentButtonActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TabButton({
  active,
  label,
  glyph,
  onPress,
}: {
  active: boolean;
  label: string;
  glyph: PixelGlyphName;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tabButton, active && styles.tabButtonActive]}
    >
      <PixelGlyph name={glyph} small />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function PixelButton({
  label,
  tone,
  wide,
  onPress,
}: {
  label: string;
  tone: "gold" | "cream";
  wide?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.pixelButton, tone === "gold" ? styles.pixelButtonGold : styles.pixelButtonCream, wide && styles.pixelButtonWide]}
    >
      <Text style={styles.pixelButtonText}>{label}</Text>
    </Pressable>
  );
}

function StepButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.stepButton}>
      <Text style={styles.stepButtonText}>{label}</Text>
    </Pressable>
  );
}

function Awning() {
  return (
    <View style={styles.awning}>
      {Array.from({ length: 18 }).map((_, index) => (
        <View key={index} style={[styles.awningStripe, index % 2 === 0 ? styles.awningStripeRed : styles.awningStripeCream]} />
      ))}
    </View>
  );
}

type PixelGlyphName = "basket" | "sparkle" | "sun" | "wagon";

function PixelGlyph({ name, small }: { name: PixelGlyphName; small?: boolean }) {
  const size = small ? 18 : 28;
  const glyphStyle = { width: size, height: size };

  if (name === "sun") {
    return (
      <View style={[glyphStyle, styles.glyphCanvas]}>
        <View style={styles.sunCore} />
        <View style={[styles.glyphPixel, styles.sunRayTop]} />
        <View style={[styles.glyphPixel, styles.sunRayLeft]} />
        <View style={[styles.glyphPixel, styles.sunRayRight]} />
        <View style={[styles.glyphPixel, styles.sunRayBottom]} />
      </View>
    );
  }

  if (name === "wagon") {
    return (
      <View style={[glyphStyle, styles.glyphCanvas]}>
        <View style={styles.wagonBody} />
        <View style={styles.wagonHandle} />
        <View style={styles.wagonWheelLeft} />
        <View style={styles.wagonWheelRight} />
      </View>
    );
  }

  if (name === "basket") {
    return (
      <View style={[glyphStyle, styles.glyphCanvas]}>
        <View style={styles.basketTop} />
        <View style={styles.basketBody} />
        <View style={styles.basketHandle} />
      </View>
    );
  }

  return (
    <View style={[glyphStyle, styles.glyphCanvas]}>
      <View style={styles.sparkleCenter} />
      <View style={styles.sparkleTall} />
      <View style={styles.sparkleWide} />
    </View>
  );
}

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function singularUnit(unit: string) {
  if (unit.endsWith("s")) {
    return unit.slice(0, -1);
  }

  return unit;
}

const monoFont = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "Courier New",
});

const leafletHostStyle = {
  bottom: 0,
  left: 0,
  position: "absolute",
  right: 0,
  top: 0,
} as const;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
  app: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
  screen: {
    flex: 1,
  },
  screenScroll: {
    gap: 14,
    padding: 14,
    paddingBottom: 28,
  },
  topBar: {
    backgroundColor: colors.cream,
    borderBottomColor: colors.soil,
    borderBottomWidth: 2,
  },
  topBarInner: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  logoBlock: {
    alignItems: "center",
    backgroundColor: colors.sun,
    borderColor: colors.soil,
    borderWidth: 2,
    height: 40,
    justifyContent: "center",
    shadowColor: colors.soil,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    width: 40,
  },
  logoBlockLarge: {
    alignItems: "center",
    backgroundColor: colors.warmCream,
    borderColor: colors.soil,
    borderWidth: 2,
    height: 52,
    justifyContent: "center",
    shadowColor: colors.soil,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    width: 52,
  },
  topCopy: {
    flex: 1,
    minWidth: 0,
  },
  brandText: {
    color: "#34432b",
    fontFamily: monoFont,
    fontSize: 17,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  brandSubtext: {
    color: "#5f563f",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
  },
  weatherBadge: {
    alignItems: "center",
    backgroundColor: colors.sun,
    borderColor: colors.soil,
    borderWidth: 2,
    minWidth: 48,
    paddingHorizontal: 8,
    paddingVertical: 5,
    shadowColor: colors.soil,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  weatherValue: {
    color: colors.text,
    fontFamily: monoFont,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 19,
  },
  weatherLabel: {
    color: colors.text,
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: "900",
  },
  awning: {
    borderBottomColor: colors.soil,
    borderBottomWidth: 2,
    flexDirection: "row",
    height: 12,
    overflow: "hidden",
  },
  awningStripe: {
    flex: 1,
  },
  awningStripeRed: {
    backgroundColor: colors.red,
  },
  awningStripeCream: {
    backgroundColor: colors.cream,
  },
  pixelPanel: {
    backgroundColor: colors.cream,
    borderColor: colors.soil,
    borderWidth: 2,
    shadowColor: colors.soil,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  skyPanel: {
    backgroundColor: "#d8ecd6",
  },
  panelActive: {
    borderColor: colors.leaf,
  },
  marketHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
    padding: 14,
  },
  marketTitleGroup: {
    flex: 1,
    minWidth: 210,
  },
  eyebrow: {
    color: colors.leaf,
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28,
    marginTop: 3,
  },
  headerStats: {
    borderTopColor: colors.soil,
    borderTopWidth: 2,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 10,
  },
  notice: {
    alignItems: "center",
    backgroundColor: "#fff4dc",
    borderColor: "#d8a05a",
    borderWidth: 2,
    flexDirection: "row",
    gap: 8,
    padding: 10,
    shadowColor: "#a8761c",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  noticeText: {
    color: "#7a461f",
    flex: 1,
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  noticeColumn: {
    flex: 1,
    gap: 4,
  },
  noticeMeta: {
    color: "#5e4a26",
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: "700",
  },
  loadingNotice: {
    backgroundColor: "#f3eccd",
    borderColor: "#a0884a",
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.gold,
    borderColor: colors.soil,
    borderWidth: 2,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: colors.soil,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  retryButtonText: {
    color: colors.text,
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  segmented: {
    backgroundColor: colors.cream,
    borderColor: colors.wood,
    borderWidth: 2,
    flexDirection: "row",
    padding: 2,
  },
  segmentedCompact: {
    alignSelf: "flex-start",
  },
  segmentButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    minWidth: 58,
    paddingHorizontal: 10,
  },
  segmentButtonCompact: {
    minHeight: 30,
    minWidth: 54,
    paddingHorizontal: 8,
  },
  segmentButtonActive: {
    backgroundColor: colors.leaf,
  },
  segmentText: {
    color: "#7a6843",
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: "900",
  },
  segmentTextActive: {
    color: colors.cream,
  },
  statusTag: {
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusGreen: {
    backgroundColor: "#eef8df",
    borderColor: "#9bc278",
  },
  statusGold: {
    backgroundColor: "#fff1dc",
    borderColor: "#efb16b",
  },
  statusBlue: {
    backgroundColor: "#e4f7f8",
    borderColor: "#68b8c9",
  },
  statusCream: {
    backgroundColor: colors.warmCream,
    borderColor: colors.woodLight,
  },
  statusTagText: {
    color: "#5e4a26",
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  leafletPanel: {
    backgroundColor: colors.sky,
    height: 365,
    overflow: "hidden",
    position: "relative",
  },
  mapHud: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    left: 10,
    position: "absolute",
    right: 10,
    top: 10,
    zIndex: 500,
  },
  legendLabel: {
    color: colors.text,
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  legendValue: {
    color: "#5f563f",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  farmCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.leaf,
    borderColor: colors.soil,
    borderWidth: 2,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  avatarText: {
    color: colors.cream,
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: "900",
  },
  farmHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  farmName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 20,
  },
  farmMeta: {
    color: "#5f563f",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  scoreSign: {
    alignItems: "center",
    backgroundColor: colors.sun,
    borderColor: colors.soil,
    borderWidth: 2,
    minWidth: 56,
    paddingHorizontal: 8,
    paddingVertical: 5,
    shadowColor: colors.soil,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  scoreValue: {
    color: colors.text,
    fontFamily: monoFont,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20,
  },
  scoreLabel: {
    color: colors.text,
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  farmChips: {
    borderTopColor: colors.soil,
    borderTopWidth: 2,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 10,
  },
  expandedFarm: {
    backgroundColor: colors.shelf,
    borderTopColor: colors.soil,
    borderTopWidth: 2,
    gap: 12,
    padding: 10,
  },
  ratingGrid: {
    flexDirection: "row",
    gap: 8,
  },
  ratingTile: {
    backgroundColor: colors.warmCream,
    borderColor: colors.woodLight,
    borderWidth: 2,
    flex: 1,
    padding: 9,
  },
  ratingLabel: {
    color: colors.leaf,
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  ratingValue: {
    color: colors.text,
    fontFamily: monoFont,
    fontSize: 21,
    fontWeight: "900",
    marginTop: 2,
  },
  sectionLabel: {
    color: colors.text,
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  offeringBlock: {
    gap: 8,
  },
  shelfCard: {
    alignItems: "flex-start",
    backgroundColor: colors.cream,
    borderColor: colors.wood,
    borderWidth: 2,
    flexDirection: "row",
    gap: 10,
    padding: 9,
    shadowColor: colors.wood,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  imageSlot: {
    alignItems: "center",
    borderColor: colors.soil,
    borderWidth: 2,
    height: 66,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    width: 66,
  },
  imageSlotSmall: {
    alignItems: "center",
    borderColor: colors.soil,
    borderWidth: 2,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  itemIcon: {
    height: 42,
    width: 42,
  },
  itemIconSmall: {
    height: 31,
    width: 31,
  },
  colorTile: {
    borderColor: colors.soil,
    borderWidth: 1,
    bottom: 4,
    height: 10,
    position: "absolute",
    right: 4,
    width: 10,
  },
  offeringCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardTopLine: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "space-between",
  },
  offeringName: {
    color: "#2d311f",
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 19,
    minWidth: 120,
  },
  categoryBadge: {
    borderWidth: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  categoryBadgeText: {
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  itemQuantity: {
    color: "#5e4a26",
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  signText: {
    color: "#6f3f1c",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 5,
  },
  priceRail: {
    alignItems: "flex-end",
    gap: 5,
    maxWidth: 88,
  },
  price: {
    color: colors.text,
    fontFamily: monoFont,
    fontSize: 15,
    fontWeight: "900",
  },
  unit: {
    color: "#7a6843",
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: "900",
    marginTop: -5,
  },
  cardActions: {
    gap: 6,
  },
  pixelButton: {
    alignItems: "center",
    borderColor: colors.soil,
    borderWidth: 2,
    minHeight: 31,
    justifyContent: "center",
    paddingHorizontal: 8,
    shadowColor: colors.soil,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  pixelButtonGold: {
    backgroundColor: colors.sun,
  },
  pixelButtonCream: {
    backgroundColor: colors.cream,
  },
  pixelButtonWide: {
    flex: 1,
  },
  pixelButtonText: {
    color: colors.text,
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  tradeBox: {
    backgroundColor: "#fff4dc",
    borderColor: "#d8a05a",
    borderWidth: 2,
    gap: 10,
    padding: 10,
    shadowColor: "#a8761c",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  tradeHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  tradeHeaderCopy: {
    flex: 1,
    minWidth: 170,
  },
  tradeTitle: {
    color: colors.text,
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  tradeSubtitle: {
    color: "#7a6843",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
    marginTop: 2,
  },
  cashControls: {
    alignItems: "center",
    backgroundColor: colors.warmCream,
    borderColor: colors.woodLight,
    borderWidth: 2,
    flexDirection: "row",
    gap: 10,
    padding: 8,
  },
  stepButton: {
    alignItems: "center",
    backgroundColor: colors.cream,
    borderColor: colors.soil,
    borderWidth: 2,
    height: 36,
    justifyContent: "center",
    width: 42,
  },
  stepButtonText: {
    color: colors.text,
    fontFamily: monoFont,
    fontSize: 20,
    fontWeight: "900",
  },
  cashAmount: {
    color: colors.text,
    flex: 1,
    fontFamily: monoFont,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  barterShelf: {
    backgroundColor: colors.warmCream,
    borderColor: colors.woodLight,
    borderWidth: 2,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 8,
  },
  barterChip: {
    alignItems: "center",
    backgroundColor: colors.cream,
    borderColor: colors.woodLight,
    borderWidth: 2,
    flexDirection: "row",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 8,
  },
  barterChipActive: {
    backgroundColor: colors.leaf,
    borderColor: colors.soil,
  },
  chipIcon: {
    height: 18,
    width: 18,
  },
  barterChipText: {
    color: colors.text,
    flexShrink: 1,
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: "900",
  },
  barterChipTextActive: {
    color: colors.cream,
  },
  barterTotal: {
    color: colors.text,
    flexBasis: "100%",
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  noteInput: {
    backgroundColor: colors.cream,
    borderColor: colors.woodLight,
    borderWidth: 2,
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tradeActions: {
    flexDirection: "row",
    gap: 8,
  },
  shopHero: {
    alignItems: "center",
    backgroundColor: colors.sky,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  shopHeroCopy: {
    flex: 1,
    minWidth: 0,
  },
  panelHeaderNeed: {
    alignItems: "center",
    backgroundColor: "#f1c187",
    borderBottomColor: colors.soil,
    borderBottomWidth: 2,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  panelHeaderText: {
    color: colors.text,
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  panelBody: {
    backgroundColor: colors.shelf,
    gap: 10,
    padding: 10,
  },
  shopOfferingCard: {
    alignItems: "flex-start",
    backgroundColor: colors.cream,
    borderColor: colors.woodLight,
    borderWidth: 2,
    flexDirection: "row",
    gap: 10,
    padding: 9,
    shadowColor: colors.woodLight,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  shopOfferingCopy: {
    flex: 1,
    minWidth: 0,
  },
  statusSign: {
    backgroundColor: colors.warmCream,
    borderColor: colors.soil,
    borderWidth: 2,
    maxWidth: 76,
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  statusSignText: {
    color: "#5e4a26",
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase",
  },
  tabBar: {
    backgroundColor: colors.cream,
    borderTopColor: colors.soil,
    borderTopWidth: 2,
    flexDirection: "row",
    gap: 10,
    paddingBottom: Platform.OS === "ios" ? 4 : 12,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  tabButton: {
    alignItems: "center",
    backgroundColor: colors.warmCream,
    borderColor: colors.woodLight,
    borderWidth: 2,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 44,
    shadowColor: colors.woodLight,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  tabButtonActive: {
    backgroundColor: colors.leaf,
    borderColor: colors.soil,
  },
  tabText: {
    color: "#7a6843",
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  tabTextActive: {
    color: colors.cream,
  },
  glyphCanvas: {
    position: "relative",
  },
  glyphPixel: {
    backgroundColor: "currentColor",
    height: 5,
    position: "absolute",
    width: 5,
  },
  sunCore: {
    backgroundColor: colors.gold,
    borderColor: colors.soil,
    borderWidth: 2,
    height: "52%",
    left: "24%",
    position: "absolute",
    top: "24%",
    width: "52%",
  },
  sunRayTop: {
    backgroundColor: colors.orange,
    left: "42%",
    top: 0,
  },
  sunRayLeft: {
    backgroundColor: colors.orange,
    left: 0,
    top: "42%",
  },
  sunRayRight: {
    backgroundColor: colors.orange,
    right: 0,
    top: "42%",
  },
  sunRayBottom: {
    backgroundColor: colors.orange,
    bottom: 0,
    left: "42%",
  },
  wagonBody: {
    backgroundColor: colors.orange,
    borderColor: colors.soil,
    borderWidth: 2,
    bottom: "24%",
    height: "38%",
    left: "10%",
    position: "absolute",
    width: "70%",
  },
  wagonHandle: {
    backgroundColor: colors.soil,
    height: 3,
    position: "absolute",
    right: 0,
    top: "40%",
    transform: [{ rotate: "-25deg" }],
    width: "32%",
  },
  wagonWheelLeft: {
    backgroundColor: colors.soil,
    bottom: "8%",
    height: "18%",
    left: "18%",
    position: "absolute",
    width: "18%",
  },
  wagonWheelRight: {
    backgroundColor: colors.soil,
    bottom: "8%",
    height: "18%",
    left: "58%",
    position: "absolute",
    width: "18%",
  },
  basketTop: {
    backgroundColor: colors.wood,
    height: "16%",
    left: "14%",
    position: "absolute",
    top: "34%",
    width: "72%",
  },
  basketBody: {
    backgroundColor: "#c5b074",
    borderColor: colors.soil,
    borderWidth: 2,
    bottom: "12%",
    height: "40%",
    left: "16%",
    position: "absolute",
    width: "68%",
  },
  basketHandle: {
    borderColor: colors.soil,
    borderTopWidth: 2,
    height: "34%",
    left: "24%",
    position: "absolute",
    top: "12%",
    width: "52%",
  },
  sparkleCenter: {
    backgroundColor: colors.gold,
    height: "30%",
    left: "35%",
    position: "absolute",
    top: "35%",
    width: "30%",
  },
  sparkleTall: {
    backgroundColor: colors.gold,
    height: "80%",
    left: "43%",
    position: "absolute",
    top: "10%",
    width: "14%",
  },
  sparkleWide: {
    backgroundColor: colors.gold,
    height: "14%",
    left: "10%",
    position: "absolute",
    top: "43%",
    width: "80%",
  },
});
