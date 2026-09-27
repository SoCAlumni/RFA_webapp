"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** 열린 순서대로 쌓아서 Escape 는 맨 위 것만 닫는다 */
const stack: symbol[] = [];

export function Modal({
  label,
  className,
  onClose,
  children,
  guest,
}: {
  label: string;
  className: string;
  onClose: () => void;
  children: ReactNode;
  guest?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const me = Symbol("modal");
    stack.push(me);
    const prev = document.activeElement as HTMLElement | null;
    document.body.classList.add("modal-open");
    requestAnimationFrame(() => {
      const el =
        box.current?.querySelector<HTMLElement>("[data-autofocus]") ??
        box.current?.querySelector<HTMLElement>("button, input, a, textarea, select");
      el?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || stack[stack.length - 1] !== me) return;
      e.preventDefault();
      close.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(me), 1);
      if (!stack.length) document.body.classList.remove("modal-open");
      prev?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      className="rfa-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={box}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-guest={guest || undefined}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
