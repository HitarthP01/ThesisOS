"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type AnnualPoint = {
  period: string;
  revenue: number | null;
  netIncome: number | null;
  operatingCashFlow: number | null;
  assets: number | null;
  equity: number | null;
  eps: number | null;
  filed: string | null;
};

type CompanyResearch = {
  issuer: {
    cik: string;
    ticker: string;
    name: string;
    exchange: string;
    industry: string;
    sic: string | null;
    fiscalYearEnd: string | null;
  };
  annuals: AnnualPoint[];
  metrics: {
    latestFiscalPeriod: string | null;
    latestFiledAt: string | null;
    revenue: number | null;
    revenueGrowth: number | null;
    netIncome: number | null;
    netMargin: number | null;
    marginChange: number | null;
    assets: number | null;
    equity: number | null;
    cash: number | null;
    operatingCashFlow: number | null;
    sharesOutstanding: number | null;
    dilutedEps: number | null;
    bookValuePerShare: number | null;
    cashToAssets: number | null;
  };
  market: {
    price: number;
    currency: string;
    previousClose: number | null;
    change: number | null;
    changePercent: number | null;
    marketTime: string;
    exchange: string;
    sourceLabel: string;
    sourceUrl: string;
    isStale: boolean;
  } | null;
  filings: Array<{
    accessionNumber: string;
    filingDate: string;
    form: string;
    primaryDocument: string;
    reportDate: string;
    url: string;
  }>;
  sources: Array<{ label: string; url: string }>;
  fetchedAt: string;
  methodology: string;
};

type SignalStatus = "confirmed" | "watch" | "risk";

const coverage = ["BMNR", "NVDA", "JPM", "LLY", "O"];

function formatCurrency(value: number | null, compact = true) {
  if (value === null || !Number.isFinite(value)) return "Not reported";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 2 : 2,
  }).format(value);
}

function formatPercent(value: number | null, signed = false) {
  if (value === null || !Number.isFinite(value)) return "Not available";
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: signed ? "always" : "auto",
  }).format(value);
}

function formatNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Not reported";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMarketPrice(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value);
}

function fiscalYear(period: string | null) {
  return period ? new Date(`${period}T00:00:00Z`).getUTCFullYear() : null;
}

function statusFor(value: number | null, good: number, risk: number): SignalStatus {
  if (value === null) return "watch";
  if (value >= good) return "confirmed";
  if (value <= risk) return "risk";
  return "watch";
}

function scoreFor(value: number | null, min: number, max: number) {
  if (value === null) return 50;
  return Math.round(Math.max(8, Math.min(92, ((value - min) / (max - min)) * 100)));
}

function StatusMark({ status }: { status: SignalStatus }) {
  return <span className={`status-mark ${status}`} aria-hidden="true" />;
}

