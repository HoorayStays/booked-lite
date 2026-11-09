"use server";

import { redirect } from "next/navigation";
import { cancelBooking, getBookingWithContext } from "@/lib/bookings";
import { safeEqual } from "@/lib/crypto";

export async function cancelAsGuest(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const token = String(formData.get("token") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  const ctx = await getBookingWithContext(id);
  if (!ctx || !safeEqual(ctx.booking.manageToken, token)) redirect("/");
  await cancelBooking(ctx.booking, "guest", reason || undefined);
  redirect(`/booking/${id}?token=${encodeURIComponent(token)}`);
}
