import { connection } from "next/server";
import { getSocialSnapshot } from "@/lib/social";
import { SocialBoard } from "../../social/social-board";

export default async function MarketplaceSocialPage() {
  await connection();
  const snapshot = await getSocialSnapshot();

  return <SocialBoard snapshot={snapshot} />;
}
