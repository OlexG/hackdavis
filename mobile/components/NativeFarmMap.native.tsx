import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from "react-native-maps";

import type { MarketFarm } from "../lib/marketplace";

type Props = {
  farms: MarketFarm[];
  selectedFarmId: string;
  center: { latitude: number; longitude: number };
  onSelectFarm: (farmId: string) => void;
};

const SOIL = "#3b2a14";
const CREAM = "#fffdf5";
const GOLD = "#ffe89a";
const RED = "#c1492f";

export default function NativeFarmMap({ farms, selectedFarmId, center, onSelectFarm }: Props) {
  const mapRef = useRef<MapView | null>(null);
  const initialRegion: Region = {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: 0.045,
    longitudeDelta: 0.045,
  };

  // Pan/zoom to the active farm whenever the selection changes.
  useEffect(() => {
    const farm = farms.find((entry) => entry.id === selectedFarmId);
    if (!farm || !mapRef.current) {
      return;
    }
    mapRef.current.animateToRegion(
      {
        latitude: farm.coordinates.latitude,
        longitude: farm.coordinates.longitude,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      },
      650,
    );
  }, [farms, selectedFarmId]);

  const selectedFarm = farms.find((entry) => entry.id === selectedFarmId);

  return (
    <View style={styles.panel}>
      <View style={styles.hud}>
        <View>
          <Text style={styles.legendLabel}>Real map</Text>
          <Text style={styles.legendValue}>Davis, CA | live trade radius</Text>
        </View>
        {selectedFarm ? (
          <View style={styles.activeChip}>
            <Text style={styles.activeChipText}>{selectedFarm.name}</Text>
          </View>
        ) : null}
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}
        loadingEnabled
      >
        {farms.map((farm) => (
          <Marker
            key={farm.id}
            identifier={farm.id}
            coordinate={{
              latitude: farm.coordinates.latitude,
              longitude: farm.coordinates.longitude,
            }}
            title={farm.name}
            description={`${farm.distance} | ${farm.neighborhood}`}
            tracksViewChanges={false}
            onPress={() => onSelectFarm(farm.id)}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Select ${farm.name}`}
              onPress={() => onSelectFarm(farm.id)}
              style={[styles.pin, farm.id === selectedFarmId && styles.pinActive]}
            >
              <View style={styles.pinRoof} />
              <View style={styles.pinBody}>
                <Text style={styles.pinText}>{farm.shortName}</Text>
              </View>
              <View style={styles.pinWheels} />
            </Pressable>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: CREAM,
    borderColor: SOIL,
    borderWidth: 2,
    overflow: "hidden",
    shadowColor: SOIL,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  hud: {
    alignItems: "center",
    backgroundColor: "#fbf6e8",
    borderBottomColor: SOIL,
    borderBottomWidth: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  legendLabel: {
    color: "#5e4a26",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  legendValue: {
    color: "#2d2313",
    fontSize: 12,
    fontWeight: "800",
  },
  activeChip: {
    backgroundColor: GOLD,
    borderColor: SOIL,
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activeChipText: {
    color: "#2d2313",
    fontSize: 11,
    fontWeight: "900",
  },
  map: {
    height: 320,
    width: "100%",
  },
  pin: {
    alignItems: "center",
  },
  pinActive: {
    transform: [{ scale: 1.1 }],
  },
  pinRoof: {
    backgroundColor: RED,
    borderColor: SOIL,
    borderWidth: 2,
    height: 10,
    width: 42,
  },
  pinBody: {
    alignItems: "center",
    backgroundColor: GOLD,
    borderColor: SOIL,
    borderWidth: 2,
    justifyContent: "center",
    minHeight: 26,
    width: 38,
  },
  pinText: {
    color: "#2d2313",
    fontSize: 11,
    fontWeight: "900",
  },
  pinWheels: {
    backgroundColor: SOIL,
    height: 4,
    width: 38,
  },
});
