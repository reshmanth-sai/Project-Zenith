import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  
  if (!lat || !lng) {
    return NextResponse.json({ error: 'Missing lat or lng' }, { status: 400 });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  let cloudCover = 0;
  let provider = 'none';

  if (apiKey && apiKey !== 'MY_OPENWEATHER_API_KEY') {
    try {
      const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}`);
      if (response.ok) {
        const data = await response.json();
        cloudCover = data.clouds ? data.clouds.all : 0;
        provider = 'openweathermap';
      } else {
        // Fallback to open-meteo
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=cloud_cover`);
        if (res.ok) {
          const data = await res.json();
          cloudCover = data.current ? data.current.cloud_cover : 0;
          provider = 'open-meteo';
        }
      }
    } catch (e) {
      // Fallback to open-meteo
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=cloud_cover`);
        if (res.ok) {
          const data = await res.json();
          cloudCover = data.current ? data.current.cloud_cover : 0;
          provider = 'open-meteo';
        }
      } catch (innerErr) {}
    }
  } else {
    // If no API key, try using open-meteo directly so the user gets real live weather in development!
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=cloud_cover`);
      if (res.ok) {
        const data = await res.json();
        cloudCover = data.current ? data.current.cloud_cover : 0;
        provider = 'open-meteo';
      }
    } catch (e) {}
  }

  return NextResponse.json({ cloudCover, provider });
}
