import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicProfile } from "@/lib/public";
import { ProfileView } from "@/components/public/ProfileView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ user: string }>; searchParams: Promise<{ embed?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPublicProfile((await params).user);
  if (!data) return { title: "Not found" };
  return { title: `Book time with ${data.owner.name || data.owner.username}` };
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const data = await getPublicProfile((await params).user);
  if (!data) notFound();
  const { embed } = await searchParams;
  return <ProfileView brand={data.owner} bio={data.owner.bio} events={data.events} basePath={`/${data.owner.username}`} embed={embed === "1"} />;
}
