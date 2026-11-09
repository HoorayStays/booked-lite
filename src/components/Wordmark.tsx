import Link from "next/link";

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="wordmark" aria-label="BOOKED Lite home">
      B👀KED <span>Lite</span>
    </Link>
  );
}
