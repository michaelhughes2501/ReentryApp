/* FreshStart — app.js  (vanilla JS, no framework) */
'use strict';

/* ── Nav scroll effect ───────────────────────────── */
(function initNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ── Mobile nav toggle ───────────────────────────── */
(function initMobileNav() {
  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    links.classList.toggle('open');
  });

  // Close nav when a link is clicked
  links.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      toggle.setAttribute('aria-expanded', 'false');
      links.classList.remove('open');
    }
  });
})();

/* ── Intersection-observer stagger animations ─────── */
(function initStagger() {
  const targets = document.querySelectorAll('.stagger-in');
  if (!targets.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  targets.forEach((el) => io.observe(el));
})();

/* ── Count-up animation for hero stats ───────────── */
(function initCountUp() {
  const nums = document.querySelectorAll('.hero-stat-num[data-target]');
  if (!nums.length) return;

  const fmt = (n) =>
    n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k+' : String(n) + '+';

  const animate = (el, target, duration) => {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      el.textContent = fmt(Math.round(eased * target));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          animate(el, Number(el.dataset.target), 1800);
          io.unobserve(el);
        }
      });
    },
    { threshold: 0.5 }
  );

  nums.forEach((el) => io.observe(el));
})();

/* ── CTA email form ──────────────────────────────── */
(function initCtaForm() {
  const form    = document.getElementById('ctaForm');
  const input   = document.getElementById('emailInput');
  const message = document.getElementById('ctaMessage');
  if (!form || !input || !message) return;

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    message.className = '';
    const val = input.value.trim();

    if (!emailRe.test(val)) {
      message.textContent = 'Please enter a valid email address.';
      message.className   = 'cta-note error';
      input.focus();
      return;
    }

    // Simulate async submission (replace with real fetch() when API exists)
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    setTimeout(() => {
      message.textContent = "You're on the list! We'll be in touch soon.";
      message.className   = 'cta-note';
      input.value = '';
      btn.disabled = false;
      btn.textContent = 'Get Early Access';
    }, 900);
  });
})();
