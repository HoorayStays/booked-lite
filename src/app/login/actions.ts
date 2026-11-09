"use server";

import { redirect } from "next/navigation";
import { requestMagicLink, signOut, verifyMagicLink } from "@/lib/auth";
import { emailConfigured, isDevMode } from "@/lib/env";

export type LoginState = { sent?: boolean; devLink?: string; error?: string };

export async function sendLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Please enter a valid email address." };
  const { link } = await requestMagicLink(email);
  // Local development without email set up: show the link on screen so you can still sign in.
  if (link && isDevMode() && !emailConfigured()) return { sent: true, devLink: link };
  return { sent: true };
}

export async function confirmLink(formData: FormData) {
  const ok = await verifyMagicLink(String(formData.get("token") ?? ""));
  redirect(ok ? "/admin" : "/login?expired=1");
}

export async function logout() {
  await signOut();
  redirect("/login");
}
