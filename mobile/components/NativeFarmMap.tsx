// Web stub: react-native-maps does not run in the browser, so we render
// nothing here and let App.tsx fall back to the Leaflet implementation.
import type { MarketFarm } from "../lib/marketplace";

type Props = {
  farms: MarketFarm[];
  selectedFarmId: string;
  center: { latitude: number; longitude: number };
  onSelectFarm: (farmId: string) => void;
};

export default function NativeFarmMap(_props: Props) {
  return null;
}
