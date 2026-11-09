import { describe, expect, it } from "vitest";
import { decrypt, encrypt, randomId, safeEqual, sha256 } from "@/lib/crypto";
import { dateKey, durationLabel, formatDateTimeRange, isValidTimeZone } from "@/lib/format";
import { jitsiRoomUrl, resolveLocation, isUrl } from "@/lib/location";
import { readableInk } from "@/lib/brand";
import { slugify } from "@/lib/users";

describe("crypto", () => {
  it("encrypts and decrypts tokens", () => {
    const enc = encrypt("refresh-token-123");
    expect(enc).not.toContain("refresh-token");
    expect(decrypt(enc)).toBe("refresh-token-123");
  });
  it("rejects tampered values", () => {
    const enc = encrypt("secret");
    const parts = enc.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });
  it("makes ids and hashes", () => {
    expect(randomId(10)).toMatch(/^[a-z2-9]{10}$/);
    expect(sha256("a")).toHaveLength(64);
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("format", () => {
  it("shows times in the viewer's timezone", () => {
    const start = Date.UTC(2026, 10, 10, 15, 0);
    expect(formatDateTimeRange(start, start + 30 * 60_000, "America/Chicago")).toBe("Tuesday, November 10, 2026 · 9:00 AM – 9:30 AM");
    expect(formatDateTimeRange(start, start + 30 * 60_000, "Asia/Tokyo")).toBe("Wednesday, November 11, 2026 · 12:00 AM – 12:30 AM");
  });
  it("dateKey uses the timezone's calendar date", () => {
    expect(dateKey(Date.UTC(2026, 10, 10, 3, 0), "America/Los_Angeles")).toBe("2026-11-09");
    expect(dateKey(Date.UTC(2026, 10, 10, 3, 0), "Europe/Paris")).toBe("2026-11-10");
  });
  it("validates timezones", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
  });
  it("labels durations", () => {
    expect(durationLabel(30)).toBe("30 min");
    expect(durationLabel(60)).toBe("1 h");
    expect(durationLabel(90)).toBe("1 h 30 min");
  });
});

describe("locations", () => {
  it("creates unique Jitsi rooms on meet.jit.si", () => {
    const a = jitsiRoomUrl("Owner intro call!");
    const b = jitsiRoomUrl("Owner intro call!");
    expect(a).toMatch(/^https:\/\/meet\.jit\.si\/Ownerintrocall-[a-z2-9]{12}$/);
    expect(a).not.toBe(b);
  });
  it("resolves each meeting type", () => {
    expect(resolveLocation("link", "https://zoom.us/j/1", "x")).toBe("https://zoom.us/j/1");
    expect(resolveLocation("phone", "", "x", "+1 555 0100")).toBe("Phone: +1 555 0100");
    expect(resolveLocation("in_person", "12 Beach Rd", "x")).toBe("12 Beach Rd");
    expect(isUrl("https://x.y/z")).toBe(true);
    expect(isUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("misc", () => {
  it("picks readable text for brand colors", () => {
    expect(readableInk("#ffffff")).toBe("#111827");
    expect(readableInk("#0f766e")).toBe("#ffffff");
  });
  it("slugifies names", () => {
    expect(slugify("  Sunny Stays Co.! ")).toBe("sunny-stays-co");
    expect(slugify("Café Déjà")).toBe("cafe-deja");
  });
});
