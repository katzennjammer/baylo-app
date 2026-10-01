import * as Location from "expo-location";
import { useEffect, useState } from "react";

import type { SafeZoneHub } from "../api/types";

/** Great-circle distance from a point to a hub, in km. */
export function distanceKm(latitude: number, longitude: number, hub: SafeZoneHub): number {
  const earthRadiusKm = 6371;
  const latDelta = ((hub.latitude - latitude) * Math.PI) / 180;
  const lngDelta = ((hub.longitude - longitude) * Math.PI) / 180;
  const originLatitude = (latitude * Math.PI) / 180;
  const hubLatitude = (hub.latitude * Math.PI) / 180;
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.sin(lngDelta / 2) ** 2 * Math.cos(originLatitude) * Math.cos(hubLatitude);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** `1.2 km`, `14 km`, or `Nearby` under 100 m. */
export function formatDistanceKm(km: number): string {
  if (km < 0.1) return "Nearby";
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/**
 * The phone's last known position — PASSIVE: only when location permission is
 * already granted, only a fix from the last 15 minutes within 2 km, never a
 * prompt and never a wait on a fresh fix. Null otherwise, and the caller is
 * expected to be complete without it. The marketplace map owns the full
 * lookup (and its permission prompt).
 */
export function useLastKnownLocation(): { latitude: number; longitude: number } | null {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) return;
        const last = await Location.getLastKnownPositionAsync({ maxAge: 15 * 60 * 1000, requiredAccuracy: 2000 });
        if (last && !cancelled) setLocation({ latitude: last.coords.latitude, longitude: last.coords.longitude });
      } catch {
        // No position. Nothing that reads this needs one.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return location;
}
