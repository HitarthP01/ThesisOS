const SEC_HEADERS = {
  Accept: "application/json",
  "Accept-Encoding": "gzip, deflate",
  "User-Agent":
    process.env.SEC_USER_AGENT ??
    "ThesisOS research portal contact@thesisos.dev",
};

type SecFact = {
  accn?: string;
  end?: string;
  filed?: string;
  form?: string;
  fp?: string;
  frame?: string;
  fy?: number;
  start?: string;
  val?: number;
};

type SecConcept = {
  label?: string;
  description?: string;
  units?: Record<string, SecFact[]>;
};

type CompanyFacts = {
  cik: number;
  entityName: string;
  facts?: Record<string, Record<string, SecConcept>>;
};

type Submissions = {
  cik: string;
  name: string;
  sic?: string;
  sicDescription?: string;
  fiscalYearEnd?: string;
  exchanges?: string[];
  tickers?: string[];
  filings?: {
    recent?: Record<string, Array<string | number | null>>;
  };
};

type TickerRecord = {
  cik_str: number;
  ticker: string;
  title: string;
};

export type AnnualPoint = {
  period: string;
  revenue: number | null;
  netIncome: number | null;
  operatingCashFlow: number | null;
  assets: number | null;
  equity: number | null;
  eps: number | null;
  filed: string | null;
};

export type CompanyResearch = {
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
  sources: Array<{
    label: string;
    url: string;
  }>;
  fetchedAt: string;
  methodology: string;
};

const CONCEPTS = {
  revenue: [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "SalesRevenueNet",
  ],
  netIncome: ["NetIncomeLoss", "ProfitLoss"],
  operatingCashFlow: ["NetCashProvidedByUsedInOperatingActivities"],
  assets: ["Assets"],
  equity: [
    "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
  ],
  cash: [
    "CashAndCashEquivalentsAtCarryingValue",
    "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
  ],
  eps: ["EarningsPerShareDiluted"],
  shares: ["EntityCommonStockSharesOutstanding", "CommonStockSharesOutstanding"],
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        chartPreviousClose?: number;
        currency?: string;
        exchangeName?: string;
        fullExchangeName?: string;
        instrumentType?: string;
        regularMarketPrice?: number;
        regularMarketTime?: number;
      };
    }>;
  };
};