export default function Home() {
  const [ticker, setTicker] = useState("BMNR");
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState<CompanyResearch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(true);
  const [scenario, setScenario] = useState<"Bear" | "Base" | "Bull">("Base");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    fetch(`/api/company?ticker=${encodeURIComponent(ticker)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as CompanyResearch | { error?: string };
        if (!response.ok) {
          throw new Error("error" in payload ? payload.error : "Unable to load company.");
        }
        setCompany(payload as CompanyResearch);
      })
      .catch((requestError) => {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load company data.",
        );
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [ticker]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const next = query.trim().toUpperCase();
    if (!next) return;
    setTicker(next);
    setQuery("");
    setScenario("Base");
    setSaved(false);
  }

  const scenarioModel = useMemo(() => {
    if (!company) {
      return { value: null, method: "Waiting for SEC data", assumption: "N/A" };
    }

    const eps = company.metrics.dilutedEps;
    if (eps !== null && eps > 0) {
      const multiple = scenario === "Bear" ? 12 : scenario === "Bull" ? 30 : 20;
      return {
        value: eps * multiple,
        method: "Annual diluted EPS x P/E",
        assumption: `${multiple.toFixed(0)}x earnings`,
      };
    }

    const bookValue = company.metrics.bookValuePerShare;
    if (bookValue !== null && bookValue > 0) {
      const multiple = scenario === "Bear" ? 0.8 : scenario === "Bull" ? 2.2 : 1.4;
      return {
        value: bookValue * multiple,
        method: "Book value per share x P/B",
        assumption: `${multiple.toFixed(1)}x book`,
      };
    }

    return {
      value: null,
      method: "Insufficient standardized facts",
      assumption: "Manual model required",
    };
  }, [company, scenario]);

  const bars = useMemo(() => {
    const values = company?.annuals.map((point) => point.revenue ?? 0) ?? [];
    const maximum = Math.max(...values, 1);
    return values.map((value) => Math.max(6, Math.round((value / maximum) * 100)));
  }, [company]);

  const signals = useMemo(() => {
    if (!company) return [];
    const { metrics } = company;
    return [
      {
        label: "Top-line trend",
        detail:
          metrics.revenueGrowth === null
            ? "Comparable annual revenue was not available."
            : `Annual revenue changed ${formatPercent(metrics.revenueGrowth, true)}.`,
        status: statusFor(metrics.revenueGrowth, 0.08, 0) as SignalStatus,
      },
      {
        label: "Profitability",
        detail:
          metrics.netMargin === null
            ? "Standardized net margin could not be calculated."
            : `Latest annual net margin was ${formatPercent(metrics.netMargin)}.`,
        status: statusFor(metrics.netMargin, 0.1, 0) as SignalStatus,
      },
      {
        label: "Cash coverage",
        detail:
          metrics.cashToAssets === null
            ? "Cash-to-assets coverage was not available."
            : `Cash represented ${formatPercent(metrics.cashToAssets)} of reported assets.`,
        status: statusFor(metrics.cashToAssets, 0.1, 0.02) as SignalStatus,
      },
      {
        label: "Evidence coverage",
        detail: `${company.filings.length} recent primary-source filings are linked for review.`,
        status: (company.filings.length >= 4 ? "confirmed" : "watch") as SignalStatus,
      },
    ];
  }, [company]);

  const drivers = useMemo(() => {
    if (!company) return [];
    return [
      {
        label: "Revenue momentum",
        value: scoreFor(company.metrics.revenueGrowth, -0.2, 0.3),
        detail: formatPercent(company.metrics.revenueGrowth, true),
      },
      {
        label: "Net margin",
        value: scoreFor(company.metrics.netMargin, -0.1, 0.3),
        detail: formatPercent(company.metrics.netMargin),
      },
      {
        label: "Cash / assets",
        value: scoreFor(company.metrics.cashToAssets, 0, 0.25),
        detail: formatPercent(company.metrics.cashToAssets),
      },
      {
        label: "Cash conversion",
        value: scoreFor(
          company.metrics.operatingCashFlow !== null &&
            company.metrics.netIncome !== null &&
            company.metrics.netIncome !== 0
            ? company.metrics.operatingCashFlow / Math.abs(company.metrics.netIncome)
            : null,
          0,
          1.5,
        ),
        detail:
          company.metrics.operatingCashFlow === null
            ? "Not available"
            : formatCurrency(company.metrics.operatingCashFlow),
      },
    ];
  }, [company]);

  const latestComparison = useMemo(() => {
    if (!company) return "";
    const growth = company.metrics.revenueGrowth;
    const marginChange = company.metrics.marginChange;
    const growthText =
      growth === null
        ? "Annual revenue comparison is unavailable"
        : `annual revenue ${growth >= 0 ? "increased" : "declined"} ${formatPercent(Math.abs(growth))}`;
    const marginText =
      marginChange === null
        ? "margin comparability is limited"
        : `net margin ${marginChange >= 0 ? "expanded" : "contracted"} ${Math.abs(marginChange * 10_000).toFixed(0)} bps`;
    return `${growthText}, while ${marginText}. Review the linked filing before changing a thesis.`;
  }, [company]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">T</div>
          <div>
            <strong>ThesisOS</strong>
            <span>Evidence-first research</span>
          </div>
        </div>

        <nav aria-label="Primary navigation">
          {["Overview", "Financials", "Filings", "Thesis", "Models"].map((item) => (
            <button className={item === "Overview" ? "nav-item active" : "nav-item"} key={item}>
              <span className="nav-symbol">{item.slice(0, 1)}</span>
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-label">Validation universe</div>
        <div className="coverage-list">
          {coverage.map((item) => (
            <button
              className={ticker === item ? "coverage active" : "coverage"}
              key={item}
              onClick={() => {
                setTicker(item);
                setScenario("Base");
              }}
            >
              <span>{item.slice(0, 1)}</span>
              <div>
                <strong>{item}</strong>
                <small>Load SEC profile</small>
              </div>
            </button>
          ))}
        </div>

        <div className="sidebar-brief">
          <span className="pulse" />
          <div>
            <strong>Primary-source mode</strong>
            <small>No fabricated market prices or estimates</small>
          </div>
        </div>

        <div className="profile public-profile">
          <div className="avatar">OS</div>
          <div>
            <strong>Open research build</strong>
            <span>SEC-backed MVP</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <form className="search" onSubmit={submitSearch}>
            <span aria-hidden="true">S</span>
            <input
              aria-label="Search ticker"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Enter a US ticker, for example AAPL"
              value={query}
            />
            <button
              type="submit"
              className="search-submit"
              disabled={!query.trim() || loading}
              aria-label="Run ticker search"
            >
              {loading ? "Loading" : "Search"}
            </button>
          </form>
          <div className="top-actions">
            <span className="market-open data-online"><i /> SEC data connected</span>
            <a
              className="primary-action top-link"
              href="https://www.sec.gov/search-filings"
              target="_blank"
              rel="noreferrer"
            >
              Open EDGAR
            </a>
          </div>
        </header>

        <div className="content">
          {loading && (
            <div className="loading-panel" role="status">
              <span className="loading-pulse" />
              Loading primary-source data for {ticker}...
            </div>
          )}

          {error && !loading && (
            <div className="error-panel" role="alert">
              <strong>We could not load {ticker}.</strong>
              <span>{error}</span>
              <button onClick={() => setTicker("BMNR")}>Return to BMNR</button>
            </div>
          )}

          {company && !loading && !error && (
            <>
              <div className="company-header">
                <div className="company-identity">
                  <div className="company-logo">{company.issuer.ticker.slice(0, 1)}</div>
                  <div>
                    <div className="eyebrow">
                      {company.issuer.exchange} / {company.issuer.industry}
                    </div>
                    <h1>
                      {company.issuer.name} <span>{company.issuer.ticker}</span>
                    </h1>
                    <p>
                      SEC reporting profile for CIK {company.issuer.cik}. Financial values below
                      are normalized from filed XBRL facts and may differ from company-defined
                      non-GAAP measures.
                    </p>
                  </div>
                </div>
                <div className="quote source-quote">
                  <span className={`data-badge ${company.market?.isStale ? "stale" : ""}`}>
                    {company.market
                      ? company.market.isStale
                        ? "STALE MARKET DATA"
                        : "DELAYED MARKET DATA"
                      : "PRICE UNAVAILABLE"}
                  </span>
                  {company.market ? (
                    <>
                      <div>
                        <strong>
                          {formatMarketPrice(company.market.price, company.market.currency)}
                        </strong>
                        {company.market.changePercent !== null && (
                          <span
                            className={
                              company.market.changePercent >= 0
                                ? "market-change positive"
                                : "market-change negative"
                            }
                          >
                            {formatPercent(company.market.changePercent, true)}
                          </span>
                        )}
                      </div>
                      <small>
                        <a
                          href={company.market.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {company.market.sourceLabel}
                        </a>
                        {" · "}
                        as of {new Date(company.market.marketTime).toLocaleString()}
                      </small>
                    </>
                  ) : (
                    <>
                      <strong>Market price unavailable</strong>
                      <small>No quote was returned; no value has been estimated.</small>
                    </>
                  )}
                  <button className={saved ? "saved" : ""} onClick={() => setSaved(!saved)}>
                    {saved ? "Watching" : "Add to watchlist"}
                  </button>
                </div>
              </div>

              <div className="signal-strip">
                <div className="signal-title">
                  <span className="signal-orb">SEC</span>
                  <div>
                    <strong>Latest annual comparison</strong>
                    <small>Deterministic calculation from filed facts</small>
                  </div>
                </div>
                <p>{latestComparison}</p>
                <a href={company.sources[2]?.url} target="_blank" rel="noreferrer">
                  Verify evidence <span>-&gt;</span>
                </a>
              </div>

              <div className="metric-grid">
                <article className="metric-card">
                  <span>Annual revenue</span>
                  <strong>{formatCurrency(company.metrics.revenue)}</strong>
                  <small>
                    FY {fiscalYear(company.metrics.latestFiscalPeriod) ?? "N/A"} /{" "}
                    {formatPercent(company.metrics.revenueGrowth, true)} YoY
                    {company.metrics.latestFiledAt
                      ? ` · filed ${new Date(
                          `${company.metrics.latestFiledAt}T00:00:00Z`,
                        ).toLocaleDateString()}`
                      : ""}
                  </small>
                </article>
                <article className="metric-card">
                  <span>Net income</span>
                  <strong>{formatCurrency(company.metrics.netIncome)}</strong>
                  <small>{formatPercent(company.metrics.netMargin)} net margin</small>
                </article>
                <article className="metric-card">
                  <span>Total assets</span>
                  <strong>{formatCurrency(company.metrics.assets)}</strong>
                  <small>{formatCurrency(company.metrics.cash)} cash reported</small>
                </article>
                <article className="metric-card">
                  <span>Diluted EPS</span>
                  <strong>
                    {company.metrics.dilutedEps === null
                      ? "Not reported"
                      : formatCurrency(company.metrics.dilutedEps, false)}
                  </strong>
                  <small>{formatNumber(company.metrics.sharesOutstanding)} shares outstanding</small>
                </article>
              </div>

              <div className="dashboard-grid">
                <article className="panel performance-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">Filed fundamentals</span>
                      <h2>Annual revenue history</h2>
                    </div>
                    <span className="model-tag">As reported / USD</span>
                  </div>
                  <div className="chart-legend">
                    <span><i className="legend-price" /> Revenue</span>
                    <span>Values normalized from 10-K facts</span>
                  </div>
                  <div className="bar-chart annual-chart" aria-label="Annual revenue history">
                    {bars.map((height, index) => (
                      <div className="bar-wrap labeled-bar" key={company.annuals[index]?.period}>
                        <span>{formatCurrency(company.annuals[index]?.revenue ?? null)}</span>
                        <div className="bar" style={{ height: `${height}%` }} />
                      </div>
                    ))}
                  </div>
                  <div className="chart-axis">
                    {company.annuals.map((point) => (
                      <span key={point.period}>{fiscalYear(point.period)}</span>
                    ))}
                  </div>
                </article>

                <article className="panel scenario-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">Transparent scenario</span>
                      <h2>Illustrative value framework</h2>
                    </div>
                  </div>
                  <div className="scenario-tabs">
                    {(["Bear", "Base", "Bull"] as const).map((item) => (
                      <button
                        className={scenario === item ? "active" : ""}
                        key={item}
                        onClick={() => setScenario(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  <div className="fair-value">
                    <span>{scenario} model output</span>
                    <strong>
                      {scenarioModel.value === null
                        ? "N/A"
                        : formatCurrency(scenarioModel.value, false)}
                    </strong>
                    <small>Illustrative, not a price target</small>
                  </div>
                  <div className="assumptions">
                    <div><span>Method</span><strong>{scenarioModel.method}</strong></div>
                    <div><span>Assumption</span><strong>{scenarioModel.assumption}</strong></div>
                    <div>
                      <span>Market comparison</span>
                      <strong>
                        {company.market
                          ? `${formatMarketPrice(
                              company.market.price,
                              company.market.currency,
                            )}${
                              scenarioModel.value === null
                                ? ""
                                : ` / ${formatPercent(
                                    (scenarioModel.value - company.market.price) /
                                      company.market.price,
                                    true,
                                  )} model gap`
                            }`
                          : "No delayed quote returned"}
                      </strong>
                    </div>
                  </div>
                </article>

                <article className="panel driver-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">Deterministic diagnostics</span>
                      <h2>Reported financial drivers</h2>
                    </div>
                    <span className="model-tag">Not an investment score</span>
                  </div>
                  <div className="drivers">
                    {drivers.map((driver) => (
                      <div className="driver" key={driver.label}>
                        <div>
                          <strong>{driver.label}</strong>
                          <span>{driver.detail}</span>
                        </div>
                        <div className="progress-track">
                          <i style={{ width: `${driver.value}%` }} />
                        </div>
                        <em>{driver.value}</em>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="panel thesis-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">Research checklist</span>
                      <h2>Evidence-based thesis conditions</h2>
                    </div>
                    <span className="method-note">Mechanical signals</span>
                  </div>
                  <div className="thesis-list">
                    {signals.map((item) => (
                      <div className="thesis-item" key={item.label}>
                        <StatusMark status={item.status} />
                        <div>
                          <strong>{item.label}</strong>
                          <p>{item.detail}</p>
                        </div>
                        <span className={`status-label ${item.status}`}>{item.status}</span>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="panel events-panel filings-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">Primary evidence</span>
                      <h2>Recent SEC filings</h2>
                    </div>
                    <a
                      className="text-button"
                      href={company.sources[2]?.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View all filings
                    </a>
                  </div>
                  <div className="events-list">
                    {company.filings.slice(0, 5).map((filing) => (
                      <a
                        className="event filing-link"
                        href={filing.url}
                        key={filing.accessionNumber}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <div className="event-date">{filing.filingDate.slice(5)}</div>
                        <div>
                          <span>{filing.form}</span>
                          <strong>
                            {filing.form === "8-K"
                              ? "Current report"
                              : filing.form.includes("10-Q")
                                ? "Quarterly report"
                                : filing.form.includes("10-K")
                                  ? "Annual report"
                                  : "Regulatory filing"}
                          </strong>
                        </div>
                        <em>Open source -&gt;</em>
                      </a>
                    ))}
                  </div>
                </article>
              </div>

              <footer className="source-footer">
                <div>
                  <strong>Source ledger</strong>
                  <span>{company.methodology}</span>
                </div>
                <div className="source-links">
                  {company.sources.map((source) => (
                    <a href={source.url} key={source.url} target="_blank" rel="noreferrer">
                      {source.label}
                    </a>
                  ))}
                </div>
                <p>
                  ThesisOS is research software, not an investment adviser. Verify all
                  information against original filings before making financial decisions.
                </p>
              </footer>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
