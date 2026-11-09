"use client";

import { useActionState } from "react";
import { sendLink, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendLink, {});
  if (state.sent) {
    return (
      <div className="stack">
        <div className="alert alert-ok" role="status">
          If that email is allowed to sign in, a link is on its way. Check your inbox (and spam folder).
        </div>
        {state.devLink && (
          <div className="alert alert-warn">
            <strong>Local development:</strong> email isn&apos;t set up yet, so here is your link:{" "}
            <a href={state.devLink} data-testid="dev-login-link">Sign in</a>
          </div>
        )}
      </div>
    );
  }
  return (
    <form action={action} className="stack">
      <div>
        <label htmlFor="email">Your email</label>
        <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </div>
      {state.error && <div className="alert alert-error">{state.error}</div>}
      <button className="btn btn-block" disabled={pending}>{pending ? "Sending…" : "Email me a sign-in link"}</button>
    </form>
  );
}
