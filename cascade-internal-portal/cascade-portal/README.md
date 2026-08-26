# Cascade Internal Portal

A real, working internal web application that authenticates through **PingFederate**
via both **SAML 2.0** and **OpenID Connect**, then requires a **TOTP step-up**
before granting access. Built to be a genuine test harness for a PingFederate lab
(SP Connection / OIDC Client, real redirects, real assertion/token validation) and
reusable as a protected internal app in another project.

Pages behind SSO: Dashboard, Reports (mock data), Profile (raw claims viewer —
useful for debugging attribute mappings), and Admin (gated by a `groups` claim,
to demonstrate authorization on top of authentication).

## Architecture

```
Browser
  │  1. GET /login → picks SAML or OIDC
  ▼
Cascade Internal Portal (this app)
  │  2. redirects to PingFederate
  ▼
PingFederate (IdP / OP)
  │  3. authenticates against your LDAP/AD data store
  │  4. returns a signed SAML assertion (POST) or an OIDC auth code
  ▼
Cascade Internal Portal
  │  5. validates signature, establishes a local session
  │  6. redirects to /mfa/verify (or /mfa/setup on first login)
  ▼
TOTP check (app-level, see "About the MFA design" below)
  │  7. on success → session flagged mfaVerified
  ▼
Dashboard / Reports / Profile / Admin
```

Both protocols normalize into the same `req.user` shape (`protocol`, `id`,
`email`, `displayName`, `groups`, `rawClaims`), so the app itself doesn't care
which one you signed in with — `/profile` shows you the raw claims either way.

## About the MFA design

You asked for TOTP-authenticator-app MFA. Worth being upfront about how that's
implemented and why: PingFederate does **not** ship a built-in TOTP adapter out
of the box. Authenticator-app MFA at the *IdP* layer requires either the **PingOne
MFA Integration Kit** or the **PingID Integration Kit** — both cloud services that
need their own account/license, and PingOne trial signup is the same one that
rejected your personal email earlier.

So this app implements TOTP as an **app-level step-up** instead: PingFederate
still does the actual authentication (password against your directory), and this
app enforces a second factor on top, using `otplib` + `qrcode`, with per-user
secrets in a local JSON store (`data/db.json`). That's a legitimate, real pattern
(lots of internal apps step up on top of an SSO session for higher-sensitivity
areas — see the `/admin` route for an example), it's fully self-contained in your
Docker lab, and it still proves the same skill (SSO integration) plus a second one
(step-up auth) without a cloud dependency you've already hit a wall on.

If you later do get PingOne/PingID access, the realistic upgrade path is to move
this logic into PingFederate as a **Composite Adapter**: `HTML Form Adapter` (or
your LDAP credential validator) chained with the `PingOne MFA Adapter` — at that
point MFA happens before the assertion is even issued, and you could delete the
`/mfa/*` routes and `otplib` dependency entirely. Worth doing later for the resume
story ("MFA enforced at the IdP via adapter chaining"), but not required to have a
fully working, testable MFA-gated SSO app today.

## Optional: local break-glass login

If you want a way into the app without going through PingFederate at all —
useful for quick testing, or as a fallback if the IdP is down — there's an
optional local username/password login. It's off by default and lives behind
a collapsed "Use local break-glass login instead" link on the login page, not
alongside SAML/OIDC as a peer option, since it isn't SSO and shouldn't be the
normal way in.

```bash
node scripts/hash-password.js "your-password-here"
```

Paste the output into `LOCAL_ADMIN_PASSWORD_HASH` in `.env`, set
`LOCAL_LOGIN_ENABLED=true`, and set `LOCAL_ADMIN_EMAIL` /
`LOCAL_ADMIN_GROUPS` as you like. It still goes through the same TOTP
step-up as SAML/OIDC — the app doesn't treat it as a shortcut around MFA,
only around federation.

## 1. Install

```bash
cd cascade-portal
npm install
```

## 2. Generate certificates

```bash
bash scripts/generate-certs.sh
```

This creates `certs/server-{key,cert}.pem` (TLS for this app) and
`certs/sp-{private-key,cert}.pem` (this app's signing keypair for SAML
AuthnRequests). Your browser will warn about the self-signed cert — expected for
local testing; see "Going to HTTPS" below for real certs.

## 3. Configure PingFederate — SAML

In the PingFederate admin console (default `https://localhost:9999/pingfederate/app`):

1. **IdP Adapter**: reuse your existing `HTML Form Adapter` / LDAP Credential
   Validator from earlier chapters (pointed at your DC01/AD data store).
