const navToggle = document.getElementById('nav-toggle');
const mainNav = document.getElementById('main-nav');

if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('main-nav--open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  mainNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('main-nav--open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// The fixed N is a single mark that is not tied to any section: each of its three tonal layers
// (see .n-mark-fixed in css/styles.css) is clipped to the sections that share its tone, so the
// N stays whole while the background scrolls beneath it and it is always visible.
const nMark = document.querySelector('.n-mark-fixed');
const nLayers = nMark ? nMark.querySelectorAll('[data-tone]') : [];
const toneSections = document.querySelectorAll('[data-n-tone]');

if (nMark && nLayers.length && toneSections.length) {
  let ticking = false;

  const clipLayers = () => {
    ticking = false;
    const box = nMark.getBoundingClientRect();
    const paths = {};

    toneSections.forEach((section) => {
      const { top, bottom } = section.getBoundingClientRect();
      if (bottom < box.top || top > box.bottom) return;
      const y0 = Math.max(top - box.top, 0);
      const y1 = Math.min(bottom - box.top, box.height);
      const tone = section.dataset.nTone;
      paths[tone] = `${paths[tone] || ''}M0 ${y0}H${box.width}V${y1}H0Z`;
    });

    nLayers.forEach((layer) => {
      const path = paths[layer.dataset.tone];
      layer.style.clipPath = path ? `path('${path}')` : 'inset(100%)';
    });
  };

  const requestClip = () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(clipLayers);
    }
  };

  window.addEventListener('scroll', requestClip, { passive: true });
  window.addEventListener('resize', requestClip);
  clipLayers();
}
