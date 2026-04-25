"use client";

import { useEffect } from "react";

const TOUCH_TARGET_SELECTOR = [
  "button",
  "a",
  "[role='button']",
  "[data-mobile-touch]",
  ".ds-dashboard-topcard",
  ".ds-card2",
  ".ds-kpi-card",
  ".ds-chart-card",
  ".ds-ip-card",
  ".ds-ip-detail-card",
  ".ds-unlock-item",
  ".ds-nq-kpi",
  ".ds-nq-section",
  ".ds-nq-route-block",
  ".ds-home-toolbar-stat",
  ".ds-home-toolbar-label",
  ".ds-pill",
].join(",");

const FORM_CONTROL_SELECTOR = [
  "input:not([type='button']):not([type='submit']):not([type='reset'])",
  "textarea",
  "select",
  "[contenteditable='true']",
].join(",");

function isTouchLikeDevice() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: none), (pointer: coarse)").matches;
}

export function MobileTouchFeedback() {
  useEffect(() => {
    if (!isTouchLikeDevice()) return;

    const activeEls = new Set<HTMLElement>();
    const timers = new WeakMap<HTMLElement, number>();
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    document.body.classList.add("ds-touch-feedback-enabled");

    const clearElement = (el: HTMLElement, delay = 90) => {
      const oldTimer = timers.get(el);
      if (oldTimer) window.clearTimeout(oldTimer);
      const timer = window.setTimeout(() => {
        el.classList.remove("ds-touch-active");
        activeEls.delete(el);
        timers.delete(el);
      }, delay);
      timers.set(el, timer);
    };

    const clearAll = () => {
      activeEls.forEach((el) => clearElement(el, 70));
    };

    const addRipple = (el: HTMLElement, event: PointerEvent) => {
      if (prefersReducedMotion) return;
      if (el.classList.contains("ds-no-ripple")) return;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const ripple = document.createElement("span");
      ripple.className = "ds-touch-ripple";
      ripple.style.left = `${event.clientX - rect.left}px`;
      ripple.style.top = `${event.clientY - rect.top}px`;
      ripple.style.setProperty("--ds-ripple-size", `${Math.max(rect.width, rect.height) * 1.55}px`);
      el.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 560);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(FORM_CONTROL_SELECTOR)) return;
      if (target.closest(".recharts-wrapper, .recharts-surface, .recharts-tooltip-wrapper")) return;

      const match = target.closest(TOUCH_TARGET_SELECTOR);
      if (!(match instanceof HTMLElement)) return;
      if (match.matches("[disabled], [aria-disabled='true']")) return;
      if (match.closest("[disabled], [aria-disabled='true']")) return;

      match.classList.add("ds-touch-active");
      activeEls.add(match);
      addRipple(match, event);
      clearElement(match, 420);
    };

    document.addEventListener("pointerdown", handlePointerDown, { passive: true });
    document.addEventListener("pointerup", clearAll, { passive: true });
    document.addEventListener("pointercancel", clearAll, { passive: true });
    document.addEventListener("pointerleave", clearAll, { passive: true });
    document.addEventListener("scroll", clearAll, { passive: true, capture: true });
    window.addEventListener("blur", clearAll);

    return () => {
      document.body.classList.remove("ds-touch-feedback-enabled");
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointerup", clearAll);
      document.removeEventListener("pointercancel", clearAll);
      document.removeEventListener("pointerleave", clearAll);
      document.removeEventListener("scroll", clearAll, { capture: true } as EventListenerOptions);
      window.removeEventListener("blur", clearAll);
      activeEls.forEach((el) => el.classList.remove("ds-touch-active"));
    };
  }, []);

  return null;
}
