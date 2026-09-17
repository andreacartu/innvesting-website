function openCase(id) {
    var el = document.getElementById('overlay-' + id);
    if (!el) return;
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
    el.scrollTop = 0;
  }
  function closeCase(id) {
    var el = document.getElementById('overlay-' + id);
    if (!el) return;
    el.classList.remove('open');
    document.body.style.overflow = '';
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.case-overlay.open').forEach(function (el) {
        el.classList.remove('open');
      });
      document.body.style.overflow = '';
    }
  });
  document.querySelectorAll('.case-overlay').forEach(function (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  });