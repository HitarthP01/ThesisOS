# ThesisOS AI Contributor Context

This file is the fast-start guide for AI coding agents and future maintainers.
Read it together with `README.md` and `PRODUCT_PLAN.md` before changing code.

## Product intent

ThesisOS is an evidence-first US equity research portal. A user enters a ticker,
the server resolves it to an SEC CIK, and the interface presents filed
fundamentals, recent filings, transparent calculations, and a separately
sourced delayed market quote.

The product must never fabricate missing financial values, prices, filing
dates, or citations. `null`/unavailable is preferable to an estimate.

## Runtime and architecture

- Runtime: Node.js 22.13+ for local development.
- Framework: vinext/React with Cloudflare Worker-compatible output.
- Main UI: `app/page.tsx`.
- Styling: `app/globals.css`.
- Research API: `app/api/company/route.ts`.
- SEC and quote normalization: `lib/sec.ts`.
- Worker entrypoint: `worker/index.ts`.
- Hosting metadata: `.openai/hosting.json`.
- CI workflow: `.github/workflows/ci.yml`.

The browser calls:

```text
GET /api/company?ticker=AAPL
```

The API returns one `CompanyResearch` object. Keep the TypeScript shape in
`app/page.tsx` synchronized with the exported type in `lib/sec.ts`.

## Data flow

1. Validate the ticker format in `app/api/company/route.ts`.
2. Resolve the ticker through the SEC company ticker list.
3. Fetch SEC submissions and XBRL company facts using the resolved CIK.
4. Normalize annual duration and instant facts in `lib/sec.ts`.
5. Fetch a delayed equity quote from Yahoo Finance independently.
6. Return source URLs, fiscal periods, filing dates, quote timestamps, and the
   retrieval timestamp with the normalized values.
7. Render deterministic comparisons and scenarios in `app/page.tsx`.

SEC failures fail the request because fundamentals cannot be verified. Quote
failures do not fail the request; `market` becomes `null` and the UI must state
that no quote was returned.

## Data integrity invariants

- SEC filings/XBRL are the source of truth for reported fundamentals.
- Market quotes are secondary data and must be labelled `delayed`.
- Always display the quote timestamp and source link.
- Mark quotes stale when the source timestamp is more than 96 hours old.
- Never substitute a model value for an unavailable reported value.
- Never describe the scenario output as a price target.
- Preserve direct EDGAR links for every filing shown.
- Keep cache duration short enough that quote timestamps remain meaningful.
- Treat extreme margins or growth rates as mechanically correct only when the
  underlying filed facts support them; do not silently clamp the values.
- When adding derived signals, document the formula and inputs in the UI.

## Important normalization behavior

- Annual flow facts must come from annual forms and cover roughly 300-430 days.
- Annual balance-sheet facts must be instant facts from annual forms.
- Restated comparative facts are deduplicated by fiscal period, preferring the
  most recently filed value.
- Candidate XBRL concepts are ordered intentionally. Add new concepts only after
  checking representative issuers and avoiding double counting.
- The current interface is optimized for US SEC registrants. Do not imply global
  ticker coverage without a separate registry and accounting adapter.

## Safe extension points

### Additional market data

Add provider adapters behind a common market snapshot contract rather than
placing provider-specific fields in the UI. A licensed real-time provider can
replace the delayed adapter later without changing the rendering contract.

### Screeners and triggers

Build screeners from normalized, cited fields. Store each trigger as:

- stable trigger ID;
- human-readable name;
- deterministic formula;
- source fields and periods;
- evaluation timestamp;
- status (`confirmed`, `watch`, or `risk`);
- explanatory text.

Do not let a screener result overwrite a reported fact. Screeners are derived
research signals, not source data.

### Industry-specific metrics

Add industry adapters instead of forcing one universal concept set. Banks,
insurers, REITs, miners, and pre-revenue issuers need different KPIs and
valuation methods.

## Validation checklist

Before publishing a data change:

1. Run `npm run build`.
2. Query `/api/company` for at least AAPL, BMNR, NVDA, and JPM.
3. Confirm issuer, fiscal period, filing date, quote value, quote timestamp, and
   source count are present.
4. Compare at least one issuer's revenue, net income, and EPS against its linked
   10-K.
5. Test the visible search field and submit button in a browser.
6. Confirm invalid/unknown tickers show an error without stale prior-company
   data being presented as the new result.
7. Verify no console errors and no fabricated fallback values.

## Change discipline

- Preserve `.openai/hosting.json`; do not create another hosted site.
- Never commit `.env` files or credentials.
- Keep `SEC_USER_AGENT` configurable and use a monitored contact in production.
- Update `README.md`, this file, and `PRODUCT_PLAN.md` when architecture or data
  contracts materially change.
- Keep source changes, successful build output, hosted version, and GitHub
  commit aligned.

## Known limitations

- Quotes are delayed and come from an anonymous Yahoo Finance chart response,
  not a licensed real-time exchange feed.
- SEC company facts can contain issuer-specific tagging inconsistencies.
- The current valuation scenarios are intentionally simple and illustrative.
- Watchlist state is device-local UI state, not a durable user account feature.
- International securities, funds, options, crypto, and macro data require
  separate adapters.
