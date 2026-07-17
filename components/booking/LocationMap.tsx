"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useI18n } from "@/lib/i18n";

export type LatLng = { lat: number; lng: number };

interface Props {
  /** Current pinned coordinate, or null when nothing is pinned yet. */
  value: LatLng | null;
  /** Fired whenever the user drops, drags, or clicks a new pin position. */
  onChange: (v: LatLng) => void;
  className?: string;
}

// Doha, Qatar — sensible default centre before the user pins anything.
const DEFAULT_CENTER: LatLng = { lat: 25.2854, lng: 51.531 };

// Brand-navy teardrop pin as an inline SVG so we don't depend on Leaflet's
// bundled marker images (which 404 under most bundlers).
const PIN_HTML = `
<svg viewBox="0 0 40 40" width="40" height="40" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">
  <path d="M20 2c-7.2 0-13 5.6-13 12.6C7 24 20 38 20 38s13-14 13-23.4C33 7.6 27.2 2 20 2Z" fill="#171a4a"/>
  <circle cx="20" cy="14.6" r="4.6" fill="#ffffff"/>
</svg>`;

const EPS = 1e-6;
function near(a: LatLng, b: LatLng): boolean {
  return Math.abs(a.lat - b.lat) < EPS && Math.abs(a.lng - b.lng) < EPS;
}

export default function LocationMap({ value, onChange, className }: Props) {
  const { t } = useI18n();
  const [latitude, setLatitude] = useState(() => String(value?.lat ?? DEFAULT_CENTER.lat));
  const [longitude, setLongitude] = useState(() => String(value?.lng ?? DEFAULT_CENTER.lng));
  const [coordinateError, setCoordinateError] = useState(false);
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  // Latest onChange without forcing the init effect to re-run.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  // Coordinate we last emitted ourselves, so the sync-effect can skip echoes.
  const emittedRef = useRef<LatLng | null>(null);

  // Initialise the map exactly once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !elRef.current || mapRef.current) return;

      const start = value ?? DEFAULT_CENTER;
      const map = L.map(elRef.current, {
        center: [start.lat, start.lng],
        zoom: value ? 16 : 11,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      const icon = L.divIcon({
        className: "bubbleit-pin",
        html: PIN_HTML,
        iconSize: [40, 40],
        iconAnchor: [20, 38],
      });
      const marker = L.marker([start.lat, start.lng], {
        draggable: true,
        icon,
      }).addTo(map);

      const emit = (lat: number, lng: number) => {
        const c = { lat, lng };
        emittedRef.current = c;
        onChangeRef.current(c);
      };
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        emit(p.lat, p.lng);
      });
      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        emit(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;
      // The container is often 0-height on first paint (inside a step panel).
      setTimeout(() => map.invalidateSize(), 0);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter when `value` changes from the outside (e.g. "Use my exact
  // location"). Skip changes we emitted ourselves to avoid a jump after drag.
  useEffect(() => {
    if (!value || !mapRef.current || !markerRef.current) return;
    if (emittedRef.current && near(emittedRef.current, value)) return;
    markerRef.current.setLatLng([value.lat, value.lng]);
    mapRef.current.setView(
      [value.lat, value.lng],
      Math.max(mapRef.current.getZoom(), 16),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  function applyCoordinates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setCoordinateError(true);
      return;
    }
    setCoordinateError(false);
    const coordinates = { lat, lng };
    emittedRef.current = null;
    onChange(coordinates);
    markerRef.current?.setLatLng([lat, lng]);
    mapRef.current?.setView([lat, lng], Math.max(mapRef.current.getZoom(), 16));
  }

  return (
    <div className="space-y-3">
      <div
        ref={elRef}
        className={className}
        style={{ height: 260, width: "100%", borderRadius: 16, overflow: "hidden", zIndex: 0 }}
        role="region"
        aria-label={t("Map — drag the pin to your exact location")}
      />
      <details
        className="rounded-2xl border border-[color:var(--border)] bg-white p-3"
        onToggle={(event) => {
          if (!event.currentTarget.open || !value) return;
          setLatitude(value.lat.toFixed(6));
          setLongitude(value.lng.toFixed(6));
        }}
      >
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-[color:var(--navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue)]">
          {t("Enter coordinates without using the map")}
        </summary>
        <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={applyCoordinates}>
          <label className="text-sm font-semibold text-[color:var(--foreground)]">
            {t("Latitude")}
            <input
              className="wizard-input mt-1"
              inputMode="decimal"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
            />
          </label>
          <label className="text-sm font-semibold text-[color:var(--foreground)]">
            {t("Longitude")}
            <input
              className="wizard-input mt-1"
              inputMode="decimal"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
            />
          </label>
          {coordinateError && (
            <p className="text-sm font-semibold text-red-700 sm:col-span-2" role="alert">
              {t("Enter valid latitude and longitude values.")}
            </p>
          )}
          <button type="submit" className="secondary-button sm:col-span-2">
            {t("Apply coordinates")}
          </button>
        </form>
        {value && (
          <p className="mt-3 text-xs text-[color:var(--muted-foreground)]" aria-live="polite">
            {t("Selected coordinates")}: <bdi dir="ltr">{value.lat.toFixed(6)}, {value.lng.toFixed(6)}</bdi>
          </p>
        )}
      </details>
    </div>
  );
}
