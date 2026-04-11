"use client";

export function formatPrice() {
  const card = document.querySelector<HTMLElement>(".pricing-card[data-price-value]");
  if (!card) return;
  const value = Number(card.getAttribute("data-price-value"));
  if (!Number.isFinite(value)) return;

  const formatted = value.toLocaleString("uk-UA");
  document.querySelectorAll<HTMLElement>(".js-price-value").forEach((node) => {
    node.textContent = formatted;
  });
}
