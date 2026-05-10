import type { Metadata } from "next";
import { FarmPlanner } from "./farm-planner";

export const metadata: Metadata = {
  title: "Farm Space Studio | Sunpatch",
  description: "Satellite boundary selection, automated farm partitioning, and drag-and-drop planting assignments.",
};

export default function FarmPage() {
  return <FarmPlanner />;
}
