import type { Metadata } from "next";
import { FarmManagerShell } from "./farm-manager-shell";

export const metadata: Metadata = {
  title: "Farm Space Studio | Sunpatch",
  description: "Satellite boundary selection, automated farm partitioning, and drag-and-drop planting assignments.",
};

export default function FarmPage() {
  return <FarmManagerShell />;
}
