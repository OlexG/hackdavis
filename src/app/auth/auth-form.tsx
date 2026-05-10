"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PixelGlyph } from "../app/_components/icons";
import { loginAction, signupAction } from "./actions";

type AuthFormProps = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const isSignup = mode === "signup";
  const [state, formAction, pending] = useActionState(isSignup ? signupAction : loginAction, {});

  return (
    <form action={formAction} className="grid gap-4">
      {state.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-none border-2 border-[#b84c35] bg-[#fff0e6] px-3 py-2 text-xs font-bold leading-5 text-[#8a2f20] shadow-[0_2px_0_#8a2f20]"
        >
          <PixelGlyph name="sparkle" className="mt-0.5 size-3.5 shrink-0" />
          {state.error}
        </p>
      ) : null}

      {isSignup ? (
        <>
          <AuthField label="Username" name="username" autoComplete="username" minLength={3} placeholder="cornfield42" />
          <AuthField label="Display name" name="displayName" autoComplete="name" placeholder="Sunny Farmer" />
          <AuthField label="Email" name="email" type="email" autoComplete="email" placeholder="you@harvest.com" />
        </>
      ) : (
        <AuthField label="Username" name="identifier" autoComplete="username" placeholder="cornfield42" />
      )}

      <AuthField
        label="Password"
        name="password"
        type="password"
        autoComplete={isSignup ? "new-password" : "current-password"}
        minLength={isSignup ? 8 : undefined}
        placeholder={isSignup ? "at least 8 characters" : "your password"}
      />

      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-none border-2 border-[#3b2a14] bg-[#7da854] px-5 font-mono text-xs font-black uppercase tracking-[0.16em] text-[#fffdf5] shadow-[0_4px_0_#3b2a14] transition hover:-translate-y-0.5 hover:bg-[#9bc278] active:translate-y-0 active:shadow-[0_2px_0_#3b2a14] disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0"
      >
        <PixelGlyph name={isSignup ? "wheat" : "wagon"} className="size-4" />
        {pending ? "Working..." : isSignup ? "Create account" : "Sign in"}
      </button>

      <p className="mt-1 text-center text-xs font-semibold text-[#5e4a26]">
        {isSignup ? "Already have an account?" : "Need an account?"}{" "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-black uppercase tracking-[0.1em] text-[#2f6f4e] underline decoration-2 underline-offset-2 hover:text-[#1f5238]"
        >
          {isSignup ? "Sign in" : "Create one"}
        </Link>
      </p>
    </form>
  );
}

function AuthField({
  label,
  name,
  type = "text",
  autoComplete,
  minLength,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  minLength?: number;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1.5 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#34432b]">
      {label}
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        minLength={minLength}
        placeholder={placeholder}
        required={name !== "displayName"}
        className="min-h-11 rounded-none border-2 border-[#8b6f3e] bg-[#fffaf0] px-3 font-mono text-sm font-bold normal-case tracking-normal text-[#2d2313] shadow-[inset_0_2px_0_rgba(95,80,43,0.14)] outline-none transition placeholder:text-[#b29c66] focus:border-[#2f6f4e] focus:bg-[#fffdf5] focus:shadow-[inset_0_2px_0_rgba(47,111,78,0.18),0_0_0_2px_rgba(125,168,84,0.35)]"
      />
    </label>
  );
}
