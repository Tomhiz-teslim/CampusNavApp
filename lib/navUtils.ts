export function hasPassedWaypoint(
  pos: { latitude: number; longitude: number },
  waypointLat: number,
  waypointLng: number,
  nextLat: number,
  nextLng: number,
  currentSpeed: number = 0,
): boolean {
  const INNER_RADIUS_M = currentSpeed < 1.5 ? 5.0 : 12.0;
  const distToWaypoint = haversineMetres(
    pos.latitude,
    pos.longitude,
    waypointLat,
    waypointLng,
  );
  if (distToWaypoint < INNER_RADIUS_M) return true;

  const forwardX = nextLng - waypointLng;
  const forwardY = nextLat - waypointLat;
  const forwardMagSq = forwardX * forwardX + forwardY * forwardY;

  const MICRO_STEP_DEG_SQ = (2 / 111000) * (2 / 111000);
  if (forwardMagSq < MICRO_STEP_DEG_SQ) return false;

  const toUserX = pos.longitude - waypointLng;
  const toUserY = pos.latitude - waypointLat;
  const dotProduct = forwardX * toUserX + forwardY * toUserY;

  if (dotProduct <= 0) return false;

  if (currentSpeed < 1.5) {
    const forwardMag = Math.sqrt(forwardMagSq);
    const crossProduct = Math.abs(forwardX * toUserY - forwardY * toUserX);
    const lateralDistDeg = crossProduct / forwardMag;
    const lateralDistM = lateralDistDeg * 111000;
    if (lateralDistM < 6.0 && dotProduct > 0) return true;
  }

  return dotProduct > 0;
}

export function snapToRoute(
  pos: { latitude: number; longitude: number },
  polyline: { latitude: number; longitude: number }[],
  currentHeading: number,
  currentSpeed: number = 0,
): { latitude: number; longitude: number } | null {
  if (!polyline.length) return null;

   const SNAP_RADIUS_M = currentSpeed < 1.5 ? 12 : 20; 
  const headingPenaltyFactor = Math.min(currentSpeed / 5.0, 1.0);
  const BBOX = (SNAP_RADIUS_M / 111000) * 2.5;

  const nearbyIndices: number[] = [];
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const minLat = Math.min(a.latitude, b.latitude) - BBOX;
    const maxLat = Math.max(a.latitude, b.latitude) + BBOX;
    const minLng = Math.min(a.longitude, b.longitude) - BBOX;
    const maxLng = Math.max(a.longitude, b.longitude) + BBOX;
    if (
      pos.latitude >= minLat &&
      pos.latitude <= maxLat &&
      pos.longitude >= minLng &&
      pos.longitude <= maxLng
    ) {
      nearbyIndices.push(i);
    }
  }
  const indices =
    nearbyIndices.length > 0
      ? nearbyIndices
      : Array.from({ length: polyline.length - 1 }, (_, i) => i);

  let bestSnap = pos;
  let bestScore = Infinity;

  for (const i of indices) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const dx = b.longitude - a.longitude;
    const dy = b.latitude - a.latitude;
    const lenSq = dx * dx + dy * dy;

    let t =
      lenSq === 0
        ? 0
        : ((pos.longitude - a.longitude) * dx +
            (pos.latitude - a.latitude) * dy) /
          lenSq;
    t = Math.max(0, Math.min(1, t));

    const snapped = {
      latitude: a.latitude + t * dy,
      longitude: a.longitude + t * dx,
    };

    const dist = haversineMetres(
      pos.latitude,
      pos.longitude,
      snapped.latitude,
      snapped.longitude,
    );

    if (dist > SNAP_RADIUS_M) continue;

    const segHeading = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;
    const rawDiff = Math.abs(((currentHeading - segHeading + 540) % 360) - 180);

    const isReversed = rawDiff > 150;
    if (isReversed && currentSpeed > 2.0) continue;

    const headingPenalty = rawDiff * headingPenaltyFactor * 0.4;
    const score = dist + headingPenalty;

    if (score < bestScore) {
      bestScore = score;
      bestSnap = snapped;
    }
  }

 if (bestSnap === pos) return null;
  return bestSnap;
}

export interface KalmanState {
  lat: number;
  lng: number;
  variance: number;
}

