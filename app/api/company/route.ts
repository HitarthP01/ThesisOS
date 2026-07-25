import { getCompanyResearch } from "../../../lib/sec";

export async function GET(request: Request) {
  const ticker = new URL(request.url).searchParams.get("ticker")?.trim() ?? "";

  if (!/^[A-Za-z0-9.-]{1,10}$/.test(ticker)) {
    return Response.json(
      { error: "Enter a valid US ticker symbol." },
      { status: 400 },
    );
  }

  try {
    const company = await getCompanyResearch(ticker);
    return Response.json(company, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load company data.";
    const status = message.includes("was not found") ? 404 : 502;
    return Response.json({ error: message }, { status });
  }
}
