const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("check", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const response = await worker.fetch(
  new Request("https://thesisos.test/api/company?ticker=NVDA"),
  {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
  },
  {
    waitUntil() {},
    passThroughOnException() {},
  },
);

const payload = await response.json();

if (!response.ok) {
  throw new Error(`SEC smoke check failed: ${response.status} ${JSON.stringify(payload)}`);
}

if (
  payload?.issuer?.ticker !== "NVDA" ||
  !Array.isArray(payload?.annuals) ||
  payload.annuals.length < 2 ||
  !Array.isArray(payload?.filings)
) {
  throw new Error(`Unexpected SEC response shape: ${JSON.stringify(payload)}`);
}

console.log(
  JSON.stringify({
    ticker: payload.issuer.ticker,
    company: payload.issuer.name,
    annualPeriods: payload.annuals.length,
    recentFilings: payload.filings.length,
    fetchedAt: payload.fetchedAt,
  }),
);
