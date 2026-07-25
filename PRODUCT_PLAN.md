# ThesisOS Product Plan

## Product promise

ThesisOS turns any supported ticker into a continuously monitored investment
thesis. It combines company fundamentals, primary-source evidence, valuation
scenarios, catalysts, risks, and change detection in one research workspace.

## Initial audience

Serious self-directed investors researching US-listed equities with a
fundamental, medium-to-long-term approach.

## Product principles

1. Every material claim should link to evidence.
2. AI explains, compares, extracts, and challenges; deterministic code performs
   financial calculations.
3. The interface emphasizes what changed and why it matters.
4. Analysis adapts to the company's business model and industry.
5. The product supports decisions without presenting uncertain predictions as
   facts.

## MVP

### Included

- Universal ticker search
- Company snapshot and business-model explanation
- Industry-aware operating metrics
- Financial trend cards
- Evidence-backed AI research brief
- Bull, base, and bear valuation scenarios
- Structured thesis with measurable conditions
- Catalyst and risk timeline
- Watchlist and thesis-strength alerts
- Filing and announcement change summaries

### Not included initially

- Brokerage connections or trade execution
- Intraday technical-trading signals
- Options execution
- Global exchange coverage
- Social-media sentiment scoring
- Unexplained AI buy/sell ratings

## Core user journey

1. Search for a ticker.
2. Understand the business and the variables that drive it.
3. Review financial quality, valuation, risks, and catalysts.
4. Create or adopt a structured investment thesis.
5. Adjust scenario assumptions.
6. Add the company to a watchlist.
7. Receive alerts when new evidence materially changes the thesis.

## Delivery stages

### Stage 1 — Interactive product prototype

- Polished responsive dashboard
- Ticker switching with representative company profiles
- Thesis scorecard
- Scenario controls
- Research activity feed
- Local watchlist state

### Stage 2 — Primary-source data

- SEC company facts and filings ingestion
- Investor-relations document collection
- Market-price provider
- Filing normalization and version comparison
- Source-level citations

### Stage 3 — AI research system

- Retrieval over filings, transcripts, and presentations
- Structured extraction with validation
- “What changed?” analysis
- Thesis-impact classification
- Personalized daily research brief

### Stage 4 — Accounts and durable workspaces

- Authentication
- Saved theses and valuation models
- Watchlists and alert preferences
- Portfolio-level exposure analysis

### Stage 5 — Commercial release

- Subscription tiers
- Usage and quality monitoring
- Data licensing review
- Collaboration and research sharing
- Expanded market coverage

## Proposed architecture

- Frontend: responsive React application
- Application layer: typed server endpoints
- Database: relational storage for users, companies, facts, theses, and events
- Document layer: original filings plus normalized text and chunks
- Calculation engine: versioned deterministic valuation models
- AI layer: retrieval, extraction, comparison, and cited synthesis
- Jobs: scheduled filing, price, and catalyst updates

## First validation ticker

BMNR is the initial stress test because it requires non-standard treasury NAV,
rapid share-count changes, staking economics, capital-structure analysis, and
frequent disclosure reconciliation. The product remains ticker-agnostic.
