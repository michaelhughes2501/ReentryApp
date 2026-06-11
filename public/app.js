/* FreshStart — app.js  (vanilla JS, no framework) */
'use strict';

/* ── Nav scroll effect ───────────────────────────── */
(function initNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      nav.classList.toggle('scrolled', window.scrollY > 24);
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ── Mobile nav toggle ───────────────────────────── */
(function initMobileNav() {
  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');
  if (!toggle || !links) return;

  const closeMenu = () => {
    toggle.setAttribute('aria-expanded', 'false');
    links.classList.remove('open');
  };

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    links.classList.toggle('open');
  });

  // Close nav when a link is clicked
  links.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') closeMenu();
  });

  // Close nav on Escape for keyboard users
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && links.classList.contains('open')) {
      closeMenu();
      toggle.focus();
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
          const target = Number(el.dataset.target);
          if (Number.isNaN(target)) {
            io.unobserve(el);
            return;
          }
          if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            el.textContent = fmt(target);
          } else {
            animate(el, target, 1800);
          }
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
  let isSubmitting = false;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    message.className = '';
    const val = input.value.trim();

    if (!emailRe.test(val)) {
      message.textContent = 'Please enter a valid email address.';
      message.className   = 'cta-note error';
      input.focus();
      return;
    }

    isSubmitting = true;
    // Simulate async submission (replace with real fetch() when API exists)
    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending…';
    }

    setTimeout(() => {
      message.textContent = "You're on the list! We'll be in touch soon.";
      message.className   = 'cta-note';
      input.value = '';
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Get Early Access';
      }
      isSubmitting = false;
    }, 900);
  });
})();
