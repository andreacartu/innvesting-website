// Lightbox for the before/after photo grids of the case pages. Each photo is a plain link to the
// full-size image (see .photo-grid__link), so without JavaScript it simply opens the image.
// Here the click is intercepted to show it enlarged, with arrows to move within the same grid.

const ICONS = {
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  prev: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
};

const icon = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

// Screen-reader labels, in the page's own language (this script is shared by the Italian and English pages).
const L = document.documentElement.lang === 'en'
  ? { dialog: 'Enlarged photo', close: 'Close', prev: 'Previous photo', next: 'Next photo' }
  : { dialog: 'Foto ingrandita', close: 'Chiudi', prev: 'Foto precedente', next: 'Foto successiva' };

const createLightbox = () => {
  const dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  dialog.setAttribute('aria-label', L.dialog);
  dialog.innerHTML = `
    <button type="button" class="lightbox__btn lightbox__btn--close" aria-label="${L.close}">${icon('close')}</button>
    <button type="button" class="lightbox__btn lightbox__btn--prev" aria-label="${L.prev}">${icon('prev')}</button>
    <figure class="lightbox__figure">
      <img class="lightbox__img" alt="">
      <figcaption class="lightbox__caption"></figcaption>
    </figure>
    <button type="button" class="lightbox__btn lightbox__btn--next" aria-label="${L.next}">${icon('next')}</button>`;
  document.body.appendChild(dialog);
  return dialog;
};

const lightbox = createLightbox();
const image = lightbox.querySelector('.lightbox__img');
const caption = lightbox.querySelector('.lightbox__caption');
const prevButton = lightbox.querySelector('.lightbox__btn--prev');
const nextButton = lightbox.querySelector('.lightbox__btn--next');

let links = [];
let current = 0;

const show = (index) => {
  current = (index + links.length) % links.length;
  const thumb = links[current].querySelector('img');
  image.src = links[current].href;
  image.alt = thumb.alt;
  caption.textContent = `${thumb.alt} (${current + 1}/${links.length})`;
};

const open = (gallery, link) => {
  links = [...gallery.querySelectorAll('.photo-grid__link')];
  const single = links.length < 2;
  prevButton.hidden = single;
  nextButton.hidden = single;
  show(links.indexOf(link));
  lightbox.showModal();
};

document.querySelectorAll('.photo-grid').forEach((gallery) => {
  gallery.addEventListener('click', (event) => {
    const link = event.target.closest('.photo-grid__link');
    if (!link) return;
    event.preventDefault();
    open(gallery, link);
  });
});

prevButton.addEventListener('click', () => show(current - 1));
nextButton.addEventListener('click', () => show(current + 1));
lightbox.querySelector('.lightbox__btn--close').addEventListener('click', () => lightbox.close());

// A click on the dark area around the photo closes the viewer.
lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) lightbox.close();
});

lightbox.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') show(current - 1);
  if (event.key === 'ArrowRight') show(current + 1);
});

// Swipe left/right on touch screens.
let touchStartX = null;
lightbox.addEventListener('touchstart', (event) => { touchStartX = event.touches[0].clientX; }, { passive: true });
lightbox.addEventListener('touchend', (event) => {
  if (touchStartX === null) return;
  const deltaX = event.changedTouches[0].clientX - touchStartX;
  touchStartX = null;
  if (Math.abs(deltaX) > 50) show(current + (deltaX < 0 ? 1 : -1));
}, { passive: true });
