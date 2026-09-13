import { ComponentType } from "react";
import {
  Camera, GraduationCap, Laptop, Printer, Scissors, Shirt,
  ShoppingBag, Smartphone, Truck, Utensils,
} from "lucide-react-native";

export const GREEN = "#1a5c38";
export const GREEN_BRIGHT = "#2ECC71";
export const GREEN_TINT = "#EAF6EE";
export const BG = "#F5F7F5";

export const SUBSCRIPTION_FEE = 1000;
export const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const SUBSCRIPTION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

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
}

export const SERVICE_CATEGORIES: { key: string; icon: ComponentType<any>; label: string }[] = [
  { key: "all",            icon: ShoppingBag,   label: "All" },
  { key: "food",           icon: Utensils,      label: "Food" },
  { key: "laundry",        icon: Shirt,         label: "Laundry" },
  { key: "printing",       icon: Printer,       label: "Printing" },
  { key: "barber",         icon: Scissors,      label: "Barber" },
  { key: "phone_repair",   icon: Smartphone,    label: "Phone Repair" },
  { key: "laptop_repair",  icon: Laptop,        label: "Laptop Repair" },
  { key: "tutors",         icon: GraduationCap, label: "Tutors" },
  { key: "photography",    icon: Camera,        label: "Photography" },
  { key: "delivery",       icon: Truck,         label: "Delivery" },
];

export function daysLeft(expiresAt: number): number {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24)));
}

export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function normalizePhone(raw: string): string {
  const num = raw.replace(/\D/g, "");
  return num.startsWith("234") ? num : `234${num.replace(/^0/, "")}`;
}