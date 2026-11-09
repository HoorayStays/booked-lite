# Set up B👀KED Lite (no coding needed)

This guide gets your own booking page live on the internet. It's **free**, and takes about **45–60 minutes** the first time.

> **Easiest way:** open this folder in Claude Code and say **"set this up for me"**.
> Claude will walk you through each step below, one at a time, and check your work as you go.

You'll create five free accounts. You do the clicking; Claude explains and checks.

| # | Service | What it does | Free plan |
|---|---------|--------------|-----------|
| 1 | **GitHub** | Stores your copy of the app | Free |
| 2 | **Turso** | The database (your events and bookings) | Free: 5 GB |
| 3 | **Resend** | Sends confirmation and reminder emails | Free: 3,000 emails/month, 100/day |
| 4 | **Vercel** | Puts your site on the internet | Free "Hobby" plan |
| 5 | **Google Cloud** | Lets the app read and write your Google Calendar | Free |

---

## 🔐 The one rule: keys and passwords never go in the chat

Along the way you'll get some **secret keys**: long random strings like `re_8kD…` or `GOCSPX-…`.

- ✅ Paste them **only** into Vercel's *Environment Variables* screen (step 4).
- ❌ **Never** paste them into Claude, an email, or a document. Claude doesn't need them, and never asks for them.
- If you paste one by accident, no panic: delete that key on the website it came from, create a new one, and put the new one in Vercel.

Keep a **private note** open (Apple Notes, a password manager, or paper) to hold keys for a few minutes while you copy them from one site to Vercel. Delete the note when you're done.

---

## Step 1: GitHub (your copy of the app)

