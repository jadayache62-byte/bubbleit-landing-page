"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { listStoreProducts } from "@/lib/api/client";
import type { StoreProductInventory } from "@/lib/api/types";
import { STORE_PRODUCTS, formatStorePrice } from "@/lib/store/products";

const CART_KEY = "bubbleit.store.cart";

type Cart = Record<string, number>;

function fallbackProducts(): StoreProductInventory[] {
  return STORE_PRODUCTS.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    price: product.price,
    imageSrc: product.imageSrc,
    imageAlt: product.imageAlt,
    stock_quantity: product.initialStock,
    sold_quantity: 0,
    reserved_quantity: 0,
    available_quantity: product.initialStock,
    accounting_code: product.accountingCode,
    is_available: product.initialStock > 0,
  }));
}

function imageFor(product: StoreProductInventory) {
  return (
    product.imageSrc ??
    STORE_PRODUCTS.find((fallback) => fallback.sku === product.sku)?.imageSrc ??
    "/assets/store/product-5.jpg"
  );
}

function availableFor(product: StoreProductInventory) {
  return Math.max(
    0,
    product.available_quantity ??
      product.stock_quantity - product.reserved_quantity,
  );
}

function readCart(): Cart {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as Cart) : {};
  } catch {
    return {};
  }
}

function writeCart(cart: Cart) {
  window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function StoreClient() {
  const [cart, setCart] = useState<Cart>(() => readCart());
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [products, setProducts] = useState<StoreProductInventory[]>(() =>
    fallbackProducts(),
  );

  useEffect(() => {
    let cancelled = false;
    listStoreProducts()
      .then((items) => {
        if (!cancelled) setProducts(items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const cartCount = useMemo(
    () => Object.values(cart).reduce((sum, qty) => sum + qty, 0),
    [cart],
  );

  const subtotal = useMemo(
    () =>
      products.reduce(
        (sum, product) => sum + (cart[String(product.id)] ?? 0) * product.price,
        0,
      ),
    [cart, products],
  );

  function updateCart(next: Cart) {
    setCart(next);
    writeCart(next);
  }

  function addProduct(product: StoreProductInventory) {
    const id = String(product.id);
    const current = cart[id] ?? 0;
    if (current >= availableFor(product)) return;
    updateCart({ ...cart, [id]: current + 1 });
    setJustAdded(id);
    window.setTimeout(
      () => setJustAdded((currentId) => (currentId === id ? null : currentId)),
      900,
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <section className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-end">
        <div>
          <span className="section-kicker">Bubbleit Store</span>
          <h1 className="section-title mt-4">Car care products for a cleaner drive</h1>
          <p className="section-copy mt-4">
            Shop Bubbleit microfiber towels, brushes, gloves, and car-care
            accessories pulled from the official Bubbleit store.
          </p>
        </div>

        <aside className="glass-panel rounded-[var(--radius-card)] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[color:var(--muted-foreground)]">
                Cart
              </p>
              <p className="mt-1 text-2xl font-bold text-[color:var(--navy)]">
                {cartCount} item{cartCount === 1 ? "" : "s"}
              </p>
            </div>
            <p className="text-lg font-bold text-[color:var(--blue)]">
              {formatStorePrice(subtotal)}
            </p>
          </div>
          <Link
            href="/store/checkout"
            className="primary-button mt-5 w-full"
            aria-disabled={cartCount === 0}
            onClick={(event) => {
              if (cartCount === 0) event.preventDefault();
            }}
          >
            Checkout
          </Link>
        </aside>
      </section>

      <section className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => {
          const id = String(product.id);
          const inCart = cart[id] ?? 0;
          const available = availableFor(product) - inCart;
          return (
          <article
            key={id}
            className="glass-panel relative flex h-full flex-col rounded-[var(--radius-card)] p-4 transition duration-300"
          >
            <span
              className={clsx(
                "pointer-events-none absolute inset-0 rounded-[var(--radius-card)] ring-2 ring-[color:var(--cyan)]/0 transition duration-300",
                justAdded === id && "scale-[1.015] ring-[color:var(--cyan)]/70",
              )}
            />
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-linear-to-br from-[#eef9ff] via-white to-[#dff3ff]">
              <Image
                src={imageFor(product)}
                alt={product.imageAlt ?? product.name}
                fill
                sizes="(min-width: 1280px) 31vw, (min-width: 640px) 48vw, 100vw"
                className="object-contain p-4"
              />
            </div>
            <div className="flex flex-1 flex-col p-2 pt-5">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-bold leading-tight text-[color:var(--navy)]">
                  {product.name}
                </h2>
                <p className="shrink-0 rounded-full bg-[color:var(--cyan)]/12 px-3 py-1 text-sm font-bold text-[color:var(--deep-blue)]">
                  {formatStorePrice(product.price)}
                </p>
              </div>
              <p className="mt-3 flex-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
                {product.description}
              </p>
              <p className="mt-4 text-xs font-semibold text-[color:var(--muted-foreground)]">
                {available > 0 ? `${available} in stock` : "Out of stock"}
              </p>
              <button
                type="button"
                className={clsx(
                  "primary-button mt-5 w-full transition",
                  justAdded === id && "scale-[0.98] bg-[color:var(--deep-blue)]",
                )}
                disabled={available <= 0}
                onClick={() => addProduct(product)}
                aria-live="polite"
              >
                {available <= 0
                  ? "Out of stock"
                  : justAdded === id
                    ? "Added"
                    : "Add to cart"}
              </button>
            </div>
          </article>
          );
        })}
      </section>
    </div>
  );
}
