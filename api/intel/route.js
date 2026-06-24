import { NextResponse } from 'next/server';

function getWikipediaTitle(name) {
  if (!name) return "";
  const clean = name.trim();
  const lower = clean.toLowerCase();

  if (lower.includes("iss") || lower.includes("space station")) return "International_Space_Station";
  if (lower.includes("starlink")) return "Starlink";
  if (lower.includes("noaa-19")) return "NOAA-19";
  if (lower.includes("hubble")) return "Hubble_Space_Telescope";
  if (lower === "mercury") return "Mercury_(planet)";
  if (lower === "venus") return "Venus";
  if (lower === "mars") return "Mars";
  if (lower === "jupiter") return "Jupiter";
  if (lower === "saturn") return "Saturn";
  if (lower === "uranus") return "Uranus";
  if (lower === "neptune") return "Neptune";
  if (lower === "moon") return "Moon";
  if (lower === "sun") return "Sun";

  return clean.replace(/\s+/g, "_");
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  if (!name) {
    return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 });
  }

  const title = getWikipediaTitle(name);
  const wikipediaUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

  try {
    const userAgent = "SpectroscopicObserver/1.0 (svpgsuma2304@gmail.com)";
    const response = await fetch(wikipediaUrl, {
      headers: { "User-Agent": userAgent }
    });

    if (!response.ok) {
      return NextResponse.json({
        content: `SPECTROSCOPIC SCAN FAILURE: Could not locate high-resolution planetary record for ${name} [HTTP ERROR ${response.status}].`,
        generationType: 'status_error'
      });
    }

    const data = await response.json();
    const summary = data.extract || `SPECTROSCOPIC INTEL: Live tracking orbital trajectory of ${name}. No written article summary available.`;

    return NextResponse.json({
      content: summary,
      generationType: 'ai'
    });
  } catch (error) {
    return NextResponse.json({
      content: `SPECTROSCOPIC INTERFERENCE: Signal degraded. Unable to establish connection with local Wikipedia directory. Error: ${error.message}`,
      generationType: 'status_error'
    });
  }
}