1. Go to **https://github.com/signup** and create a free account (skip this if you have one).
2. Open the B👀KED Lite page on GitHub (the link you were given).
3. Click the green **Use this template** button → **Create a new repository**.
   (If you don't see that button, click **Fork** instead → **Create fork**.)
4. Name it something like `my-booking-page`. Choose **Private** if you like. Click **Create repository**.

✅ You now have your own copy of the app on GitHub.

---

## Step 2: Turso (the database)

1. Go to **https://app.turso.tech** and click **Continue with GitHub**. Approve the request.
2. If it asks for an organization name, use your name or business name.
3. Click **Create Database** (or **Databases → New Database**).
   - Name: `booked`
   - Location: pick the region **closest to you**
   - Click **Create**.
4. On the database page, find the **URL**. It starts with `libsql://` and looks like
   `libsql://booked-yourname.aws-us-east-1.turso.io`. Copy it into your private note as **DATABASE_URL**.
5. Click **Create Token** (sometimes under **Connect** or a **⋯** menu).
   - Expiration: **Never**
   - Access: **Read & Write**
   - Click **Create**, then copy the long token into your note as **DATABASE_AUTH_TOKEN**.
     You only see it once!

✅ You have `DATABASE_URL` and `DATABASE_AUTH_TOKEN`.

---

## Step 3: Resend (emails)

1. Go to **https://resend.com/signup** and sign up **with the same email you'll use to sign in to your booking admin**.
2. In the left menu click **API Keys** → **Create API Key**.
   - Name: `booked`
   - Permission: **Sending access**
   - Click **Add**, then copy the key (starts with `re_`) into your note as **RESEND_API_KEY**.

**About sending to guests:** until you verify a domain, Resend only delivers email **to your own address**.
That's enough to sign in and test. To email **guests**, you need a domain you own (like `sunnystays.com`):

3. *(Do this now or later.)* Click **Domains** → **Add Domain** → type your domain → **Add**.
   Resend shows 3–4 DNS records. Add them where your domain is managed (GoDaddy, Namecheap, Squarespace,
   Cloudflare…). Search "add DNS record" + your provider's name for their help page. Then click **Verify**.
   It can take a few minutes up to a few hours.
4. Once verified, your **EMAIL_FROM** will be something like `Sunny Stays <bookings@sunnystays.com>`.
   Until then, leave EMAIL_FROM empty.

✅ You have `RESEND_API_KEY` (and later `EMAIL_FROM`).

---

## Step 4: Vercel (put it online)

1. Go to **https://vercel.com/signup** → choose **Hobby** → **Continue with GitHub**.
2. Click **Add New…** → **Project**. Find your `my-booking-page` repository and click **Import**.
   (If it's not listed, click **Adjust GitHub App Permissions** and give Vercel access to it.)
3. Before clicking Deploy, open **Environment Variables** and add these one at a time
   (Key on the left, Value on the right, then **Add**):

   | Key | Value |
   |-----|-------|
   | `ALLOWED_EMAILS` | Your email address (the one you'll sign in with) |
   | `AUTH_SECRET` | Open **https://generate-secret.vercel.app/32** and copy what it shows |
   | `CRON_SECRET` | Refresh that same page and copy the **new** value |
   | `DATABASE_URL` | From step 2 |
   | `DATABASE_AUTH_TOKEN` | From step 2 |
   | `RESEND_API_KEY` | From step 3 |
   | `DEFAULT_TIMEZONE` | Your timezone, e.g. `America/Chicago`, `America/New_York`, `Europe/London` |

   *Tip: you can also paste several `KEY=value` lines at once into the first Key box.*
4. Click **Deploy** and wait 1–2 minutes for the confetti 🎉.
5. Click **Continue to Dashboard**, then the **Visit** button (or the domain shown, like
   `my-booking-page.vercel.app`). **Copy that web address.** You'll need it in the next step. This is **your site**.
6. **Check it:** go to `https://YOUR-SITE.vercel.app/api/health`. You should see `"ok": true`.
   (It shows *which* settings are filled in, never the values. Claude can read this page for you.)

✅ Your site is live!

> **Whenever you change an environment variable in Vercel**, it only takes effect after a redeploy:
> **Deployments** tab → **⋯** next to the top one → **Redeploy** → **Redeploy**.

---

## Step 5: Sign in for the first time

1. Go to `https://YOUR-SITE.vercel.app/login`.
2. Type the email you put in `ALLOWED_EMAILS` → **Email me a sign-in link**.
3. Open the email (check spam!) → tap **Sign in** → **Continue to my dashboard**.

✅ You're in your dashboard. You'll see a "Finish setting up" checklist.

---

## Step 6: Google Calendar connection (the longest step: about 15 minutes)

This lets the app see when you're busy and add bookings to your calendar.
Google's screens change often; if a button has a slightly different name, look for the closest match.

### 6a. Create a project
1. Go to **https://console.cloud.google.com** and sign in with the Google account whose calendar you use.
   Accept the terms if asked.
2. At the top left, click the **project picker** (it may say "Select a project") → **New Project**.
   - Name: `Booked Lite` → **Create**. Wait a few seconds, then make sure that project is selected at the top.

### 6b. Turn on the Calendar API
3. In the search bar at the top, type **Google Calendar API** and open it.
4. Click **Enable**.

### 6c. Set up the consent screen
5. In the search bar, type **Google Auth Platform** (or go to **APIs & Services → OAuth consent screen**).
   Click **Get started**.
6. Fill in:
   - **App name:** your business name, e.g. `Sunny Stays Booking`
   - **User support email:** your email → **Next**
   - **Audience:** **External** → **Next**
   - **Contact information:** your email → **Next**
   - Tick **I agree** → **Continue** → **Create**
7. In the left menu click **Data Access** → **Add or remove scopes**. In the filter box type `calendar` and tick:
   - `.../auth/calendar.readonly` (See and download any calendar you can access)
   - `.../auth/calendar.events` (View and edit events on all your calendars)

   Click **Update**, then **Save** at the bottom of the page.
8. In the left menu click **Audience**. Under **Publishing status** click **Publish app** → **Confirm**.
   (This is important: in "Testing" mode Google disconnects your calendar every 7 days.)
   Google won't "verify" your app, and that's fine because only *you* connect your calendar.

### 6d. Create your keys
9. In the left menu click **Clients** → **Create client**.
   - **Application type:** **Web application**
   - **Name:** `Booked Lite`
   - Under **Authorized redirect URIs** click **Add URI** and paste **exactly**:
     `https://YOUR-SITE.vercel.app/api/google/callback`
     (Your exact address is also shown at `/api/health` as `googleRedirectUri`.)
   - Click **Create**.
10. A box shows your **Client ID** and **Client secret**. Copy both into your private note
    (or click **Download JSON**). **The secret may only be shown once.**

### 6e. Add the keys to Vercel
11. In Vercel → your project → **Settings** → **Environment Variables**, add:
    - `GOOGLE_CLIENT_ID` = the Client ID (ends with `.apps.googleusercontent.com`)
    - `GOOGLE_CLIENT_SECRET` = the Client secret (starts with `GOCSPX-`)
12. **Redeploy** (Deployments → ⋯ → Redeploy).

### 6f. Connect!
13. In your dashboard go to **Branding & calendar** → **Connect Google Calendar**.
14. Pick your Google account. You'll see **"Google hasn't verified this app"**. That's expected for your own
    private app. Click **Advanced** → **Go to [your app name] (unsafe)** → tick the boxes → **Continue**.
15. Back in the dashboard you'll see **Google Calendar connected ✓**. Choose which calendars to check for conflicts
    (tip: tick your Airbnb/VRBO/PMS calendars if they're synced into Google) → **Save calendar choices**.

✅ Your calendar is connected.

---

## Step 7: Make it yours

In the dashboard:

1. **Branding & calendar:** your name, a short intro, brand color, logo, and a cover photo → **Save**.
2. **Availability:** check your timezone, set your weekly hours, and add days off → **Save availability**.
3. **Event types:** edit **Quick chat** or click **+ New event type**. Set the title, length, buffers, minimum notice,
   daily limit, questions, and where it happens:
   - **Video call (Jitsi):** a free private room is created for every booking. Nothing to set up.
     *(The first person to join may be asked to sign in with Google/GitHub on meet.jit.si. That's normal.)*
   - **Your own link:** paste your Zoom / StreamYard / Google Meet link.
   - **Phone** or **In person.**

   Tick **Show this on my booking page** → **Save**.

---

## Step 8: Test-book yourself

1. On your phone, open `https://YOUR-SITE.vercel.app/YOUR-LINK-NAME` (shown at the top of your dashboard).
2. Pick a time and book it, **using your own email** (until your Resend domain is verified, only your email receives messages).
3. Check:
   - ✅ The "You're booked!" page appears
   - ✅ You got a confirmation email with a calendar invite attached
   - ✅ You got a "New booking" email
   - ✅ The event appears in your Google Calendar
   - ✅ It shows in your dashboard under **Bookings**
4. Click **Cancel** in the confirmation email and make sure the event disappears from your calendar.

---

## Step 9: Reminder emails (2 minutes)

Reminders go out about 24 hours before each booking.

- **Already working:** Vercel runs the reminder job **once a day** for free (because `CRON_SECRET` is set).
- **Optional, more precise (every hour):** in GitHub → your repository → **Settings** → **Secrets and variables** → **Actions** →
  **New repository secret**, add:
  - `APP_URL` = `https://YOUR-SITE.vercel.app`
  - `CRON_SECRET` = the **same** value you put in Vercel

  That's it: the included "Reminder emails" workflow now runs every hour.

---

## Step 10 (optional): Your own web address

Vercel → your project → **Settings** → **Domains** → add e.g. `book.sunnystays.com` and follow the DNS instructions.
Then:
1. Add `APP_URL` = `https://book.sunnystays.com` in Vercel's Environment Variables.
2. In Google Cloud → **Clients** → your client → add the new redirect URI `https://book.sunnystays.com/api/google/callback`.
3. Redeploy.

---

## 🛠 Troubleshooting

**`/api/health` shows `"database": false`**
Check `DATABASE_URL` starts with `libsql://` and that `DATABASE_AUTH_TOKEN` was copied completely (it's very long).
Create a new token in Turso if unsure, update it in Vercel, then redeploy.

**The Vercel build failed with "DATABASE_URL is not set"**
Add the database variables (step 4) and redeploy.

**I never get the sign-in email**
- Check spam/junk.
- Is your email exactly in `ALLOWED_EMAILS` (no typos, no spaces)? Did you redeploy after adding it?
- Is `RESEND_API_KEY` set? In Resend, open **Emails** (or **Logs**) to see if it was sent or why it failed.
- Without a verified domain, Resend only sends to the email you signed up to Resend with.

**Guests don't get emails**
Verify your domain in Resend (step 3) and set `EMAIL_FROM` to an address on that domain, e.g.
`Sunny Stays <bookings@sunnystays.com>`. Redeploy.

**"That link has expired or was already used"**
Links work once and last 15 minutes. Ask for a new one. If it happens every time, your email app may be "pre-opening"
links. That's why there's a **Continue** button. Open the newest email and tap it.

**Google says `redirect_uri_mismatch`**
The redirect URI in Google Cloud (step 6d) must match exactly what `/api/health` shows as `googleRedirectUri`:
`https`, no extra slash at the end, same domain. Fix it in Google Cloud → **Clients** → your client, wait a minute, try again.

**Google says "Access blocked: app has not completed verification" / "access_denied"**
Your app is still in **Testing**. Go to **Audience** → **Publish app** (step 6c, #8). Or add your email under **Test users**.

**Calendar was connected, but now says "We had trouble reaching your calendar"**
Disconnect and connect again in **Branding & calendar**. If your app was in **Testing** mode, publish it (see above) so
this stops happening every 7 days.

**Connecting Google sends me back with "didn't finish connecting"**
Go to **https://myaccount.google.com/permissions**, remove your booking app, then connect again.

**No times show on my booking page**
- Is the event type turned **On**?
- Check **Availability** (hours set? right timezone?).
- **Minimum notice** might be pushing times out. Try a later day.
- Your Google Calendar might be busy (all-day events marked "Busy" block the whole day).

**Times are off by some hours**
Set your timezone in **Availability**. Guests see times in *their* timezone, which is normal.

**I changed something in Vercel and nothing happened**
Redeploy (Deployments → ⋯ → Redeploy).

**Still stuck?** Tell Claude exactly what you see (an error message or a screenshot description), but never paste keys.

---

## ✅ Final checklist

- [ ] `https://YOUR-SITE.vercel.app/api/health` shows `"ok": true`, and `google`, `email`, `cronSecret` are `true`
- [ ] I can sign in at `/login` with my email
- [ ] My name, color, logo and cover look right on my booking page
- [ ] Availability and timezone are correct
- [ ] At least one event type is **On**
- [ ] Google Calendar is connected, the right calendars are ticked, and the Google app is **Published**
- [ ] A test booking: confirmation email ✓, host email ✓, calendar event ✓, cancel works ✓
- [ ] (For guest emails) my domain is verified in Resend and `EMAIL_FROM` is set
- [ ] (Optional) GitHub secrets `APP_URL` + `CRON_SECRET` added for hourly reminders
- [ ] I deleted my private note with the keys

🎉 **Done!** Share your link everywhere: Airbnb messages, your website, your email signature.

---

*B👀KED Lite is free and open source (MIT), built by [CoHost Studio](https://cohoststudio.com).
Want the full version (CRM, AI note-taker, team scheduling, agents)? [cohoststudio.com](https://cohoststudio.com)*
