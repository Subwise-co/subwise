// Gmail fetcher — reads Subject, From, Date, and the plain-text body (truncated) of
// payment-related emails ONLY. Lookback window: 90 days on the first scan, ~7 days on each
// weekly re-scan (incremental — only new mail since the last scan). The body is needed to
// extract amounts, merchants (for bank e-mandates), trial lengths, billing cycle, and dates —
// all of which live in the body, not the subject. We fetch only emails matching the payment
// query below (never the whole inbox), never read attachments, and only ever use the
// gmail.readonly scope (the app cannot send, modify, or delete mail). The matched text is then
// passed to an LLM to extract those structured fields; the raw email content is used only for
// that extraction and is NOT stored — only the extracted fields are persisted.
import { google } from "googleapis";

// Per-email body cap. Kept modest because the Gmail snippet is prepended (high-signal lines lead)
// and to keep the payload small for the parsing step.
const BODY_MAX = Number(process.env.LLM_BODY_MAX) || 1000;
// Safety cap on how many matching message IDs to collect for one scan (paginated). High enough to
// cover a 90-day window in a large inbox; the progressive job processes them in small batches.
const MAX_MESSAGES = Number(process.env.SCAN_MAX_MESSAGES) || 600;
const PAGE_SIZE = 100;

// Purchase/subscription keywords matched in the SUBJECT (broad terms here would explode if matched
// over the whole body, so we keep them subject-scoped).
const SUBJECT_KEYWORDS =
  'subscription OR renewal OR receipt OR invoice OR payment OR autopay OR mandate OR "e-mandate" OR trial OR billing OR membership OR order OR purchase OR plan OR debited OR charged OR SIP OR instalment OR installment OR premium OR funded OR recharge OR wallet OR topup OR "top-up" OR credited';

// Auto-pay / e-mandate signals matched ANYWHERE (subject OR body). These emails frequently have a
// generic subject ("Transaction alert", "Mandate notification") with the merchant + mandate details
// only in the body, so subject-only matching missed them (e.g. the Facebook bank e-mandate). NOTE:
// hyphenated terms MUST be quoted, else Gmail treats the "-" as an exclusion operator.
const ANYWHERE_KEYWORDS =
  'mandate OR "e-mandate" OR "e-nach" OR nach OR enach OR autopay OR "auto-pay" OR "auto debit" OR "auto-debit" OR "standing instruction" OR "recurring payment" OR "will be debited" OR "UPI AutoPay" OR SIP';

// `days` controls the lookback window: first scan uses 90 (3 months), the weekly scan uses ~7
// (incremental — only new emails since the last scan), which keeps cost and tokens low.
const buildQuery = (days) =>
  `newer_than:${days}d (subject:(${SUBJECT_KEYWORDS}) OR (${ANYWHERE_KEYWORDS}))`;

// Decode a base64url Gmail body part.
function decodePart(data) {
  if (!data) return "";
  return Buffer.from(
    data.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString("utf8");
}

// Walk the MIME tree and return the best plain-text body (falls back to stripped HTML).
function extractBody(payload) {
  if (!payload) return "";
  let plain = "";
  let html = "";
  const walk = (part) => {
    if (!part) return;
    const mime = part.mimeType || "";
    if (mime === "text/plain" && part.body?.data)
      plain += decodePart(part.body.data);
    else if (mime === "text/html" && part.body?.data)
      html += decodePart(part.body.data);
    if (Array.isArray(part.parts)) part.parts.forEach(walk);
  };
  walk(payload);
  let text = plain;
  if (!text && html) {
    // Many emails (e.g. Groww SIP) are HTML-only. Strip style/script/head blocks first so the
    // real content isn't buried behind CSS, then strip tags and decode common entities.
    text = html
      .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&zwnj;|&#8203;|&shy;/gi, " ")
      .replace(/&amp;/gi, "&");
  }
  return text.replace(/\s+/g, " ").trim();
}

function gmailClient(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

// List ALL matching message IDs in the window (paginated, list-only — cheap, no bodies/LLM).
// Used by the progressive scan job to know the full set up front. Returns string[] of message IDs.
export async function listSubscriptionMessageIds(
  accessToken,
  { days = 90 } = {},
) {
  const gmail = gmailClient(accessToken);
  const q = buildQuery(days);
  const ids = [];
  let pageToken;
  do {
    const page = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: Math.min(PAGE_SIZE, MAX_MESSAGES - ids.length),
      pageToken,
    });
    if (page.data.messages) ids.push(...page.data.messages.map((m) => m.id));
    pageToken = page.data.nextPageToken;
  } while (pageToken && ids.length < MAX_MESSAGES);
  return ids;
}

// Fetch Subject/From/Date/body for a specific set of message IDs (one batch of a scan job).
export async function fetchEmailsByIds(accessToken, ids) {
  const gmail = gmailClient(accessToken);
  const emails = [];
  for (const id of ids || []) {
    try {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "full",
      });
      const headers = detail.data.payload.headers;
      const get = (name) => headers.find((h) => h.name === name)?.value || "";
      // Prepend Gmail's snippet (clean, high-signal — skips boilerplate) so key facts like
      // "SIP AMOUNT ₹2,499.88" lead even when the body is messy HTML. Then truncate.
      const snippet = detail.data.snippet || "";
      const bodyText = extractBody(detail.data.payload);
      emails.push({
        subject: get("Subject"),
        sender: get("From"),
        date: get("Date"),
        body: `${snippet} ${bodyText}`.trim().slice(0, BODY_MAX),
      });
    } catch {
      /* skip a failed message silently */
    }
  }
  return emails;
}

// Convenience wrapper (list → fetch all) for the small synchronous weekly/incremental path.
export async function fetchSubscriptionEmails(accessToken, { days = 90 } = {}) {
  const ids = await listSubscriptionMessageIds(accessToken, { days });
  if (!ids.length) return [];
  return fetchEmailsByIds(accessToken, ids);
}
