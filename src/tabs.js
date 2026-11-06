/* ---------- tab bar: scroll cues + overscroll squeeze ---------- */
(function(){
  const shell = $('.tabs-shell'), nav = shell && shell.querySelector('.tabs'); if (!nav) return;
  const sync = () => {
    const max = nav.scrollWidth - nav.clientWidth;
    shell.classList.toggle('can-l', max > 2 && nav.scrollLeft > 2);
    shell.classList.toggle('can-r', max > 2 && nav.scrollLeft < max - 2);
  };
  nav.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync);
  shell.querySelectorAll('[data-tscroll]').forEach(b => b.addEventListener('click', () => {
    nav.scrollBy({ left: +b.dataset.tscroll * nav.clientWidth * 0.6, behavior: reduced() ? 'auto' : 'smooth' });
  }));
  if (window.ResizeObserver) new ResizeObserver(sync).observe(nav);
  sync(); setTimeout(sync, 400);
  // one gentle peek on load so the bar visibly moves
  setTimeout(() => {
    if (reduced() || nav.scrollLeft > 2 || nav.scrollWidth - nav.clientWidth < 8) return;
    nav.scrollTo({ left: Math.min(48, nav.scrollWidth - nav.clientWidth), behavior: 'smooth' });
    setTimeout(() => nav.scrollTo({ left: 0, behavior: 'smooth' }), 650);
  }, 1300);

  // ---- overscroll squeeze ----
  const MAX = 46;                                   // max visible pull, px
  const rub = d => MAX * (1 - 1 / (d * 0.55 / MAX + 1));
  const glowL = shell.querySelector('.tabs-glow.l'), glowR = shell.querySelector('.tabs-glow.r');
  let raw = 0, side = 0, springT = 0, frame = 0;
  const atL = () => nav.scrollLeft <= 0.5;
  const atR = () => nav.scrollLeft >= nav.scrollWidth - nav.clientWidth - 0.5;
  const paint = () => {
    frame = 0;
    const pull = side * rub(Math.abs(raw)), k = Math.abs(pull) / MAX, W = nav.clientWidth || 1;
    const act = nav.querySelector('.tab[aria-current="page"]');
    let indW = 1;
    [...nav.children].forEach(el => {
      if (el.classList.contains('tab-ind')) return;
      const x = Math.min(1, Math.max(0, (el.offsetLeft - nav.scrollLeft + el.offsetWidth / 2) / W));
      const w = pull > 0 ? 1 - x : x;               // 0 = item nearest the wall it is pushed into
      const tx = pull * (0.3 + 0.7 * w), sx = 1 - 0.09 * k * (1 - w);
      el.style.setProperty('--tx', tx.toFixed(2) + 'px'); el.style.setProperty('--sx', sx.toFixed(4));
      if (el === act) indW = w;
    });
    const ind = nav.querySelector('.tab-ind');
    if (ind) { ind.style.setProperty('--tx', (pull * (0.3 + 0.7 * indW)).toFixed(2) + 'px'); ind.style.setProperty('--sx', (1 - 0.09 * k * (1 - indW)).toFixed(4)); }
    const g = pull > 0 ? glowL : glowR, o = pull > 0 ? glowR : glowL;
    g.style.opacity = (0.5 * k).toFixed(3); g.style.transform = `scaleY(${(0.4 + 0.6 * k).toFixed(3)})`;
    o.style.opacity = '0';
  };
  const pullTo = r => {
    raw = r; clearTimeout(springT);
    nav.classList.remove('spring'); nav.classList.add('pulling'); shell.classList.add('pulling');
    if (!frame) frame = requestAnimationFrame(paint);
  };
  const release = () => {
    if (!raw && !nav.classList.contains('pulling')) return;
    raw = 0; side = 0; cancelAnimationFrame(frame); frame = 0;
    nav.classList.remove('pulling'); shell.classList.remove('pulling'); nav.classList.add('spring');
    [...nav.children].forEach(el => { el.style.setProperty('--tx', '0px'); el.style.setProperty('--sx', '1'); });
    glowL.style.opacity = glowR.style.opacity = '0'; glowL.style.transform = glowR.style.transform = '';
    clearTimeout(springT); springT = setTimeout(() => nav.classList.remove('spring'), 680);
  };
  // touch
  let x0 = 0, y0 = 0, lastX = 0, lock = null;
  nav.addEventListener('touchstart', e => {
    if (reduced() || e.touches.length !== 1) return;
    const t = e.touches[0]; x0 = lastX = t.clientX; y0 = t.clientY; lock = null;
  }, { passive: true });
  nav.addEventListener('touchmove', e => {
    if (reduced() || e.touches.length !== 1) return;
    const t = e.touches[0], dx = t.clientX - lastX; lastX = t.clientX;
    if (!lock) { if (Math.abs(t.clientX - x0) + Math.abs(t.clientY - y0) < 6) return; lock = Math.abs(t.clientX - x0) > Math.abs(t.clientY - y0) ? 'x' : 'y'; }
    if (lock !== 'x') return;
    if (side) {
      const r = raw + dx;
      if (r * side <= 0) { release(); return; }     // pushed back past zero: hand control to native scroll
      e.preventDefault(); pullTo(r); return;
    }
    if (dx > 0 && atL()) { side = 1; e.preventDefault(); pullTo(dx); }
    else if (dx < 0 && atR()) { side = -1; e.preventDefault(); pullTo(dx); }
  }, { passive: false });
  nav.addEventListener('touchend', release, { passive: true });
  nav.addEventListener('touchcancel', release, { passive: true });
  // trackpad / shift+wheel
  let wheelT = 0;
  nav.addEventListener('wheel', e => {
    if (reduced()) return;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    if (!d) return;
    if (side) {
      const r = raw - d;
      if (r * side <= 0) { release(); return; }
      e.preventDefault(); pullTo(r);
    } else if (d < 0 && atL()) { side = 1; e.preventDefault(); pullTo(-d); }
    else if (d > 0 && atR()) { side = -1; e.preventDefault(); pullTo(-d); }
    else return;
    clearTimeout(wheelT); wheelT = setTimeout(release, 140);
  }, { passive: false });
})();
