import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicTeam } from "@/lib/public";
import { ProfileView } from "@/components/public/ProfileView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ embed?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPublicTeam((await params).slug);
  return { title: data ? `Book time with ${data.team.name}` : "Not found" };
}

export default async function TeamPage({ params, searchParams }: Props) {
  const data = await getPublicTeam((await params).slug);
  if (!data) notFound();
  const { embed } = await searchParams;
  return (
    <ProfileView
      brand={data.owner}
      title={data.team.name}
      bio={data.owner.bio}
      events={data.events}
      basePath={`/team/${data.team.slug}`}
      embed={embed === "1"}
    />
  );
}
