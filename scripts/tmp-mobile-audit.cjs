const { chromium } = require('@playwright/test');

const base = 'http://127.0.0.1:8000';
const routes = ['/consult', '/detox', '/herbs', '/dosha-test'];
const viewports = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
];

function px(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return null;
  return Math.round(v * 100) / 100;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const out = [];

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });

    for (const route of routes) {
      const page = await context.newPage();
      const errors = [];

      page.on('pageerror', (e) => errors.push(`pageerror:${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console:${m.text()}`);
      });

      const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(250);

      const metrics = await page.evaluate(async () => {
        const doc = document.documentElement;
        const body = document.body;
        const overflow = Math.max(body.scrollWidth, doc.scrollWidth) - doc.clientWidth;

        const hero = document.querySelector('[data-cta-place="hero"]');
        const pricing = document.querySelector('[data-cta-place="pricing"]');
        const nextStep = document.querySelector('[data-cta-place="next_step"]');
        const stickyWrap = document.querySelector('#sticky-cta');

        if (stickyWrap) {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
          await new Promise((r) => setTimeout(r, 220));
        }

        const sticky = document.querySelector('[data-cta-place="sticky"]');

        const rect = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { w: r.width, h: r.height };
        };

        const samples = [hero, pricing, nextStep].map((el) => rect(el)).filter(Boolean);
        const samePrimarySize = samples.length < 2
          ? true
          : samples.every((s) => Math.abs(s.w - samples[0].w) < 1.5 && Math.abs(s.h - samples[0].h) < 1.5);

        return {
          overflow,
          samePrimarySize,
          hero: rect(hero),
          pricing: rect(pricing),
          nextStep: rect(nextStep),
          sticky: rect(sticky),
          stickyVisible: !!stickyWrap && stickyWrap.classList.contains('visible'),
          hasRouteMap: !!document.querySelector('.cw3-route-map'),
          hasResourceEntry: !!document.querySelector('.cw3-resource-entry'),
          bodyFont: getComputedStyle(document.body).fontFamily,
          h1Count: document.querySelectorAll('h1').length,
        };
      });

      out.push({
        viewport: vp.name,
        route,
        status: response ? response.status() : null,
        errors,
        overflowPx: px(metrics.overflow),
        samePrimarySize: metrics.samePrimarySize,
        heroBtn: metrics.hero ? { w: px(metrics.hero.w), h: px(metrics.hero.h) } : null,
        pricingBtn: metrics.pricing ? { w: px(metrics.pricing.w), h: px(metrics.pricing.h) } : null,
        nextBtn: metrics.nextStep ? { w: px(metrics.nextStep.w), h: px(metrics.nextStep.h) } : null,
        stickyBtn: metrics.sticky ? { w: px(metrics.sticky.w), h: px(metrics.sticky.h) } : null,
        stickyVisible: metrics.stickyVisible,
        hasRouteMap: metrics.hasRouteMap,
        hasResourceEntry: metrics.hasResourceEntry,
        bodyFont: metrics.bodyFont,
        h1Count: metrics.h1Count,
      });

      await page.close();
    }

    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(out, null, 2));
})();
