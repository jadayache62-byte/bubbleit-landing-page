"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import type { Slot } from "@/lib/api/types";
import { qatarSlotMs } from "@/lib/datetime";
import {
  positionPopoverInViewport,
  type PopoverPosition,
} from "@/lib/ui/position-popover";

type HourSlotPickerProps = {
  date: string;
  slots: Slot[];
  selectedSlot: string | null;
  nowMs: number;
  onSelect: (start: string) => void;
};

type QuarterOption = Slot & {
  isApiSlot: boolean;
};

const QUARTER_MINUTES = ["00", "15", "30", "45"] as const;

/** Groups quarter-hour API slots into an anchored hour → minute picker. */
export function HourSlotPicker({
  date,
  slots,
  selectedSlot,
  nowMs,
  onSelect,
}: HourSlotPickerProps) {
  const [openHour, setOpenHour] = useState<string | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const hours = useMemo(() => {
    const grouped = new Map<string, Map<string, Slot>>();
    slots.forEach((slot) => {
      const hour = slot.start.slice(0, 2);
      const minute = slot.start.slice(3, 5);
      const options = grouped.get(hour) ?? new Map<string, Slot>();
      options.set(minute, slot);
      grouped.set(hour, options);
    });

    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([hour, options]) => {
        const quarterOptions = QUARTER_MINUTES.map<QuarterOption>((minute) => {
          const apiSlot = options.get(minute);

          return apiSlot
            ? { ...apiSlot, isApiSlot: true }
            : {
                start: `${hour}:${minute}`,
                end: `${hour}:${minute}`,
                available: false,
                isApiSlot: false,
              };
        });

        return [hour, quarterOptions] as const;
      });
  }, [slots]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpenHour(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && openHour) {
        const hour = openHour;
        setOpenHour(null);
        requestAnimationFrame(() => triggerRefs.current.get(hour)?.focus());
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openHour]);

  useLayoutEffect(() => {
    if (!openHour) return;

    let animationFrame = 0;
    const update = () => {
      const trigger = triggerRefs.current.get(openHour);
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const measuredHeight = popoverRef.current?.getBoundingClientRect().height ?? 112;
      setPopoverPosition(positionPopoverInViewport(
        { left: rect.left, top: rect.top, bottom: rect.bottom },
        { width: window.innerWidth, height: window.innerHeight },
        measuredHeight,
      ));
    };

    animationFrame = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [openHour]);

  return (
    <div ref={rootRef} className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
      {hours.map(([hour, options]) => {
        const selectable = options.filter(
          (option) => option.available && qatarSlotMs(date, option.start) > nowMs,
        );
        const enabled = selectable.length > 0;
        const selectedInHour = selectedSlot?.startsWith(`${hour}:`) ?? false;
        return (
          <div key={hour} className="relative scroll-mb-32">
            <button
              ref={(element) => {
                if (element) triggerRefs.current.set(hour, element);
                else triggerRefs.current.delete(hour);
              }}
              type="button"
              disabled={!enabled}
              aria-expanded={openHour === hour}
              aria-haspopup="listbox"
              aria-controls={`time-options-${hour}`}
              onClick={() => {
                setPopoverPosition(null);
                setOpenHour(openHour === hour ? null : hour);
              }}
              className={clsx(
                "w-full rounded-xl border px-2 py-2.5 text-sm font-semibold transition",
                selectedInHour
                  ? "border-[color:var(--navy)] bg-[color:var(--navy)] text-white"
                  : enabled
                    ? "border-[color:var(--border)] bg-white text-[color:var(--foreground)] hover:border-[color:var(--blue)] hover:text-[color:var(--blue)]"
                    : "cursor-not-allowed border-transparent bg-[color:var(--background)] text-[color:var(--muted-foreground)]/50 line-through",
              )}
            >
              {selectedInHour ? selectedSlot : `${hour}:00`}
            </button>
            {openHour === hour && popoverPosition && createPortal(
              <div
                ref={popoverRef}
                id={`time-options-${hour}`}
                role="listbox"
                aria-label={`${hour}:00 time options`}
                className="fixed z-[100] grid grid-cols-2 gap-1 rounded-2xl border border-[color:var(--border)] bg-white p-2 shadow-xl"
                style={popoverPosition}
              >
                {options.map((option) => {
                  const optionEnabled = option.isApiSlot && option.available && qatarSlotMs(date, option.start) > nowMs;
                  return (
                    <button
                      key={option.start}
                      type="button"
                      role="option"
                      aria-selected={selectedSlot === option.start}
                      disabled={!optionEnabled}
                      onClick={() => {
                        onSelect(option.start);
                        setOpenHour(null);
                        requestAnimationFrame(() => triggerRefs.current.get(hour)?.focus());
                      }}
                      className={clsx(
                        "rounded-xl px-2 py-2 text-sm font-semibold transition",
                        selectedSlot === option.start
                          ? "bg-[color:var(--navy)] text-white"
                          : optionEnabled
                            ? "text-[color:var(--foreground)] hover:bg-[color:var(--background)] hover:text-[color:var(--blue)]"
                            : "cursor-not-allowed text-[color:var(--muted-foreground)]/50 line-through",
                      )}
                    >
                      {option.start}
                    </button>
                  );
                })}
              </div>,
              document.body,
            )}
          </div>
        );
      })}
    </div>
  );
}
