import type { Metadata } from "next";
import { FarmPlanner } from "./farm-planner";

export const metadata: Metadata = {
  title: "Farm Space Studio | Sunpatch",
  description: "Satellite boundary selection, automated farm partitioning, and drag-and-drop planting assignments.",
};

export default function FarmPage() {
  // Escape the app-shell's p-6 padding so the planner is full-bleed across
  // the entire content area (sidebar untouched). The shell itself uses
  // position:absolute;inset:0 against the relative #app-main parent.
  return (
    <div className="-m-6">
      <FarmPlanner />
    </div>
  );
}
