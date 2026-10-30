# Future Google and Microsoft teacher sign-in

Design decision (2026-10-30): provider sign-in is a future task. Current teacher registration accepts an email address from any provider and a separate Machberet+ password of 12–128 characters. Student access continues through personal teacher-issued links. No OAuth buttons, routes, credentials, or provider configuration are active in this change. No credentials are needed now.

## Planned application contract

Implement a server-side OpenID Connect authorization-code flow with PKCE. The proposed routes below are **not implemented**; finalize them before registering credentials. Replace `APP_ORIGIN` with the deployed HTTPS origin (no trailing slash).

| Provider  | Start route                 | Exact proposed production redirect URI   |
| --------- | --------------------------- | ---------------------------------------- |
| Google    | `/api/auth/google/start`    | `APP_ORIGIN/api/auth/google/callback`    |
| Microsoft | `/api/auth/microsoft/start` | `APP_ORIGIN/api/auth/microsoft/callback` |

For local development, plan `http://localhost:5173/api/auth/google/callback` and `http://localhost:5173/api/auth/microsoft/callback`; run the frontend and its API proxy on that same origin. Do not mix `localhost` and `127.0.0.1` during an auth transaction. Register each environment's actual redirect URI explicitly. Microsoft documents localhost exceptions and exact redirect matching in its [redirect URI guidance](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url).

## Google setup checklist (when implementation starts)

- Choose a Google Cloud project and configure Google Auth Platform branding, audience, support email, and authorized domains. Use an external audience if teachers outside one Workspace organization must sign in; add test users while testing.
- Create an OAuth client of type **Web application**. Add the exact Google callback URI above under authorized redirect URIs for each environment. Save the client ID and client secret privately.
- Request only `openid email profile`. Use the discovery metadata for endpoints and signing keys; validate the ID token and use its `sub` as the identity key. Review consent publishing requirements before launch.

Google's [web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server) covers client creation, consent, and redirect registration; its [OpenID Connect guide](https://developers.google.com/identity/openid-connect/openid-connect) covers discovery, scopes, and identity validation.

## Microsoft setup checklist (when implementation starts)

- In Microsoft Entra admin center, create an app registration. If both school/work and personal Microsoft accounts are required, choose **Accounts in any organizational directory and personal Microsoft accounts**. If access is limited to one school tenant, choose single-tenant and configure that tenant explicitly instead.
- Add a **Web** platform and the exact Microsoft callback URI above for each environment. Record the application/client ID. Create a server credential, save its value privately, and record expiration and rotation ownership.
- For the broader audience, plan the `common` authority with tenant-aware issuer validation. Request `openid profile email`; do not assume an email claim is always available. Do not request Graph or mailbox permissions for sign-in alone.

Follow Microsoft's [app registration guide](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app?tabs=client-secret) and [OIDC protocol documentation](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc).

## Implementation and release gates

- Add server-only settings for the canonical origin, Google client ID/secret, Microsoft client ID/secret, and Microsoft authority. These names and bindings are not active today. Store secrets in the deployment secret store; never commit them or expose them through `VITE_*` variables.
- Store a short-lived, single-use authorization transaction with unpredictable state, nonce, PKCE verifier, provider, and a safe relative return path. Verify all of them at callback, including provider binding; reject replay and expired transactions. Exchange the code server-side.
- Verify token signature, allowed algorithm, issuer, audience, expiry, and nonce using maintained OIDC tooling and provider discovery. Microsoft issuer validation must match the selected account audience; do not accept arbitrary token-supplied issuers or key URLs.
- Add an external-identity table keyed by provider and issuer/subject, linked to the existing teacher user. Never merge accounts solely because email strings match. Link an existing password account only after reauthentication; require consent for new teachers. Handle missing email without inventing one.
- Issue the existing HttpOnly app session only after successful validation. Keep provider tokens out of browser storage and logs. Show provider buttons only when the provider is configured and its end-to-end flow is verified. Preserve password and student-link login.
- Test successful sign-in, cancellation, provider failure, wrong state/nonce/issuer/audience, expiry, replay, account-linking conflicts, school and personal Microsoft accounts, and existing password login. Verify redirects against the deployed origin before enabling buttons.

The security and account-linking items are project acceptance criteria for the future implementation, not claims that the current application already supports OAuth.
