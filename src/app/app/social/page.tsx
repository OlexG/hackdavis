import { connection } from "next/server";
import { getSocialSnapshot } from "@/lib/social";
import { SocialBoard } from "./social-board";

export default async function SocialPage() {
  await connection();
  const snapshot = await getSocialSnapshot();

  return (
    <section className="text-[#2d2313]">
      <SocialBoard snapshot={snapshot} />
    </section>
  );
}
