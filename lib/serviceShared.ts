import type { ComponentType } from "react";
import {
  Camera,
  GraduationCap,
  Laptop,
  Printer,
  Scissors,
  Shirt,
  ShoppingBag,
  Smartphone,
  Truck,
  Utensils,
} from "lucide-react-native";

// ─────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────

export const GREEN = "#1a5c38";
export const GREEN_BRIGHT = "#2ECC71";
export const GREEN_TINT = "#EAF6EE";
export const BG = "#F5F7F5";

// ─────────────────────────────────────────────
// SUBSCRIPTION
// ─────────────────────────────────────────────

export const SUBSCRIPTION_FEE = 1000;

export const TRIAL_DURATION_MS =
  30 * 24 * 60 * 60 * 1000;

export const SUBSCRIPTION_DURATION_MS =
  30 * 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────
// OPENING HOURS
// ─────────────────────────────────────────────

export interface DayHours {
  open: string;
  close: string;
}

export type Day =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

export type WeeklyHours = Partial<
  Record<Day, DayHours | "closed">
>;

// ─────────────────────────────────────────────
// SERVICE LISTING
// ─────────────────────────────────────────────

export interface ServiceListing {
  id: string;
  userId: string;

  providerName: string;
  name: string;
  category: string;
  description: string;

  phone: string;
  whatsapp: string;
  instagram: string;

  location: string;

  latitude?: number | null;
  longitude?: number | null;

  active: boolean;

  isTrial?: boolean;

  expiresAt: number;
  createdAt: number;

  rating?: number;
  ratingCount?: number;

  verified?: boolean;

  // Marketplace photos
  photos?: string[];

  // Price range
  priceMin?: number | null;
  priceMax?: number | null;

  // Opening hours
  hours?: WeeklyHours;

  // Marketplace tags
 tags?: string[];

  // Services this provider offers (separate from trait tags)
  servicesOffered?: string[];
}

// ─────────────────────────────────────────────
// SERVICE CATEGORY
// ─────────────────────────────────────────────

export interface ServiceCategory {
  key: string;
  icon: ComponentType<any>;
  label: string;
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    key: "all",
    icon: ShoppingBag,
    label: "All",
  },
  {
    key: "food",
    icon: Utensils,
    label: "Food",
  },
  {
    key: "laundry",
    icon: Shirt,
    label: "Laundry",
  },
  {
    key: "printing",
    icon: Printer,
    label: "Printing",
  },
  {
    key: "barber",
    icon: Scissors,
    label: "Barber",
  },
  {
    key: "phone_repair",
    icon: Smartphone,
    label: "Phone Repair",
  },
  {
    key: "laptop_repair",
    icon: Laptop,
    label: "Laptop Repair",
  },
  {
    key: "tutors",
    icon: GraduationCap,
    label: "Tutors",
  },
  {
    key: "photography",
    icon: Camera,
    label: "Photography",
  },
  {
    key: "delivery",
    icon: Truck,
    label: "Delivery",
  },
];

// ─────────────────────────────────────────────
// DAYS
// ─────────────────────────────────────────────

export const DAY_ORDER: Day[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

export const DAY_LABEL: Record<Day, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

// ─────────────────────────────────────────────
// DAYS LEFT
// ─────────────────────────────────────────────

export function daysLeft(expiresAt: number): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.max(
    0,
    Math.ceil(
      (expiresAt - Date.now()) / millisecondsPerDay
    )
  );
}

// ─────────────────────────────────────────────
// DISTANCE CALCULATION
// ─────────────────────────────────────────────

export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const lat1Radians =
    (lat1 * Math.PI) / 180;

  const lat2Radians =
    (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Radians) *
      Math.cos(lat2Radians) *
      Math.sin(dLon / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
}

// ─────────────────────────────────────────────
// FORMAT DISTANCE
// ─────────────────────────────────────────────

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) {
    return "0 m";
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(1)} km`;
}

// ─────────────────────────────────────────────
// NORMALIZE PHONE NUMBER
// ─────────────────────────────────────────────

export function normalizePhone(raw: string): string {
  const number = raw.replace(/\D/g, "");

  if (!number) {
    return "";
  }

  if (number.startsWith("234")) {
    return number;
  }

  if (number.startsWith("0")) {
    return `234${number.substring(1)}`;
  }

  return `234${number}`;
}

// ─────────────────────────────────────────────
// FORMAT WEEKLY HOURS
// ─────────────────────────────────────────────

export interface FormattedHours {
  label: string;
  value: string;
}

export function formatWeeklyHours(
  hours?: WeeklyHours
): FormattedHours[] {
  if (!hours) {
    return [];
  }

  const rows: FormattedHours[] = [];

  let i = 0;

  while (i < DAY_ORDER.length) {
    const day = DAY_ORDER[i];
    const entry = hours[day];

    if (!entry) {
      i++;
      continue;
    }

    const value =
      entry === "closed"
        ? "Closed"
        : `${entry.open} - ${entry.close}`;

    let j = i;

    while (j + 1 < DAY_ORDER.length) {
      const nextDay = DAY_ORDER[j + 1];
      const nextEntry = hours[nextDay];

      if (
        JSON.stringify(nextEntry) !==
        JSON.stringify(entry)
      ) {
        break;
      }

      j++;
    }

    const label =
      j > i
        ? `${DAY_LABEL[day]} - ${DAY_LABEL[DAY_ORDER[j]]}`
        : DAY_LABEL[day];

    rows.push({
      label,
      value,
    });

    i = j + 1;
  }

  return rows;
}

// ─────────────────────────────────────────────
// CHECK IF SERVICE IS OPEN
// ─────────────────────────────────────────────

export function isOpenNow(
  hours?: WeeklyHours
): boolean | null {
  if (!hours) {
    return null;
  }

  const now = new Date();

  // JavaScript:
  // Sunday = 0
  // Monday = 1
  // ...
  // Saturday = 6
  //
  // Convert to:
  // Monday = 0
  // ...
  // Sunday = 6

  const dayIndex =
    (now.getDay() + 6) % 7;

  const day = DAY_ORDER[dayIndex];

  const entry = hours[day];

  if (!entry || entry === "closed") {
    return false;
  }

  const currentMinutes =
    now.getHours() * 60 +
    now.getMinutes();

  const [openHour, openMinute] =
    entry.open.split(":").map(Number);

  const [closeHour, closeMinute] =
    entry.close.split(":").map(Number);

  const openingMinutes =
    openHour * 60 + openMinute;

  const closingMinutes =
    closeHour * 60 + closeMinute;

  return (
    currentMinutes >= openingMinutes &&
    currentMinutes <= closingMinutes
  );
}

// ─────────────────────────────────────────────
// FORMAT PRICE RANGE
// ─────────────────────────────────────────────

export function formatPriceRange(
  min?: number | null,
  max?: number | null
): string | null {
  if (min == null && max == null) {
    return null;
  }

  const formatPrice = (value: number): string => {
    return `₦${value.toLocaleString("en-NG")}`;
  };

  if (min != null && max != null) {
    if (min === max) {
      return formatPrice(min);
    }

    return `${formatPrice(min)} - ${formatPrice(max)}`;
  }

  if (min != null) {
    return `From ${formatPrice(min)}`;
  }

  if (max != null) {
    return `Up to ${formatPrice(max)}`;
  }

  return null;
}
