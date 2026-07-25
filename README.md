# ThesisOS

ThesisOS is an evidence-first equity research portal. Enter a US ticker and the
application builds a primary-source research view from SEC submissions and XBRL
company facts.

## Current capabilities

- Resolve US-listed tickers to permanent SEC CIK identifiers
- Load normalized annual revenue, income, cash flow, assets, equity, EPS, and
  share-count facts
- Compare annual growth and profitability using deterministic calculations
- Link directly to recent 10-K, 10-Q, 8-K, 20-F, 40-F, and 6-K filings
- Display timestamped delayed equity quotes and daily price changes
- Show a transparent illustrative valuation framework
- Display source timestamps, methodology, and data limitations
- Run as a Cloudflare-compatible vinext application

## Data integrity principles

- Primary sources before summaries
- Every material dataset retains its source URL and retrieval timestamp
- Calculations are deterministic and reproducible
- Missing data is shown as unavailable rather than silently estimated
- Market prices are explicitly labelled as delayed and never estimated
- Research outputs are not investment recommendations

## Data sources

Fundamentals use the SEC's unauthenticated public APIs:

- `https://www.sec.gov/files/company_tickers.json`
- `https://data.sec.gov/submissions/CIK##########.json`
- `https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json`

Automated requests declare a ThesisOS user agent and remain well below the
SEC's published fair-access ceiling.

Delayed equity quotes use Yahoo Finance's public chart response. The UI displays
the quote timestamp, source link, and a stale-data warning when appropriate.

## Local development

Requires Node.js 22.13 or newer.

```bash
cp .env.example .env.local
npm install
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead of
`npm cp`. Set `SEC_USER_AGENT` to your name or organization and a monitored
contact email before running a public deployment.

Production build:

```bash
npm run build
```

## Project structure

- `app/page.tsx` - interactive research workspace
- `app/api/company/route.ts` - ticker research API
- `lib/sec.ts` - SEC retrieval and XBRL normalization
- `tests/` - server-render and source-integrity checks
- `PRODUCT_PLAN.md` - staged product roadmap

## Roadmap

1. Improve point-in-time fact normalization and restatement handling
2. Add a licensed real-time market-price provider
3. Add industry-specific KPI adapters
4. Add saved theses and watchlists
5. Add cited document retrieval and filing comparisons
6. Expand beyond US-listed SEC registrants

## Disclaimer

ThesisOS is research software, not an investment adviser. The application may
contain incomplete or incorrectly normalized data. Verify all information
against original regulatory filings before making financial decisions.

## License

MIT
