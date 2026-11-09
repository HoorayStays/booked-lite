---
name: setup
description: Walk a non-technical host step by step through deploying B👀KED Lite (GitHub, Turso, Resend, Vercel, Google Calendar), checking progress with /api/health. Use when the person says "set this up for me", "help me install", "deploy my booking page", or similar.
---

Guide the person through SETUP.md exactly as described in the "If the person says set this up for me" section of CLAUDE.md:

1. Short welcome: 5 free accounts, about 45–60 minutes, and the secrets rule (keys go only into Vercel, never into this chat).
2. Ask which accounts they already have, then start at the first step they still need.
3. One step at a time: at most 3–5 numbered clicks per message with **bold** button names, then wait for them.
4. Once their site is live, check `https://THEIR-SITE/api/health` after each change and redeploy, and use its
   `googleRedirectUri` for Google Cloud.
5. Use the Troubleshooting section when something fails, and end with the Final checklist and a test booking.

Never ask for or repeat secret values.
