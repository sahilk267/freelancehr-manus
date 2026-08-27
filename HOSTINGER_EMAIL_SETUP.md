# Hostinger Email Activation — FreelanceHR

This guide activates the existing approval-controlled email layer. Do not place mailbox passwords in source files, client-side code, Git, or chat messages.

## 1. Create and route the mailboxes

Create these six mailboxes in Hostinger Email and forward their inbound mail to the private owner inbox: `owner@overseasjob.in`, `clients@overseasjob.in`, `talent@overseasjob.in`, `interviews@overseasjob.in`, `finance@overseasjob.in`, and `privacy@overseasjob.in`. Each address has a distinct recruitment purpose and is separately visible in FreelanceHR.

## 2. Configure DNS and deliverability

In Hostinger hPanel, publish the SPF and DKIM records generated for the mailbox service. Add a DMARC policy initially using monitoring mode (`p=none`) and review aggregate reports before moving to a stricter policy. Do not enable bulk automation until SPF, DKIM, and DMARC all pass for the sending domain.

## 3. Add the backend-only credentials

Use the secure environment-variable panel to add the following values from Hostinger’s **Email Client Configuration** page:

| Variable | Required value |
| --- | --- |
| `SMTP_HOST` | Hostinger’s outgoing SMTP hostname |
| `SMTP_PORT` | The TLS SMTP port shown in hPanel, normally 465 or 587 |
| `SMTP_USER` | `operations@overseasjob.in` or another dedicated service mailbox |
| `SMTP_PASSWORD` | The mailbox password or app password |
| `SMTP_FROM_DOMAIN` | `overseasjob.in` |

For inbound reply monitoring, add these separate environment values only after the outgoing SMTP test succeeds: `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, and `IMAP_PASSWORD`. Use the same dedicated operations mailbox or a forwarding mailbox; never expose these values to the browser.

The live readiness indicator in **Control Plane → Domain sender identities** will remain disabled until all four SMTP credentials are configured. Then register each six sender identities, verify the mailbox exists, and activate it only after a successful test message.

## 4. Live operating sequence

Every outbound message follows: **draft → owner approval request → owner approval → sender/recipient validation → SMTP delivery → audit event**. The delivery layer blocks inactive senders, recipients on the suppression list, and unapproved messages. The emergency stop blocks all external automation.

## 5. Receive replies safely

For the first release, forward each mailbox to the dedicated operations mailbox and use the **Inbound mail** adapter to record and classify replies. A production inbound connector must preserve provider message IDs, map each reply to an existing conversation, and route terms such as “unsubscribe”, “stop”, or “do not contact” to the suppression list before any follow-up is scheduled.

## 6. Activation test

Send exactly one owner-approved message from `clients@overseasjob.in` to an address you control. Confirm the From identity, Reply-To, SPF/DKIM authentication result, thread correlation, audit event, and inbound reply flow. Only then activate controlled client or candidate outreach.
