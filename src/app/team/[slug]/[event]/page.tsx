import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTeamEvent } from "@/lib/public";
import { EventBooking, type BookingSearch } from "@/components/public/EventBooking";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; event: string }>; searchParams: Promise<BookingSearch> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, event } = await params;
  const data = await getTeamEvent(slug, event);
  if (!data || !data.team) return { title: "Not found" };
  return { title: `${data.eventType.title} with ${data.team.name}`, description: data.eventType.description.slice(0, 160) };
}

export default async function TeamEventPage({ params, searchParams }: Props) {
  const { slug, event } = await params;
  const data = await getTeamEvent(slug, event);
  if (!data) notFound();
  return <EventBooking data={data} sp={await searchParams} />;
}
