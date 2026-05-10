import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthForm } from "../auth/auth-form";
import { AuthScene } from "../auth/auth-scene";

export default async function SignupPage() {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    redirect("/app/farm");
  }

  return (
    <AuthScene
      eyebrow="New farmer"
      title="Plant your first patch"
      subtitle="Pick a username, claim a plot, start growing."
    >
      <AuthForm mode="signup" />
    </AuthScene>
  );
}
