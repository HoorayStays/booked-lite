/**
 * Sends email with Resend (free tier: 3,000 emails/month).
 * Without RESEND_API_KEY, emails are printed to the server log instead
 * (and saved to .data/outbox.jsonl when running on your own computer).
 */
import fs from "node:fs";
import path from "node:path";
import { emailConfigured, emailFrom } from "../env";

export type Attachment = { filename: string; content: string; contentType: string };
export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: Attachment[];
};

export async function sendEmail(email: Email): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) {
    logToOutbox(email);
    return { ok: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        reply_to: email.replyTo,
        attachments: email.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content, "utf8").toString("base64"),
          content_type: a.contentType,
        })),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Resend error ${res.status}: ${body}`);
      return { ok: false, error: body };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email] failed to send", err);
    return { ok: false, error: String(err) };
  }
}

function logToOutbox(email: Email) {
  console.log(`\n[email:not-sent] To: ${email.to}\nSubject: ${email.subject}\n${email.text}\n`);
  if (process.env.VERCEL) return;
  try {
    const file = process.env.OUTBOX_FILE || path.join(process.cwd(), ".data", "outbox.jsonl");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify({ ...email, at: new Date().toISOString() }) + "\n");
  } catch {
    /* read-only filesystem: the console log above is enough */
  }
}