2. **SP Connection**: `Applications > Integration > SP Connections > Create Connection`
   - Connection type: Browser SSO Profiles
   - Partner's Entity ID (SP Issuer): `urn:cascade:internal-portal` (must match `SAML_SP_ISSUER`)
   - Browser SSO: Assertion Consumer Service (ACS) URL = `https://localhost:3000/auth/saml/callback`, Binding = POST
   - Assertion Creation: Attribute Contract — add `email`, `displayName`, `memberOf` (or `groups`), mapped from your LDAP attributes (e.g. `mail`, `cn`, `memberOf`)
   - Protocol Settings: enable SLO, SLO endpoint URL = `https://localhost:3000/auth/saml/logout` (informational — this app initiates SLO itself, PingFederate just needs the partner's endpoint on file)
   - Credentials: sign assertions; if you want to verify this app's signed AuthnRequests, upload `certs/sp-cert.pem` here
3. Under `System > Server Settings > Federation Info`, note the **Base URL** —
   that's your `SAML_IDP_ISSUER`. The SSO endpoint is usually
   `{base URL}/idp/SSO.saml2`, SLO is `{base URL}/idp/SLO.saml2`.

### Export the IdP signing certificate
`Security > Certificate & Key Management > Signing & Decryption Keys & Certificates`
→ find PingFederate's active signing cert → Export → save as
`certs/pingfederate-idp-signing.pem`. This is how the app verifies assertions
actually came from your PingFederate instance and weren't forged.

## 4. Configure PingFederate — OIDC

1. `Applications > OAuth > Clients > Add Client`
   - Client ID: `cascade-internal-portal` (matches `OIDC_CLIENT_ID`)
   - Grant type: Authorization Code
   - Redirect URI: `https://localhost:3000/auth/oidc/callback`
   - Generate a client secret → put it in `OIDC_CLIENT_SECRET`
2. `Applications > OAuth > Policies` (or `OpenID Connect > Policies` depending on
   version): ensure an OIDC policy exists exposing `email`, `profile`, and a
   `groups`/`memberOf` claim, and attach it to the client above.
3. Endpoints (usually derivable from your Base URL):
   - Authorization: `{base URL}/as/authorization.oauth2`
   - Token: `{base URL}/as/token.oauth2`
   - UserInfo: `{base URL}/idp/userinfo.openid`
   - End session (RP-initiated logout): `{base URL}/idp/startSLO.ping`

## 5. Configure the app

```bash
cp .env.example .env
```

Fill in every value from steps 3–4 above. `APP_BASE_URL` should match wherever
you'll actually browse to (e.g. `https://localhost:3000`, or your machine's LAN
hostname once you're hosting it for another project — see below).

## 6. Run it

```bash
npm start
```

Visit `https://localhost:3000`. Pick SAML or OIDC, authenticate against your
directory, scan the QR code on first login to enroll TOTP (any authenticator
app), then you're in.

## 7. Test the whole point of this app

- Log in via SAML, check `/profile` — confirm the raw assertion attributes match
  what you configured in the Attribute Contract.
- Log out (`/auth/saml/logout`), confirm PingFederate's own session also clears
  (try hitting the app again — it should ask you to authenticate at Ping, not
  just show a cached page).
- Repeat both checks via OIDC.
- Log in as a user without an admin group and confirm `/admin` returns a clean
  403 rather than the page.
- Use "Reset MFA enrollment" on `/admin` and confirm it forces a fresh QR
  enrollment on next login.

## Hosting on your local server

Once it's working over `localhost`, to actually host it for use in another
project on your network:

1. **Bind to a real hostname/IP.** Update `APP_BASE_URL` in `.env`, and
   `SAML_SP_ISSUER` / redirect URIs in PingFederate, to match wherever the app
   will actually be reached (e.g. `https://cascade.internal.lan:3000`) — SAML and
   OIDC both validate the exact callback URL, so this has to match exactly on
   both sides.
2. **Get real (or longer-lived) certs for that hostname.** Either re-run
   `scripts/generate-certs.sh` with the new hostname in the `-subj`/SAN fields,
   or use `mkcert` for a locally-trusted cert your browser won't warn about:
   ```bash
   mkcert cascade.internal.lan
   # then point TLS_KEY_PATH / TLS_CERT_PATH at the generated files
   ```
3. **Run it as a persistent service** instead of a foreground `npm start`:
   ```bash
   npm install -g pm2
   pm2 start server.js --name cascade-portal
   pm2 save
   pm2 startup   # prints an OS-specific command to survive reboots
   ```
4. **Open the port** on your machine's firewall if other devices need to reach
   it (e.g. `sudo ufw allow 3000/tcp` on Linux).
5. **Optional: put nginx in front** for a normal port-443 URL and to centralize
   TLS termination if you're layering more internal apps behind it later:
   ```nginx
   server {
     listen 443 ssl;
     server_name cascade.internal.lan;
     ssl_certificate     /path/to/fullchain.pem;
     ssl_certificate_key /path/to/privkey.pem;
     location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
   }
   ```
   If you do this, set `TRUST_PROXY=true` in `.env` so secure cookies behave
   correctly behind the proxy.
6. **Harden `SESSION_SECRET`** — generate a real random value
   (`openssl rand -hex 32`) rather than leaving the placeholder.

## Swapping in a real database later

Everything MFA/user related is isolated in `data/store.js`. If you reuse this
app in another project and want Postgres/Redis instead of the local JSON file,
that's the only file that needs to change — the routes call `getMfaSecret` /
`setMfaSecret` / `clearMfaSecret` and don't care how they're implemented.

## Troubleshooting

- **"No IdP signing certificate found" on startup** — you haven't exported
  PingFederate's signing cert to `certs/pingfederate-idp-signing.pem` yet (step 3).
- **SAML callback fails with a signature error** — the cert in
  `SAML_IDP_CERT_PATH` doesn't match PingFederate's *current* signing cert, or
  PingFederate rotated it. Re-export.
- **OIDC redirect_uri mismatch** — the Redirect URI on the PingFederate client
  must be byte-for-byte identical to `APP_BASE_URL + OIDC_CALLBACK_PATH`,
  including the scheme.
- **Stuck in a login → MFA verify → login loop** — usually the session cookie
  isn't surviving the redirect back from PingFederate; check that
  `APP_BASE_URL` uses `https` if `NODE_ENV=production` (secure cookies won't be
  sent over plain HTTP).