async function fetchSecJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: SEC_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`SEC request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function fetchMarketSnapshot(ticker: string): Promise<CompanyResearch["market"]> {
  const marketTicker = ticker.replaceAll(".", "-");
  const sourceUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(marketTicker)}`;

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(marketTicker)}?range=5d&interval=1d`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "ThesisOS research portal contact@thesisos.dev",
        },
      },
    );

    if (!response.ok) return null;

    const payload = (await response.json()) as YahooChartResponse;
    const meta = payload.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const marketTime = meta?.regularMarketTime;

    if (
      meta?.instrumentType !== "EQUITY" ||
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      typeof marketTime !== "number"
    ) {
      return null;
    }

    const previousClose =
      typeof meta.chartPreviousClose === "number" &&
      Number.isFinite(meta.chartPreviousClose)
        ? meta.chartPreviousClose
        : null;
    const change = previousClose === null ? null : price - previousClose;
    const changePercent =
      previousClose === null || previousClose === 0
        ? null
        : change! / Math.abs(previousClose);
    const marketDate = new Date(marketTime * 1_000);
    const ageHours = (Date.now() - marketDate.getTime()) / 3_600_000;

    return {
      price,
      currency: meta.currency ?? "USD",
      previousClose,
      change,
      changePercent,
      marketTime: marketDate.toISOString(),
      exchange: meta.fullExchangeName ?? meta.exchangeName ?? "US market",
      sourceLabel: "Yahoo Finance delayed quote",
      sourceUrl,
      isStale: ageHours > 96,
    };
  } catch {
    return null;
  }
}

function daysBetween(start?: string, end?: string) {
  if (!start || !end) return null;
  return Math.round(
    (new Date(`${end}T00:00:00Z`).getTime() -
      new Date(`${start}T00:00:00Z`).getTime()) /
      86_400_000,
  );
}

function getConcept(
  facts: CompanyFacts,
  candidates: string[],
): SecConcept | null {
  for (const taxonomy of ["us-gaap", "ifrs-full", "dei"]) {
    const collection = facts.facts?.[taxonomy];
    if (!collection) continue;
    for (const candidate of candidates) {
      if (collection[candidate]) return collection[candidate];
    }
  }
  return null;
}

function factsForUnit(
  concept: SecConcept | null,
  preferredUnits: string[],
): SecFact[] {
  if (!concept?.units) return [];
  for (const unit of preferredUnits) {
    if (concept.units[unit]) return concept.units[unit];
  }
  return Object.values(concept.units)[0] ?? [];
}

function dedupeByPeriod(facts: SecFact[]) {
  const byEnd = new Map<string, SecFact>();
  for (const fact of facts) {
    if (!fact.end || typeof fact.val !== "number") continue;
    const existing = byEnd.get(fact.end);
    if (!existing || (fact.filed ?? "") > (existing.filed ?? "")) {
      byEnd.set(fact.end, fact);
    }
  }
  return [...byEnd.values()].sort((a, b) =>
    (a.end ?? "").localeCompare(b.end ?? ""),
  );
}

function annualDurationFacts(
  facts: CompanyFacts,
  concepts: string[],
  units: string[],
) {
  const entries = factsForUnit(getConcept(facts, concepts), units).filter(
    (fact) => {
      const duration = daysBetween(fact.start, fact.end);
      return (
        ["10-K", "10-K/A", "20-F", "20-F/A", "40-F"].includes(
          fact.form ?? "",
        ) &&
        duration !== null &&
        duration >= 300 &&
        duration <= 430
      );
    },
  );
  return dedupeByPeriod(entries);
}

function annualInstantFacts(
  facts: CompanyFacts,
  concepts: string[],
  units: string[],
) {
  const entries = factsForUnit(getConcept(facts, concepts), units).filter(
    (fact) =>
      ["10-K", "10-K/A", "20-F", "20-F/A", "40-F"].includes(
        fact.form ?? "",
      ) && !fact.start,
  );
  return dedupeByPeriod(entries);
}

function latestInstantFact(
  facts: CompanyFacts,
  concepts: string[],
  units: string[],
) {
  const entries = factsForUnit(getConcept(facts, concepts), units).filter(
    (fact) =>
      typeof fact.val === "number" &&
      Boolean(fact.end) &&
      ["10-K", "10-K/A", "10-Q", "10-Q/A", "20-F", "40-F"].includes(
        fact.form ?? "",
      ),
  );
  return dedupeByPeriod(entries).at(-1) ?? null;
}

function valueForPeriod(entries: SecFact[], period: string) {
  return entries.find((entry) => entry.end === period)?.val ?? null;
}

function filedForPeriod(entries: SecFact[], period: string) {
  return entries.find((entry) => entry.end === period)?.filed ?? null;
}

function percentChange(current: number | null, previous: number | null) {
  if (
    current === null ||
    previous === null ||
    previous === 0 ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous)
  ) {
    return null;
  }
  return (current - previous) / Math.abs(previous);
}

function safeRatio(numerator: number | null, denominator: number | null) {
  if (
    numerator === null ||
    denominator === null ||
    denominator === 0 ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator)
  ) {
    return null;
  }
  return numerator / denominator;
}

function buildAnnuals(facts: CompanyFacts): AnnualPoint[] {
  const revenue = annualDurationFacts(facts, CONCEPTS.revenue, ["USD"]);
  const netIncome = annualDurationFacts(facts, CONCEPTS.netIncome, ["USD"]);
  const operatingCashFlow = annualDurationFacts(
    facts,
    CONCEPTS.operatingCashFlow,
    ["USD"],
  );
  const assets = annualInstantFacts(facts, CONCEPTS.assets, ["USD"]);
  const equity = annualInstantFacts(facts, CONCEPTS.equity, ["USD"]);
  const eps = annualDurationFacts(facts, CONCEPTS.eps, [
    "USD/shares",
    "USD / shares",
  ]);

  const periods = [
    ...new Set([
      ...revenue.map((fact) => fact.end),
      ...netIncome.map((fact) => fact.end),
    ]),
  ]
    .filter((period): period is string => Boolean(period))
    .sort()
    .slice(-6);

  return periods.map((period) => ({
    period,
    revenue: valueForPeriod(revenue, period),
    netIncome: valueForPeriod(netIncome, period),
    operatingCashFlow: valueForPeriod(operatingCashFlow, period),
    assets: valueForPeriod(assets, period),
    equity: valueForPeriod(equity, period),
    eps: valueForPeriod(eps, period),
    filed:
      filedForPeriod(revenue, period) ??
      filedForPeriod(netIncome, period) ??
      null,
  }));
}

function buildFilings(submissions: Submissions, cik: string) {
  const recent = submissions.filings?.recent;
  if (!recent) return [];

  const forms = (recent.form ?? []) as string[];
  const accessions = (recent.accessionNumber ?? []) as string[];
  const filingDates = (recent.filingDate ?? []) as string[];
  const reportDates = (recent.reportDate ?? []) as string[];
  const primaryDocuments = (recent.primaryDocument ?? []) as string[];
  const cikWithoutLeadingZeros = String(Number(cik));

  return forms
    .map((form, index) => ({
      accessionNumber: accessions[index] ?? "",
      filingDate: filingDates[index] ?? "",
      form,
      primaryDocument: primaryDocuments[index] ?? "",
      reportDate: reportDates[index] ?? "",
    }))
    .filter(
      (filing) =>
        ["10-K", "10-Q", "8-K", "20-F", "40-F", "6-K"].includes(
          filing.form,
        ) &&
        filing.accessionNumber &&
        filing.primaryDocument,
    )
    .slice(0, 8)
    .map((filing) => ({
      ...filing,
      url: `https://www.sec.gov/Archives/edgar/data/${cikWithoutLeadingZeros}/${filing.accessionNumber.replaceAll("-", "")}/${filing.primaryDocument}`,
    }));
}

