import { describe, expect, it } from "vitest";
import { embedSnippet, plainLink } from "@/lib/embed";
import { readFileSync } from "node:fs";

const base = { url: "https://book.example.com/alex/intro", scriptUrl: "https://book.example.com/embed.js", text: "Book a call", color: "#0f766e", ink: "#ffffff" };

describe("embed snippets", () => {
  it("inline = one div + one script", () => {
    const s = embedSnippet({ ...base, style: "inline" });
    expect(s).toBe(
      '<div data-booked="inline" data-url="https://book.example.com/alex/intro"></div>\n<script src="https://book.example.com/embed.js" async></script>',
    );
  });
  it("floating button carries text and brand color", () => {
    const s = embedSnippet({ ...base, style: "floating" });
    expect(s).toContain('data-booked="floating"');
    expect(s).toContain('data-text="Book a call"');
    expect(s).toContain('data-color="#0f766e"');
  });
  it("button works as a normal link without JavaScript", () => {
    const s = embedSnippet({ ...base, style: "button" });
    expect(s).toMatch(/^<a href="https:\/\/book\.example\.com\/alex\/intro" data-booked="popup"/);
    expect(s).toContain("background:#0f766e");
  });
  it("escapes user text", () => {
    const s = embedSnippet({ ...base, style: "floating", text: 'Say "hi" <now>' });
    expect(s).toContain('data-text="Say &quot;hi&quot; &lt;now>"');
    expect(plainLink({ ...base, text: "<b>" })).toContain("&lt;b>");
  });
  it("embed.js knows all three styles", () => {
    const js = readFileSync("public/embed.js", "utf8");
    for (const k of ['"inline"', '"floating"', '"popup"', "booked:height"]) expect(js).toContain(k);
  });
});
