"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useRef } from "react";

import type { CustomerTrackingSnapshot } from "@/lib/api/types";

let loaderConfigured = false;

export function LiveBusMap({
  position,
  destination,
  label,
  destinationLabel,
  onFailure,
}: {
  position: NonNullable<CustomerTrackingSnapshot["position"]>;
  destination: CustomerTrackingSnapshot["destination"];
  label: string;
  destinationLabel: string;
  onFailure: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const busMarker = useRef<google.maps.Marker | null>(null);
  const destinationMarker = useRef<google.maps.Marker | null>(null);
  const previous = useRef({ lat: position.latitude, lng: position.longitude });
  const initialPosition = useRef(position);
  const initialDestination = useRef(destination);
  const animation = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
    if (!key || !container.current) {
      onFailure();
      return;
    }
    if (!loaderConfigured) {
      setOptions({ key, v: "weekly", region: "QA", authReferrerPolicy: "origin" });
      loaderConfigured = true;
    }

    Promise.all([importLibrary("maps")])
      .then(() => {
        if (cancelled || !container.current) return;
        const firstPosition = initialPosition.current;
        const firstDestination = initialDestination.current;
        const center = { lat: firstPosition.latitude, lng: firstPosition.longitude };
        map.current = new google.maps.Map(container.current, {
          center,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "cooperative",
          clickableIcons: false,
        });
        busMarker.current = new google.maps.Marker({
          map: map.current,
          position: center,
          title: label,
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            fillColor: "#00ccff",
            fillOpacity: 1,
            scale: 7,
            strokeColor: "#262262",
            strokeWeight: 2,
            rotation: firstPosition.heading ?? 0,
          },
        });
        if (firstDestination) {
          destinationMarker.current = new google.maps.Marker({
            map: map.current,
            position: { lat: firstDestination.latitude, lng: firstDestination.longitude },
            title: destinationLabel,
          });
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(center);
          bounds.extend({ lat: firstDestination.latitude, lng: firstDestination.longitude });
          map.current.fitBounds(bounds, 56);
        }
      })
      .catch(onFailure);

    return () => {
      cancelled = true;
      if (animation.current !== null) cancelAnimationFrame(animation.current);
      busMarker.current?.setMap(null);
      destinationMarker.current?.setMap(null);
      map.current = null;
    };
  }, [destinationLabel, label, onFailure]);

  useEffect(() => {
    if (!busMarker.current) return;
    const target = { lat: position.latitude, lng: position.longitude };
    const start = previous.current;
    previous.current = target;
    map.current?.panTo(target);
    busMarker.current.setIcon({
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      fillColor: "#00ccff",
      fillOpacity: 1,
      scale: 7,
      strokeColor: "#262262",
      strokeWeight: 2,
      rotation: position.heading ?? 0,
    });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      busMarker.current.setPosition(target);
      return;
    }
    const startedAt = performance.now();
    const duration = 5_000;
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      busMarker.current?.setPosition({
        lat: start.lat + (target.lat - start.lat) * eased,
        lng: start.lng + (target.lng - start.lng) * eased,
      });
      if (progress < 1) animation.current = requestAnimationFrame(step);
    };
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    animation.current = requestAnimationFrame(step);
  }, [position.heading, position.latitude, position.longitude]);

  return (
    <div
      ref={container}
      role="img"
      aria-label={label}
      data-sentry-block
      className="h-full min-h-72 w-full rounded-[calc(var(--radius-card)-2px)] bg-slate-100 sm:min-h-96"
    />
  );
}
