/* notes-site/assets/site.js — theme, reading progress, TOC scrollspy, contents sheet, search, offline. */
(() => {
  const root = document.documentElement;
  const BASE = root.dataset.base || '';
  const $ = (s, el = document) => el.querySelector(s);
  const mq = matchMedia('(prefers-color-scheme: dark)');

  // ---- theme ------------------------------------------------------------
  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : mq.matches);
  const syncThemeColor = () => {
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { m.content = bg; m.removeAttribute('media'); });
  };
  $('#theme-btn')?.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('notes-theme', next); } catch (e) { /* private mode */ }
    syncThemeColor();
  });
  mq.addEventListener?.('change', syncThemeColor);
  syncThemeColor();

  // ---- reading progress -------------------------------------------------
  const bar = $('#progress');
  const headerPx = () => (parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 3.25) * (parseFloat(getComputedStyle(root).fontSize) || 16);
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (bar) {
        const h = root.scrollHeight - innerHeight;
        bar.style.width = (h > 0 ? Math.min(100, Math.max(0, (scrollY / h) * 100)) : 0) + '%';
      }
      spy();
    });
  };

  // ---- scrollspy for the desktop table of contents ----------------------
  const toc = $('#toc');
  const tocLinks = new Map();
  let heads = [];
  if (toc) {
    toc.querySelectorAll('a[href^="#"]').forEach((a) => {
      const id = decodeURIComponent(a.getAttribute('href').slice(1));
      const el = document.getElementById(id);
      if (el) { tocLinks.set(id, a); heads.push(el); }
    });
  }
  let activeId = null;
  function spy() {
    if (!heads.length) return;
    const y = scrollY + headerPx() + 28;
    let cur = heads[0];
    for (const h of heads) { if (h.offsetTop <= y) cur = h; else break; }
    if (cur.id === activeId) return;
    activeId = cur.id;
    tocLinks.forEach((a, id) => a.classList.toggle('active', id === activeId));
    const a = tocLinks.get(activeId);
    if (a) {
      const r = a.getBoundingClientRect(), t = toc.getBoundingClientRect();
      if (r.top < t.top || r.bottom > t.bottom) a.scrollIntoView({ block: 'nearest' });
    }
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  onScroll();

  // ---- contents sheet (phone / tablet) ----------------------------------
  const fab = $('#fab'), sheet = $('#sheet');
  const lock = (on) => document.body.classList.toggle('no-scroll', on);
  if (fab && sheet) {
    const open = () => { sheet.hidden = false; lock(true); };
    const close = () => { sheet.hidden = true; lock(false); };
    fab.addEventListener('click', open);
    sheet.addEventListener('click', (e) => { if (e.target === sheet || e.target.closest('a')) close(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) close(); });
  }

  // ---- search -----------------------------------------------------------
  const search = $('#search'), input = $('#search-input'), results = $('#search-results');
  let index = null, loading = null;
  const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const openSearch = () => {
    if (!search) return;
    search.hidden = false; lock(true);
    input.focus(); input.select();
    if (!index && !loading) {
      loading = fetch(BASE + '/search-index.json').then((r) => r.json()).then((j) => { index = j; run(); })
        .catch(() => { results.innerHTML = '<p class="sr-empty">Search index unavailable.</p>'; });
    }
  };
  const closeSearch = () => { if (!search) return; search.hidden = true; lock(false); };
  $('#search-btn')?.addEventListener('click', openSearch);
  search?.addEventListener('click', (e) => { if (e.target === search) closeSearch(); });
  addEventListener('keydown', (e) => {
    if (!search) return;
    if (e.key === 'Escape' && !search.hidden) { closeSearch(); return; }
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || '');
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !typing) { e.preventDefault(); openSearch(); }
    if (e.key === 'Enter' && !search.hidden) { const a = results.querySelector('a'); if (a) location.href = a.href; }
  });
  function snippet(text, q) {
    const i = text.toLowerCase().indexOf(q);
    if (i < 0) return escHtml(text.slice(0, 120));
    const a = Math.max(0, i - 48), b = Math.min(text.length, i + q.length + 72);
    return (a > 0 ? '…' : '') + escHtml(text.slice(a, i)) + '<b>' + escHtml(text.slice(i, i + q.length)) + '</b>' + escHtml(text.slice(i + q.length, b)) + (b < text.length ? '…' : '');
  }
  function run() {
    if (!index) return;
    const q = input.value.trim().toLowerCase();
    if (!q) { results.innerHTML = ''; return; }
    const hits = [];
    for (const p of index) {
      let score = 0, anchor = '', snip = '';
      if (p.t.toLowerCase().includes(q)) score += 5;
      const h = p.h.find((x) => x.t.toLowerCase().includes(q));
      if (h) { score += 3; anchor = '#' + encodeURIComponent(h.id); snip = h.t; }
      if (p.b.toLowerCase().includes(q)) { score += 1; if (!snip) snip = p.b; }
      if (score) hits.push({ p, score, anchor, snip });
    }
    hits.sort((a, b) => b.score - a.score);
    results.innerHTML = hits.length
      ? hits.slice(0, 20).map(({ p, anchor, snip }) =>
        `<a href="${p.u}${anchor}"><span class="sr-title">${escHtml(p.t)}</span>${p.s ? `<span class="sr-series">${escHtml(p.s)}</span>` : ''}${snip ? `<p class="sr-snip">${snippet(snip, q)}</p>` : ''}</a>`).join('')
      : '<p class="sr-empty">No matches.</p>';
  }
  input?.addEventListener('input', run);

  // ---- display math: switch to the phone layout, then shrink up to a quarter, before the box scrolls
  const fitMath = () => {
    document.querySelectorAll('.math-block').forEach((el) => {
      el.style.fontSize = '';
      el.classList.remove('use-narrow');
      let need = el.scrollWidth;
      const have = el.clientWidth;
      if (need > have && el.classList.contains('has-narrow')) { el.classList.add('use-narrow'); need = el.scrollWidth; }
      if (need <= have) return;
      const base = parseFloat(getComputedStyle(el).fontSize) / parseFloat(getComputedStyle(el.parentElement).fontSize);
      el.style.fontSize = (base * Math.max(0.7, (have / need) * 0.98) * 100).toFixed(1) + '%';
    });
  };
  fitMath();
  document.fonts?.ready.then(fitMath);
  let fitTimer;
  addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitMath, 120); });

  // ---- slide lightbox: tap a slide to fill the screen, swipe or arrow between slides
  const slides = [...document.querySelectorAll('.slide-open')];
  if (slides.length) {
    let box = null, cur = -1, swiped = false, x0 = null;
    const close = () => { if (swiped) { swiped = false; return; } box?.remove(); box = null; cur = -1; lock(false); };
    const show = (i) => {
      cur = (i + slides.length) % slides.length;
      const a = slides[cur], img = a.querySelector('img');
      if (!box) {
        box = document.createElement('div'); box.className = 'lightbox';
        box.innerHTML = '<img alt=""><div class="lightbox-cap"></div>';
        box.addEventListener('click', close);
        document.body.appendChild(box); lock(true);
      }
      const big = box.querySelector('img'); big.src = a.href; big.alt = img.alt;
      box.querySelector('.lightbox-cap').textContent = `${img.alt} · ${cur + 1} / ${slides.length}`;
    };
    slides.forEach((a, i) => a.addEventListener('click', (e) => { e.preventDefault(); show(i); }));
    addEventListener('keydown', (e) => { if (!box) return; if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') show(cur + 1); else if (e.key === 'ArrowLeft') show(cur - 1); });
    addEventListener('touchstart', (e) => { if (box) x0 = e.touches[0].clientX; }, { passive: true });
    addEventListener('touchend', (e) => {
      if (!box || x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) { swiped = true; show(cur + (dx < 0 ? 1 : -1)); setTimeout(() => { swiped = false; }, 400); }
    }, { passive: true });
  }

  // ---- offline: cache the shell and every page after the first visit -----
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register(BASE + '/sw.js', { scope: BASE + '/' }).catch(() => {});
  }
})();
