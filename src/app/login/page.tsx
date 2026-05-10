import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthForm } from "../auth/auth-form";
import { AuthScene } from "../auth/auth-scene";

export default async function LoginPage() {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    redirect("/app/farm");
  }

  return (
    <AuthScene
      eyebrow="Welcome back"
      title="Sign in to your patch"
      subtitle="Pick up where the harvest left off."
    >
      <AuthForm mode="login" />
    </AuthScene>
  );
}
