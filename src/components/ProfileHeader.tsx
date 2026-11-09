import type { User } from "@/lib/db/schema";
import { imageUrl } from "@/lib/public";

export function ProfileHeader({ owner, compact = false, title }: { owner: User; compact?: boolean; title?: string }) {
  const name = title || owner.name || owner.username;
  return (
    <div className="profile-head" style={compact ? { marginTop: 0 } : undefined}>
      {owner.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="avatar" src={imageUrl(owner, "logo")} alt="" width={72} height={72} />
      ) : (
        <div className="avatar" aria-hidden>{name.slice(0, 1).toUpperCase()}</div>
      )}
      <div style={{ paddingTop: compact ? 0 : 30 }}>
        <h1 style={{ fontSize: 22 }}>{name}</h1>
      </div>
    </div>
  );
}
