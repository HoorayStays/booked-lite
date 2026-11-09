import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicEvent } from "@/lib/public";
import { EventBooking, type BookingSearch } from "@/components/public/EventBooking";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ user: string; event: string }>; searchParams: Promise<BookingSearch> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { user, event } = await params;
  const data = await getPublicEvent(user, event);
  if (!data) return { title: "Not found" };
  const host = data.owner.name || data.owner.username;
  return {
    title: `${data.eventType.title} with ${host}`,
    description: data.eventType.description.slice(0, 160) || `Book a ${data.eventType.title} with ${host}.`,
  };
}

export default async function EventPage({ params, searchParams }: Props) {
  const { user, event } = await params;
  const data = await getPublicEvent(user, event);
  if (!data) notFound();
  return <EventBooking data={data} sp={await searchParams} />;
}