export async function getCompanyResearch(
  requestedTicker: string,
): Promise<CompanyResearch> {
  const ticker = requestedTicker.trim().toUpperCase();
  const tickerMap = await fetchSecJson<Record<string, TickerRecord>>(
    "https://www.sec.gov/files/company_tickers.json",
  );
  const security = Object.values(tickerMap).find(
    (record) => record.ticker.toUpperCase() === ticker,
  );

  if (!security) {
    throw new Error(`Ticker ${ticker} was not found in the SEC company list`);
  }

  const cik = String(security.cik_str).padStart(10, "0");
  const [facts, submissions, market] = await Promise.all([
    fetchSecJson<CompanyFacts>(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
    ),
    fetchSecJson<Submissions>(
      `https://data.sec.gov/submissions/CIK${cik}.json`,
    ),
    fetchMarketSnapshot(ticker),
  ]);

  const annuals = buildAnnuals(facts);
  const latest = annuals.at(-1) ?? null;
  const previous = annuals.at(-2) ?? null;
  const cashFact = latestInstantFact(facts, CONCEPTS.cash, ["USD"]);
  const sharesFact = latestInstantFact(facts, CONCEPTS.shares, ["shares"]);
  const assetsFact = latestInstantFact(facts, CONCEPTS.assets, ["USD"]);
  const equityFact = latestInstantFact(facts, CONCEPTS.equity, ["USD"]);
  const assets = latest?.assets ?? assetsFact?.val ?? null;
  const equity = latest?.equity ?? equityFact?.val ?? null;
  const sharesOutstanding = sharesFact?.val ?? null;
  const netMargin = safeRatio(latest?.netIncome ?? null, latest?.revenue ?? null);
  const previousMargin = safeRatio(
    previous?.netIncome ?? null,
    previous?.revenue ?? null,
  );

  return {
    issuer: {
      cik,
      ticker,
      name: submissions.name || facts.entityName || security.title,
      exchange: submissions.exchanges?.[0] ?? "US listed",
      industry: submissions.sicDescription ?? "SEC reporting issuer",
      sic: submissions.sic ?? null,
      fiscalYearEnd: submissions.fiscalYearEnd ?? null,
    },
    annuals,
    metrics: {
      latestFiscalPeriod: latest?.period ?? null,
      latestFiledAt: latest?.filed ?? null,
      revenue: latest?.revenue ?? null,
      revenueGrowth: percentChange(
        latest?.revenue ?? null,
        previous?.revenue ?? null,
      ),
      netIncome: latest?.netIncome ?? null,
      netMargin,
      marginChange:
        netMargin !== null && previousMargin !== null
          ? netMargin - previousMargin
          : null,
      assets,
      equity,
      cash: cashFact?.val ?? null,
      operatingCashFlow: latest?.operatingCashFlow ?? null,
      sharesOutstanding,
      dilutedEps: latest?.eps ?? null,
      bookValuePerShare: safeRatio(equity, sharesOutstanding),
      cashToAssets: safeRatio(cashFact?.val ?? null, assets),
    },
    market,
    filings: buildFilings(submissions, cik),
    sources: [
      {
        label: "SEC company submissions",
        url: `https://data.sec.gov/submissions/CIK${cik}.json`,
      },
      {
        label: "SEC XBRL company facts",
        url: `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
      },
      {
        label: "EDGAR company page",
        url: `https://www.sec.gov/edgar/browse/?CIK=${Number(cik)}&owner=exclude`,
      },
      ...(market
        ? [
            {
              label: market.sourceLabel,
              url: market.sourceUrl,
            },
          ]
        : []),
    ],
    fetchedAt: new Date().toISOString(),
    methodology:
      "Annual values are normalized from company-level SEC XBRL facts. Market quotes are delayed, separately sourced, and timestamped. Thesis signals and scenario values are deterministic calculations, not investment recommendations.",
  };
}
