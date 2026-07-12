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
  // Restore browser storage after hydration so the server and first client
  // render always match, even when a returning shopper has a saved cart.
  const [cart, setCart] = useState<Cart>({});
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [products, setProducts] = useState<StoreProductInventory[]>(() =>
    fallbackProducts(),
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setCart(readCart()));
  }, []);

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

  const cartItems = useMemo(
    () => products
      .map((product) => ({ product, quantity: cart[String(product.id)] ?? 0 }))
      .filter((item) => item.quantity > 0),
    [cart, products],
  );

  function openCart() {
    setCartOpen(true);
  }

  function closeCart() {
    setCartOpen(false);
  }

  useEffect(() => {
    if (!cartOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCartOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [cartOpen]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((product) =>
      product.accounting_code === "STORE-TOOLS" ? "Tools" :
      product.accounting_code === "STORE-ACCESSORIES" ? "Accessories" : "Car care",
    )))],
    [products],
  );

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((product) => {
      const productCategory = product.accounting_code === "STORE-TOOLS" ? "Tools" :
        product.accounting_code === "STORE-ACCESSORIES" ? "Accessories" : "Car care";
      return (category === "All" || category === productCategory) &&
        (!normalized || `${product.name} ${product.description}`.toLowerCase().includes(normalized));
    });
  }, [category, products, query]);

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

  function changeQuantity(product: StoreProductInventory, quantity: number) {
    const id = String(product.id);
    const next = { ...cart };
    if (quantity <= 0) delete next[id];
    else next[id] = Math.min(quantity, availableFor(product));
    updateCart(next);
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-7 pb-32 sm:px-6 sm:py-12 sm:pb-36 lg:px-8">
      <section className="max-w-3xl">
        <div>
          <span className="section-kicker">Bubbleit Store</span>
          <h1 className="section-title mt-4">Professional car care, delivered</h1>
          <p className="section-copy mt-4">
            The same practical tools and towels trusted by Bubbleit detailers,
            ready for delivery across Qatar.
          </p>
        </div>

      </section>

      <section className="mt-9 border-y border-[color:var(--border)] py-4" aria-label="Find products">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="relative block md:w-80">
            <span className="sr-only">Search products</span>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8"/><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="wizard-input min-h-12 ps-11" placeholder="Search car care products" />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Product categories">
            {categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={clsx("min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors", category === item ? "border-[color:var(--navy)] bg-[color:var(--navy)] text-white" : "border-[color:var(--border)] bg-white hover:border-[color:var(--blue)]")}>{item}</button>)}
          </div>
        </div>
      </section>

      <div className="mt-8 flex items-center justify-between"><h2 className="text-xl font-bold">Shop all products</h2><span className="text-sm text-[color:var(--muted-foreground)]">{visibleProducts.length} products</span></div>
      <section className="mt-4 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
        {visibleProducts.map((product) => {
          const id = String(product.id);
          const inCart = cart[id] ?? 0;
          const available = availableFor(product) - inCart;
          return (
          <article
            key={id}
            className="commerce-card relative flex h-full flex-col p-2.5 sm:p-4"
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
                className="object-contain p-2 sm:p-4"
              />
            </div>
            <div className="flex flex-1 flex-col p-1.5 pt-4 sm:p-2 sm:pt-5">
              <div className="flex flex-col gap-2">
                <h3 className="line-clamp-3 min-h-[4rem] text-[15px] font-bold leading-snug text-[color:var(--navy)] sm:text-lg">
                  {product.name}
                </h3>
                <p className="shrink-0 text-base font-extrabold text-[color:var(--navy)]">
                  {formatStorePrice(product.price)}
                </p>
              </div>
              <p className="mt-2 hidden min-h-12 text-sm leading-6 text-[color:var(--muted-foreground)] sm:line-clamp-2">
                {product.description}
              </p>
              <p className="mt-4 text-xs font-semibold text-[color:var(--muted-foreground)] sm:mt-3">
                {available > 0 ? `${available} in stock` : "Out of stock"}
              </p>
              {inCart > 0 ? <div className="mt-auto flex min-h-12 items-center justify-between rounded-full border border-[color:var(--border)] bg-white p-1 pt-1"><button type="button" className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100" onClick={() => { const next = {...cart}; if (inCart === 1) delete next[id]; else next[id] = inCart - 1; updateCart(next); }} aria-label={`Remove one ${product.name}`}>−</button><span className="text-xs font-bold sm:text-sm">{inCart} in cart</span><button type="button" className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100 disabled:opacity-30" disabled={available <= 0} onClick={() => addProduct(product)} aria-label={`Add one ${product.name}`}>+</button></div> : <button
                type="button"
                className={clsx(
                  "primary-button mt-auto min-h-12 w-full transition",
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
              </button>}
            </div>
          </article>
          );
        })}
      </section>
      {visibleProducts.length === 0 && <div className="py-16 text-center"><h2 className="text-xl font-bold">No products found</h2><p className="mt-2 text-sm text-[color:var(--muted-foreground)]">Try a different search or category.</p><button type="button" className="secondary-button mt-5" onClick={() => { setQuery(""); setCategory("All"); }}>Clear filters</button></div>}

      {cartCount > 0 && <aside className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_36px_rgba(38,34,98,0.12)] backdrop-blur-xl" aria-label="Cart actions">
        <div className="mx-auto grid max-w-xl grid-cols-2 gap-2 sm:gap-3">
          <button type="button" className="secondary-button relative min-h-14 px-3 text-sm sm:text-base" aria-haspopup="dialog" aria-expanded={cartOpen} onClick={openCart}>
            <svg viewBox="0 0 24 24" fill="none" className="me-2 h-5 w-5" aria-hidden="true"><path d="M3.5 4.5h2l1.4 10.1a2 2 0 0 0 2 1.7h7.8a2 2 0 0 0 1.9-1.4L21 7.5H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9.5" cy="19.5" r="1.25" fill="currentColor"/><circle cx="17.5" cy="19.5" r="1.25" fill="currentColor"/></svg>
            View cart <span className="ms-1 text-[color:var(--muted-foreground)]">({cartCount})</span>
          </button>
          <Link href="/store/checkout" className="primary-button min-h-14 px-3 text-sm sm:text-base">Checkout <span className="ms-1 hidden sm:inline">· {formatStorePrice(subtotal)}</span><span className="ms-2" aria-hidden="true">→</span></Link>
        </div>
      </aside>}

      <div className={clsx("cart-backdrop fixed inset-0 z-50 bg-slate-950/35 p-3 sm:p-6", cartOpen && "is-open")} role="presentation" aria-hidden={!cartOpen} inert={!cartOpen} onMouseDown={(event) => { if (event.target === event.currentTarget) closeCart(); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="cart-title" className={clsx("cart-dialog absolute inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] mx-auto flex max-h-[min(78dvh,680px)] max-w-md flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:end-6 sm:bottom-6 sm:w-[26rem]", cartOpen && "is-open")}>
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div><h2 id="cart-title" className="text-xl font-bold text-[color:var(--navy)]">Your cart</h2><p className="mt-0.5 text-sm text-[color:var(--muted-foreground)]">{cartCount} item{cartCount === 1 ? "" : "s"}</p></div>
            <button type="button" className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-slate-200 text-xl text-[color:var(--navy)] transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[color:var(--blue)]" onClick={closeCart} aria-label="Close cart">×</button>
          </header>

          {cartItems.length === 0 ? <div className="grid min-h-64 place-items-center px-6 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-[color:var(--navy)]"><svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true"><path d="M3.5 4.5h2l1.4 10.1a2 2 0 0 0 2 1.7h7.8a2 2 0 0 0 1.9-1.4L21 7.5H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span><h3 className="mt-4 text-lg font-bold">Your cart is empty</h3><p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Add a product to start your order.</p><button type="button" className="secondary-button mt-5" onClick={closeCart}>Continue shopping</button></div></div> : <>
            <div className="overscroll-contain overflow-y-auto px-5 py-2">
              {cartItems.map(({ product, quantity }) => <article key={product.id} className="flex gap-3 border-b border-slate-100 py-4 last:border-0">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-50"><Image src={imageFor(product)} alt="" fill sizes="80px" className="object-contain p-2" /></div>
                <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-bold leading-snug text-[color:var(--navy)]">{product.name}</h3><span className="shrink-0 text-sm font-extrabold">{formatStorePrice(product.price * quantity)}</span></div><div className="mt-3 flex items-center gap-2"><button type="button" className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-slate-200 text-lg font-bold hover:bg-slate-100" onClick={() => changeQuantity(product, quantity - 1)} aria-label={`Remove one ${product.name}`}>−</button><span className="min-w-6 text-center text-sm font-bold" aria-label={`${quantity} in cart`}>{quantity}</span><button type="button" className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-slate-200 text-lg font-bold hover:bg-slate-100 disabled:opacity-30" disabled={quantity >= availableFor(product)} onClick={() => changeQuantity(product, quantity + 1)} aria-label={`Add one ${product.name}`}>+</button></div></div>
              </article>)}
            </div>
            <footer className="border-t border-slate-200 bg-slate-50 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:pb-5"><div className="flex items-end justify-between"><span className="text-sm font-semibold text-[color:var(--muted-foreground)]">Subtotal</span><span className="text-2xl font-extrabold text-[color:var(--navy)]">{formatStorePrice(subtotal)}</span></div><p className="mt-1 text-xs text-[color:var(--muted-foreground)]">Delivery details are confirmed at checkout.</p><Link href="/store/checkout" className="primary-button mt-4 min-h-14 w-full text-base" onClick={() => setCartOpen(false)}>Checkout securely <span aria-hidden="true" className="ms-2">→</span></Link><button type="button" className="mt-2 min-h-11 w-full cursor-pointer text-sm font-semibold text-[color:var(--muted-foreground)] hover:text-[color:var(--navy)]" onClick={closeCart}>Continue shopping</button></footer>
          </>}
        </section>
      </div>
    </div>
  );
}