export function kalmanFilter(
  newLat: number,
  newLng: number,
  accuracy: number,
  speed: number,
  state: KalmanState | null,
): KalmanState {
  // CHANGE 2: Raised minimum Q from 0.5 → 3.0.
  // Old value (0.5) treated any movement under 0.3 m/s as pure noise,
  // so the filter would suppress legitimate slow walking. 3.0 lets the
  // filter track real movement even when the GPS reports near-zero speed.
  let Q: number;
  if (speed < 0.3) {
    Q = 3.0;                                      // was 0.5
  } else if (speed < 2.0) {
    Q = 3.0 + ((speed - 0.3) / 1.7) * 5.0;      // was 0.5 + … * 3.5
  } else {
    Q = Math.min(8.0 + (speed - 2.0) * 3.0, 25.0); // was 4.0 + … , cap 20
  }

  const clampedAccuracy = Math.max(accuracy, 2.0);
  const R = clampedAccuracy * clampedAccuracy;

  if (!state) {
    return { lat: newLat, lng: newLng, variance: R };
  }

  const predictedVariance = state.variance + Q;
  const gain = predictedVariance / (predictedVariance + R);

  const rawDist = haversineMetres(state.lat, state.lng, newLat, newLng);

  // CHANGE 1: Old threshold was max(speed*3, 40m) which froze the marker
  // on any GPS jump > 40 m — a very common occurrence on real devices while
  // walking. New threshold is 150 m (truly implausible for a pedestrian).
  // For jumps between 40-150 m we now do a soft blend (75% new position)
  // rather than hard-freezing, so the marker always moves toward truth.
  const HARD_FREEZE_M = 150.0;                    // was max(speed*3, 40)
  if (rawDist > HARD_FREEZE_M && state.variance < 200) {
    // Truly implausible jump — freeze and widen variance to recover quickly
    return {
      lat: state.lat,
      lng: state.lng,
      variance: Math.min(predictedVariance * 1.5, 400),
    };
  }

  // Soft blend for medium-sized GPS jumps (common on real devices)
  const softBlendGain = rawDist > 40 ? Math.max(gain, 0.75) : gain;

  return {
    lat: state.lat + softBlendGain * (newLat - state.lat),
    lng: state.lng + softBlendGain * (newLng - state.lng),
    variance: (1 - softBlendGain) * predictedVariance,
  };
}

// ── Haversine ─────────────────────────────────────────────────────────────────
export function haversineMetres(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function distanceToPolylineMetres(
  pos: { latitude: number; longitude: number },
  polyline: { latitude: number; longitude: number }[],
): number {
  if (!polyline.length) return Infinity;
  let minDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = pointToSegmentDist(pos, polyline[i], polyline[i + 1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

export function pointToSegmentDist(
  p: { latitude: number; longitude: number },
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dx = b.longitude - a.longitude;
  const dy = b.latitude - a.latitude;
  const lenSq = dx * dx + dy * dy;
  let t =
    lenSq === 0
      ? 0
      : ((p.longitude - a.longitude) * dx + (p.latitude - a.latitude) * dy) /
        lenSq;
  t = Math.max(0, Math.min(1, t));
  return haversineMetres(
    p.latitude,
    p.longitude,
    a.latitude + t * dy,
    a.longitude + t * dx,
  );
}
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

// ── Strip HTML from instruction strings ───────────────────────────────────────
export function humanizeInstruction(instruction: string): string {
  return stripHtml(instruction)
    .replace(/\bN\b/g, "north")
    .replace(/\bS\b/g, "south")
    .replace(/\bE\b/g, "east")
    .replace(/\bW\b/g, "west")
    .replace(/\bNE\b/gi, "right")
    .replace(/\bNW\b/gi, "left")
    .replace(/\bSE\b/gi, "right")
    .replace(/\bSW\b/gi, "left")
    .replace(/\bnorth\b/gi, "straight")
    .replace(/\bsouth\b/gi, "straight")
    .replace(/\beast\b/gi, "right")
    .replace(/\bwest\b/gi, "left")
    .replace(/\bonto\b/gi, "onto")
    .trim();
}
// ── Maneuver arrow ────────────────────────────────────────────────────────────
export function getDirectionLabel(maneuver: string): string {
  if (!maneuver) return "↑";
  if (maneuver.includes("turn-right")) return "→";
  if (maneuver.includes("turn-left")) return "←";
  if (maneuver.includes("sharp-right")) return "↱";
  if (maneuver.includes("sharp-left")) return "↰";
  if (maneuver.includes("uturn")) return "↩";
  if (maneuver.includes("roundabout")) return "↻";
  if (maneuver.includes("merge")) return "↑";
  if (maneuver.includes("ramp-right")) return "→";
  if (maneuver.includes("ramp-left")) return "←";
  if (maneuver.includes("fork-right")) return "→";
  if (maneuver.includes("fork-left")) return "←";
  return "↑";
}