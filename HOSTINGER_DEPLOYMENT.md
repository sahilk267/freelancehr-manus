# Hostinger Business Node.js Deployment

This document is the deployment handoff for `freelancehr.overseasjob.in`. Hostinger's Node.js application manager can host the React/Vite build and Node server, but shared hosting should not be treated as a permanent worker machine. The production design therefore processes a **small, bounded batch** per cron trigger and keeps automation state in MySQL.

## Required production decisions

The managed development template includes platform-specific authentication and storage helpers. They are not portable to a third-party host. Before a Hostinger launch, the following components must be supplied with production equivalents.

| Concern | Required production choice | Do not do this |
| --- | --- | --- |
| Authentication | OIDC provider, such as Google Workspace/Auth0/Clerk, with server-side session cookies | Do not deploy platform-specific preview OAuth credentials to Hostinger |
| Database | Hostinger MySQL or a managed MySQL-compatible database with TLS | Do not expose database credentials in the React application |
| Candidate documents | Private S3-compatible bucket with signed GET/PUT endpoints and malware scanning | Do not retain CVs in public web directories or database BLOBs |
| AI | `OPENROUTER_API_KEY` held only in Node environment variables | Do not use `VITE_OPENROUTER_API_KEY` or call OpenRouter directly from browser code |
| Email | Approved transactional email provider with DKIM/SPF/DMARC | Do not enable mass outreach through shared-host mail without consent/opt-out controls |
| Calendar | Google/Microsoft Calendar OAuth integration | Do not mark calendar events sent until provider confirmation is recorded |
| Payments | Payment/bank reconciliation provider or controlled manual ledger | Do not issue credit, write-off, or mark paid automatically |

## Deployment pipeline

The repeatable pipeline is **build → upload/deploy → configure environment → set Node startup → configure domain → run migration → verify health → enable restricted automation**. Each action should run with a separate deployment account and audit record.

| Step | Action | Acceptance condition |
| --- | --- | --- |
| 1 | Create a Git repository or zip release from the audited project | No `.env` file, candidate document, local log, or test data is included |
| 2 | In hPanel, create a Node.js application for the subdomain | App root and startup command are configured |
| 3 | Build with `pnpm install --frozen-lockfile && pnpm build` | `dist/public` contains the Vite bundle |
| 4 | Set server secrets in hPanel environment settings | Secrets are visible only to the Node runtime |
| 5 | Attach TLS-enabled MySQL and run Drizzle migrations once | Tables and indices are created without destructive changes |
| 6 | Point `freelancehr.overseasjob.in` to the Node application and enable SSL | HTTPS health endpoint is reachable |
| 7 | Configure a short Hostinger cron to invoke the bounded queue endpoint | One controlled job maximum per trigger during pilot |
| 8 | Keep automation in `safe` mode for pilot | Every external-facing action still requires explicit owner approval |

## Environment inventory

Never commit the values. Set these in the Hostinger application environment panel or equivalent secure secret manager.

```dotenv
NODE_ENV=production
PORT=<provided-by-hostinger>
DATABASE_URL=mysql://<user>:<password>@<host>:<port>/<database>?ssl={"rejectUnauthorized":true}
OPENROUTER_API_KEY=<server-side-only>
APP_BASE_URL=https://freelancehr.overseasjob.in
SESSION_SECRET=<at-least-32-random-bytes>
OIDC_ISSUER_URL=<selected-auth-provider>
OIDC_CLIENT_ID=<selected-auth-provider>
OIDC_CLIENT_SECRET=<selected-auth-provider>
STORAGE_BUCKET=<private-bucket-name>
STORAGE_REGION=<region>
STORAGE_ACCESS_KEY_ID=<server-side-only>
STORAGE_SECRET_ACCESS_KEY=<server-side-only>
EMAIL_PROVIDER_API_KEY=<server-side-only>
```

## Automation and cron

The queue processor must never use `setInterval`, `node-cron`, or a long-running worker on shared hosting. A single authenticated cron invocation should claim one database record by lock token, verify the workspace emergency-stop flag, process a bounded task, write its structured result, and exit. The existing queue service follows those state and idempotency patterns. Configure the cron time in UTC and convert business schedules to `Asia/Kolkata` in the application interface.

During the first pilot, schedule only one low-risk task class, such as reply classification or CV extraction, and keep all outbound messages in draft. Do not schedule automated sending, client sharing, hiring outcomes, or invoice changes.

## Domain and HTTPS

In Hostinger hPanel, add `freelancehr.overseasjob.in` as a subdomain or Node application domain. Create the CNAME/A record required by the selected Hostinger app configuration and issue SSL after DNS propagation. Redirect HTTP to HTTPS, enable `Secure`, `HttpOnly`, and `SameSite` cookie attributes, and set the production CORS allowlist to only `https://freelancehr.overseasjob.in`.

## Pre-launch go/no-go

The system must not go live until the team has confirmed: the owner sign-in flow; database backups and restoration test; private document access test; consent withdrawal and suppression test; OpenRouter quota/fallback failure test; owner approval test; email opt-out handling; TLS verification; no secrets in frontend bundles; and the emergency-stop drill. A successful `pnpm check` and `pnpm test` are necessary but not sufficient for this production approval.
