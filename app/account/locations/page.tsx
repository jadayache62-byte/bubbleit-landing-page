"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import clsx from "clsx";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { AuthPanel } from "@/components/booking/AuthPanel";
import {
  ApiError,
  createAddress,
  deleteAddress,
  listAddresses,
  me,
  updateAddress,
} from "@/lib/api/client";
import type { Address, Customer } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";

const LocationMap = dynamic(() => import("@/components/booking/LocationMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[260px] w-full place-items-center rounded-2xl bg-slate-100 text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

type LocationForm = {
  id: number | null;
  label: string;
  area: string;
  details: string;
  building_number: string;
  zone_number: string;
  street_number: string;
  latitude: number | null;
  longitude: number | null;
};

const emptyForm: LocationForm = {
  id: null,
  label: "Home",
  area: "",
  details: "",
  building_number: "",
  zone_number: "",
  street_number: "",
  latitude: null,
  longitude: null,
};

function formFromAddress(address: Address): LocationForm {
  return {
    id: address.id,
    label: address.label || "Home",
    area: address.area || "",
    details: address.details || "",
    building_number: address.building_number ?? "",
    zone_number: address.zone_number ?? "",
    street_number: address.street_number ?? "",
    latitude: address.latitude,
    longitude: address.longitude,
  };
}

export default function AccountLocationsPage() {
  const { t } = useI18n();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [checked, setChecked] = useState(false);
  const [locations, setLocations] = useState<Address[] | null>(null);
  const [form, setForm] = useState<LocationForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const geo = useMemo(
    () =>
      typeof form.latitude === "number" && typeof form.longitude === "number"
        ? { lat: form.latitude, lng: form.longitude }
        : null,
    [form.latitude, form.longitude],
  );

  const refresh = useCallback(() => {
    listAddresses().then(setLocations).catch(() => setLocations([]));
  }, []);

  useEffect(() => {
    me()
      .then((c) => {
        setCustomer(c);
        refresh();
      })
      .catch(() => setCustomer(null))
      .finally(() => setChecked(true));
  }, [refresh]);

  function updateField<K extends keyof LocationForm>(key: K, value: LocationForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setError(t("Location is not available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setError(null);
        setForm((current) => ({
          ...current,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
      },
      () => setError(t("Could not get your location. You can still drop the pin manually.")),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function saveLocation() {
    if (!form.area.trim() || !form.building_number.trim() || !geo) {
      setError(t("Building number, area, and a confirmed map pin are required."));
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        label: form.label.trim() || "Home",
        area: form.area.trim(),
        details: form.details.trim(),
        building_number: form.building_number.trim(),
        zone_number: form.zone_number.trim() || null,
        street_number: form.street_number.trim() || null,
        latitude: geo.lat,
        longitude: geo.lng,
      };
      if (form.id) await updateAddress(form.id, payload);
      else await createAddress(payload);
      setNotice(form.id ? t("Location updated.") : t("Location saved."));
      setForm(emptyForm);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("Could not save this location."));
    } finally {
      setSaving(false);
    }
  }

  async function removeLocation(address: Address) {
    if (!window.confirm(t("Remove this saved location?"))) return;
    setError(null);
    setNotice(null);
    try {
      await deleteAddress(address.id);
      if (form.id === address.id) setForm(emptyForm);
      setNotice(t("Location removed."));
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("Could not remove this location."));
    }
  }

  return (
    <>
      <Navbar />
      <main id="main-content" className="section-shell min-h-[60dvh] py-7 sm:py-14">
        {!checked ? (
          <div className="commerce-card h-64 animate-pulse bg-slate-100" role="status" aria-label={t("Loading locations…")} />
        ) : !customer ? (
          <div className="mx-auto max-w-md">
            <AuthPanel title={t("Sign in to manage locations")} onAuthed={(c) => { setCustomer(c); refresh(); }} />
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <section className="space-y-4">
              <div>
                <Link href="/account" className="text-sm font-bold text-[color:var(--blue)]">← {t("Back to account")}</Link>
                <h1 className="mt-3 text-3xl font-extrabold text-[color:var(--navy)]">{t("Saved locations")}</h1>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {t("Save your home, office, or marina once. During booking, you can pick it instantly.")}
                </p>
              </div>

              {locations === null ? (
                <div className="space-y-3">{[0, 1, 2].map((item) => <div key={item} className="commerce-card h-28 animate-pulse bg-slate-100" />)}</div>
              ) : locations.length === 0 ? (
                <div className="commerce-card p-6">
                  <h2 className="text-lg font-bold text-[color:var(--navy)]">{t("No saved locations yet")}</h2>
                  <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{t("Add your first location using the form.")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {locations.map((address) => (
                    <article key={address.id} className={clsx("commerce-card p-4 transition", form.id === address.id && "border-[color:var(--blue)]")}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-bold text-[color:var(--navy)]">{address.label || t("Saved location")}</h2>
                          <p className="mt-1 text-sm font-semibold text-[color:var(--foreground)]">
                            {t("Building")} {address.building_number || "—"}
                            {address.zone_number ? ` · ${t("Zone")} ${address.zone_number}` : ""}
                            {address.street_number ? ` · ${t("Street")} ${address.street_number}` : ""}
                          </p>
                          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{address.area}{address.details ? ` · ${address.details}` : ""}</p>
                        </div>
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-sky-50 text-[color:var(--blue)]" aria-hidden="true">
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none"><path d="M12 21s6-5.33 6-11a6 6 0 1 0-12 0c0 5.67 6 11 6 11Z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="10" r="2" fill="currentColor"/></svg>
                        </span>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button type="button" className="secondary-button flex-1 px-4" onClick={() => setForm(formFromAddress(address))}>{t("Edit")}</button>
                        <button type="button" className="min-h-11 rounded-full px-4 text-sm font-bold text-red-600 hover:bg-red-50" onClick={() => removeLocation(address)}>{t("Remove")}</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="commerce-card h-fit p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--blue)]">{form.id ? t("Edit location") : t("New location")}</p>
                  <h2 className="mt-1 text-2xl font-bold text-[color:var(--navy)]">{t("Blue plate details")}</h2>
                </div>
                {form.id && <button type="button" className="min-h-11 text-sm font-bold text-[color:var(--blue)]" onClick={() => setForm(emptyForm)}>{t("Add new")}</button>}
              </div>

              <div className="space-y-4">
                <Field label={t("Label")}>
                  <input className="wizard-input" value={form.label} placeholder={t("Home, Work, Marina…")} onChange={(e) => updateField("label", e.target.value)} />
                </Field>

                <div className="rounded-3xl border border-[color:var(--border)] bg-slate-50 p-3">
                  <p className="mb-3 text-sm font-bold text-[color:var(--navy)]">{t("Blue plate")}</p>
                  <label className="block rounded-2xl bg-[color:var(--navy)] px-4 py-4 text-center text-white">
                    <span className="block text-sm font-bold">{t("Building No.")} <span aria-hidden="true">*</span></span>
                    <input className="mt-1 w-full bg-transparent text-center text-4xl font-bold outline-none placeholder:text-white/45" inputMode="numeric" pattern="[0-9]*" placeholder="000" value={form.building_number} onChange={(e) => updateField("building_number", e.target.value.replace(/\D/g, "").slice(0, 6))} />
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="block rounded-2xl bg-[color:var(--navy)] px-4 py-4 text-white">
                      <span className="block text-sm font-bold">{t("Zone No.")}</span>
                      <input className="mt-1 w-full bg-transparent text-3xl font-bold outline-none placeholder:text-white/35" inputMode="numeric" pattern="[0-9]*" placeholder="000" value={form.zone_number} onChange={(e) => updateField("zone_number", e.target.value.replace(/\D/g, "").slice(0, 3))} />
                    </label>
                    <label className="block rounded-2xl bg-[color:var(--navy)] px-4 py-4 text-white">
                      <span className="block text-sm font-bold">{t("Street No.")}</span>
                      <input className="mt-1 w-full bg-transparent text-3xl font-bold outline-none placeholder:text-white/35" inputMode="numeric" pattern="[0-9]*" placeholder="000" value={form.street_number} onChange={(e) => updateField("street_number", e.target.value.replace(/\D/g, "").slice(0, 4))} />
                    </label>
                  </div>
                </div>

                <Field label={t("Area / neighborhood")} required>
                  <input className="wizard-input" value={form.area} placeholder={t("e.g. West Bay, The Pearl…")} onChange={(e) => updateField("area", e.target.value)} />
                </Field>
                <Field label={t("Extra details")}>
                  <textarea className="wizard-input min-h-20 resize-y" value={form.details} placeholder={t("Flat, floor, gate, parking level…")} onChange={(e) => updateField("details", e.target.value)} />
                </Field>

                <div className="space-y-2">
                  <button type="button" className="secondary-button w-full" onClick={useCurrentLocation}>{t("Use my current location")}</button>
                  <LocationMap value={geo} onChange={(pin) => setForm((current) => ({ ...current, latitude: pin.lat, longitude: pin.lng }))} />
                  <p className="text-xs text-[color:var(--muted-foreground)]">{t("Tap the map or drag the pin if the current location is not exact.")}</p>
                </div>

                {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
                {notice && <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{notice}</p>}

                <button type="button" className="primary-button w-full disabled:opacity-40" disabled={saving || !form.area.trim() || !form.building_number.trim()} onClick={saveLocation}>
                  {saving ? t("Saving…") : form.id ? t("Save changes") : t("Save location")}
                </button>
              </div>
            </section>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-[color:var(--foreground)]">
      {label}
      {required && <span className="text-red-600"> *</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}
