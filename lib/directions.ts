// lib/directions.ts
// ─────────────────────────────────────────────────────────────────────────────
// Real Google Maps Directions API integration
// Replace YOUR_GOOGLE_MAPS_API_KEY with the same key you use for MapView
// ─────────────────────────────────────────────────────────────────────────────

export interface DirectionStep {
  instruction: string;
  distance: string;
  duration: string;
  distanceValue: number;   // metres  (needed for ETA calc)
  durationValue: number;   // seconds (needed for ETA calc)
  maneuver: string;
  startLocation: { lat: number; lng: number };
  endLocation:   { lat: number; lng: number };
}

export interface DirectionsResult {
  steps: DirectionStep[];
  totalDistance: string;
  totalDuration: string;
  totalDistanceValue: number;   // metres
  totalDurationValue: number;   // seconds
  polylinePoints: { latitude: number; longitude: number }[];
}

// ── Put your Google Maps API key here ────────────────────────────────────────
const GOOGLE_MAPS_API_KEY = "AIzaSyBY8H0wq60FRH1-mbC6Pj2opKI2libFkYs";

// ── Google's polyline decoder ─────────────────────────────────────────────────
function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dLng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
}

// ── Strip HTML tags from Google's instruction strings ─────────────────────────
function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&#39;/g,  "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g,    " ")
    .trim();
}

// ── Main fetchDirections — calls real Google Maps Directions API ──────────────
export async function fetchDirections(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  mode: "walking" | "driving" = "walking"
): Promise<DirectionsResult | null> {
  try {
    const url =
      `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${originLat},${originLng}` +
      `&destination=${destLat},${destLng}` +
      `&mode=${mode}` +
      `&overview=full` +       // ← full polyline, hugs roads exactly
      `&steps=true` +
      `&language=en` +
      `&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" || !data.routes?.length) {
    console.warn("Google Directions API status:", data.status);
    console.warn("Google Directions API error:", data.error_message);
    console.warn("Full response:", JSON.stringify(data));
    return null;
  }

    const route = data.routes[0];
    const leg   = route.legs[0];   // single origin→destination leg

    // ── Decode the overview polyline (full road-hugging path) ─────────────────
    const polylinePoints = decodePolyline(route.overview_polyline.encoded_polyline ?? route.overview_polyline.points);

    // ── Parse each turn-by-turn step ──────────────────────────────────────────
    const steps: DirectionStep[] = leg.steps.map((s: any) => ({
      instruction:   s.html_instructions ?? s.instructions ?? "Continue",
      distance:      s.distance?.text  ?? "",
      duration:      s.duration?.text  ?? "",
      distanceValue: s.distance?.value ?? 0,   // metres
      durationValue: s.duration?.value ?? 0,   // seconds
      maneuver:      s.maneuver ?? "straight",
      startLocation: {
        lat: s.start_location?.lat ?? s.startLocation?.lat ?? 0,
        lng: s.start_location?.lng ?? s.startLocation?.lng ?? 0,
      },
      endLocation: {
        lat: s.end_location?.lat ?? s.endLocation?.lat ?? 0,
        lng: s.end_location?.lng ?? s.endLocation?.lng ?? 0,
      },
    }));

    return {
      steps,
      totalDistance:      leg.distance?.text  ?? "",
      totalDuration:      leg.duration?.text  ?? "",
      totalDistanceValue: leg.distance?.value ?? 0,
      totalDurationValue: leg.duration?.value ?? 0,
      polylinePoints,
    };
  } catch (err) {
    console.log("Fetching directions:", { originLat, originLng, destLat, destLng, mode });
    console.error("fetchDirections error:", err);
    return null;
  }
}

// ── Maneuver icon helper (unchanged) ─────────────────────────────────────────
export function getManeuverIcon(maneuver: string): string {
  if (!maneuver) return "↑";
  if (maneuver.includes("turn-right"))  return "↱";
  if (maneuver.includes("turn-left"))   return "↰";
  if (maneuver.includes("sharp-right")) return "↱";
  if (maneuver.includes("sharp-left"))  return "↰";
  if (maneuver.includes("uturn"))       return "↩";
  if (maneuver.includes("roundabout"))  return "↻";
  if (maneuver.includes("arrive"))      return "🏁";
  if (maneuver.includes("merge"))       return "⤴";
  if (maneuver.includes("ramp"))        return "⤴";
  if (maneuver.includes("fork-right"))  return "↗";
  if (maneuver.includes("fork-left"))   return "↖";
  return "↑";
}