/* ==========================================================================
   MAGNÉSENS · animations (GSAP + ScrollTrigger + Lenis, servis en local)
   Règles : transform / opacity d'abord, courbes douces (expo / power3),
   stagger partout, prefers-reduced-motion respecté, rien ne casse sans JS.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = !!(window.gsap && window.ScrollTrigger);
  const PHONE = '+33663119362';
  const root = document.documentElement;

  /* ---------- Utilitaires de découpe de texte ---------- */
  function splitWords(el) {
    const text = el.textContent.trim().replace(/\s+/g, ' ');
    el.setAttribute('aria-label', text);
    el.innerHTML = text.split(' ').map(w => `<span class="w" aria-hidden="true"><span class="wi">${w}</span></span>`).join(' ');
    return $$('.wi', el);
  }
  function splitChars(el) {
    const chars = [];
    (function walk(node) {
      Array.from(node.childNodes).forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(tok => {
            if (tok === '' || /^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(tok)); return; }
            const w = document.createElement('span');
            w.className = 'sw'; w.setAttribute('aria-hidden', 'true');
            Array.from(tok).forEach(ch => {
              const c = document.createElement('span');
              c.className = 'sc'; c.textContent = ch; w.appendChild(c); chars.push(c);
            });
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    })(el);
    return chars;
  }

  /* ---------- Fonctions indépendantes de GSAP (marchent même sans animations) ---------- */
  function initHours() {
    const fmt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
    const p = Object.fromEntries(fmt.formatToParts(new Date()).map(x => [x.type, x.value]));
    const wd = (p.weekday || '').toLowerCase();
    const map = { lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6, dim: 0 };
    const day = map[wd.slice(0, 3)];
    const t = (parseInt(p.hour, 10) || 0) + (parseInt(p.minute, 10) || 0) / 60;
    const open = (day === 1 || day === 3) && ((t >= 9 && t < 13) || (t >= 14 && t < 18));
    const badge = $('#openBadge');
    if (badge) {
      badge.textContent = open ? 'Ouvert maintenant' : 'Fermé actuellement';
      badge.classList.toggle('is-open', open);
    }
    const li = $(`#hours li[data-d="${day}"]`);
    if (li) li.classList.add('is-today');
  }

  function initBooking() {
    const form = $('#bookForm'); if (!form) return;
    const daysBox = $('#bkDays'), hoursBox = $('#bkHours');
    const soin = $('#bkSoin'), nom = $('#bkNom'), prev = $('#bkPreview'), sms = $('#bkSms'), copy = $('#bkCopy');
    const fmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    // 8 prochains lundis / mercredis + week-end sur demande
    const days = [];
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + 1);
    while (days.length < 8) { if (d.getDay() === 1 || d.getDay() === 3) days.push(new Date(d)); d.setDate(d.getDate() + 1); }
    const dayLabels = days.map(x => fmt.format(x));
    dayLabels.push('Samedi ou dimanche (sur demande)');
    daysBox.innerHTML = dayLabels.map((l, i) => `<label class="chip"><input type="radio" name="bkDay" value="${l}" ${i === 0 ? 'checked' : ''}><span>${l.charAt(0).toUpperCase() + l.slice(1)}</span></label>`).join('');
    const hours = ['9h', '10h', '11h', '12h', '14h', '15h', '16h', '17h'];
    hoursBox.innerHTML = hours.map((h, i) => `<label class="chip"><input type="radio" name="bkHour" value="${h}" ${i === 2 ? 'checked' : ''}><span>${h}</span></label>`).join('');

    const build = () => {
      const day = (form.querySelector('input[name="bkDay"]:checked') || {}).value || 'à convenir';
      const hour = (form.querySelector('input[name="bkHour"]:checked') || {}).value || 'à convenir';
      const who = nom.value.trim();
      const msg = `Bonjour Nadia, je souhaiterais réserver le ${soin.value}, ${day} à ${hour}.${who ? ' Mon nom : ' + who + '.' : ''} Pouvez-vous me confirmer ce créneau ? Merci !`;
      prev.textContent = msg;
      sms.setAttribute('href', `sms:${PHONE}?&body=${encodeURIComponent(msg)}`);
      return msg;
    };
    form.addEventListener('input', build);
    form.addEventListener('change', build);
    build();

    copy.addEventListener('click', async () => {
      const msg = build();
      try { await navigator.clipboard.writeText(msg); copy.textContent = 'Message copié ✓'; }
      catch (e) { const r = document.createRange(); r.selectNodeContents(prev); const s = getSelection(); s.removeAllRanges(); s.addRange(r); copy.textContent = 'Texte sélectionné'; }
      setTimeout(() => (copy.textContent = 'Copier le message'), 2200);
    });
  }

  function initOfferExpiry() {
    // L'offre « −10 € » est valable en novembre et décembre 2026 : elle disparaît toute seule ensuite.
    if (Date.now() >= new Date('2027-01-01T00:00:00+01:00').getTime()) {
      const o = $('#offre'); if (o) o.remove();
    }
  }

  function initReviews() {
    const track = $('#reviewsTrack'); if (!track) return;
    const cards = $$('.rev', track), dots = $('#revDots');
    dots.innerHTML = cards.map(() => '<i></i>').join('');
    const dotEls = $$('i', dots);
    const step = () => (cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth);
    const index = () => Math.round(track.scrollLeft / step());
    const sync = () => dotEls.forEach((el, i) => el.classList.toggle('is-on', i === Math.min(index(), cards.length - 1)));
    track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    $('#revNext').addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    $('#revPrev').addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    track.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') track.scrollBy({ left: step(), behavior: 'smooth' });
      if (e.key === 'ArrowLeft') track.scrollBy({ left: -step(), behavior: 'smooth' });
    });
    // défilement doux automatique (désactivé en mouvement réduit / au survol)
    if (!reduce && 'IntersectionObserver' in window) {
      let hover = false, visible = false;
      track.addEventListener('pointerenter', () => (hover = true));
      track.addEventListener('pointerleave', () => (hover = false));
      track.addEventListener('focusin', () => (hover = true));
      new IntersectionObserver(es => {
        visible = es[0].isIntersecting;
        if (visible) track.scrollTo({ left: 0, behavior: 'auto' }); // on commence toujours par l'avis réel
      }, { threshold: .6 }).observe(track);
      setInterval(() => {
        if (hover || !visible || document.hidden) return;
        const maxLeft = track.scrollWidth - track.clientWidth - 4;
        const atEnd = track.scrollLeft >= maxLeft;
        track.scrollTo({ left: atEnd ? 0 : track.scrollLeft + step(), behavior: 'smooth' });
      }, 6000);
    }
    sync();
  }

  function initHeroVideo() {
    const v = $('#heroVideo'); if (!v) return;
    const wide = window.innerWidth >= 900;
    const saver = navigator.connection && navigator.connection.saveData;
    if (reduce || saver) { v.removeAttribute('autoplay'); v.pause(); v.preload = 'none'; return; }
    if (wide) { v.src = 'video/hero-2048.mp4'; v.load(); }
    v.muted = true; v.playbackRate = 0.85;
    const play = () => v.play().catch(() => { /* image de secours = poster */ });
    play();
    document.addEventListener('visibilitychange', () => (document.hidden ? v.pause() : play()));
  }

  /* ---------- Menu mobile ---------- */
  function initMenu(lenis) {
    const burger = $('#burger'), menu = $('#menu'), nav = $('#nav');
    if (!burger || !menu) return;
    const set = open => {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      nav.classList.remove('is-hidden');
      if (lenis) open ? lenis.stop() : lenis.start();
      else document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => set(burger.getAttribute('aria-expanded') !== 'true'));
    $$('a', menu).forEach(a => a.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  }

  /* ---------- Ancres ---------- */
  function initAnchors(lenis) {
    $$('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const id = a.getAttribute('href');
        if (id.length < 2) return;
        const target = $(id); if (!target) return;
        e.preventDefault();
        if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4) });
        else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
      });
    });
  }

  /* ---------- Boutons magnétiques & tilt 3D ---------- */
  function initMagnetic() {
    if (!finePointer || reduce) return;
    $$('[data-magnetic]').forEach(el => {
      const xTo = gsap.quickTo(el, 'x', { duration: .7, ease: 'elastic.out(1, .55)' });
      const yTo = gsap.quickTo(el, 'y', { duration: .7, ease: 'elastic.out(1, .55)' });
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * .32);
        yTo((e.clientY - (r.top + r.height / 2)) * .4);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }
  function initTilt() {
    if (!finePointer || reduce) return;
    $$('[data-tilt]').forEach(el => {
      gsap.set(el, { transformPerspective: 900 });
      const glare = $('.glare', el);
      const rx = gsap.quickTo(el, 'rotationX', { duration: .6, ease: 'power3.out' });
      const ry = gsap.quickTo(el, 'rotationY', { duration: .6, ease: 'power3.out' });
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        rx((.5 - py) * 9); ry((px - .5) * 11);
        if (glare) gsap.to(glare, { x: px * r.width, y: py * r.height, opacity: .6, duration: .45, ease: 'power3.out', overwrite: 'auto' });
      });
      el.addEventListener('pointerleave', () => {
        rx(0); ry(0);
        if (glare) gsap.to(glare, { opacity: 0, duration: .6, overwrite: 'auto' });
      });
    });
  }

  /* ==========================================================================
     Mise en scène principale (GSAP)
     Ordre de création = ordre sur la page (les sections pinnées avant ce qui suit).
     ========================================================================== */
  function initMotion() {
    gsap.registerPlugin(ScrollTrigger);
    gsap.defaults({ ease: 'power3.out' });

    /* Lenis (smooth scroll, inertie douce) */
    let lenis = null;
    if (!reduce && window.Lenis) {
      lenis = new Lenis({ lerp: .09, wheelMultiplier: .95, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    initAnchors(lenis);
    initMenu(lenis);

    /* Barre de progression de lecture */
    gsap.to('.progress i', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .2 } });

    /* Navigation : se cache en descendant, revient en remontant */
    const nav = $('#nav');
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: self => {
        const y = self.scroll();
        nav.classList.toggle('is-solid', y > 60);
        const menuOpen = $('#menu').classList.contains('is-open');
        nav.classList.toggle('is-hidden', !menuOpen && self.direction === 1 && y > 260);
      }
    });

    /* ---------- Loader -> Hero ---------- */
    const heroChars = splitChars($('#heroTitle'));
    const loaderChars = splitChars($('#loaderWord'));
    const footerChars = splitChars($('#footerBig'));
    const heroBits = ['.hero__eyebrow', '.hero__lead', '.hero__cta > *', '.hero__badge'];
    const loader = $('#loader');
    const endLoader = () => { loader.remove(); ScrollTrigger.refresh(); };

    if (reduce) {
      // Mouvement réduit : tout est visible tout de suite, aucune animation de scroll.
      loader.remove();
      $$('[data-count]').forEach(el => { el.textContent = parseFloat(el.dataset.count).toFixed(parseInt(el.dataset.dec || '0', 10)).replace('.', ','); });
      const fab = $('#fab'); if (fab) fab.classList.add('is-on');
      return;
    } else {
      gsap.set(heroChars, { yPercent: 118, rotate: 5 });
      gsap.set(heroBits, { opacity: 0, y: 30 });
      gsap.set(nav, { yPercent: -100 });
      gsap.set(loaderChars, { yPercent: 115 });
      gsap.set('.loader__tag', { opacity: 0, y: 12 });

      const heroIntro = () => {
        gsap.timeline({ defaults: { ease: 'expo.out' } })
          .to(heroChars, { yPercent: 0, rotate: 0, duration: 1.4, stagger: .025 })
          .to('.hero__eyebrow', { opacity: 1, y: 0, duration: 1 }, '-=1.1')
          .to('.hero__lead', { opacity: 1, y: 0, duration: 1 }, '-=0.9')
          .to('.hero__cta > *', { opacity: 1, y: 0, duration: 1, stagger: .1 }, '-=0.8')
          .to('.hero__badge', { opacity: 1, y: 0, duration: 1.1 }, '-=0.8')
          .to(nav, { yPercent: 0, duration: 1.1, clearProps: 'transform' }, '-=1');
      };

      gsap.timeline({ onComplete: endLoader })
        .to('.lm-path', { strokeDashoffset: 0, duration: .9, stagger: .08, ease: 'power2.inOut' })
        .to(loaderChars, { yPercent: 0, duration: .8, stagger: .035, ease: 'expo.out' }, '-=.7')
        .to('.loader__tag', { opacity: 1, y: 0, duration: .5 }, '-=.4')
        .to('.loader__inner', { opacity: 0, y: -24, duration: .4, ease: 'power2.in' }, '+=.2')
        .to('.loader__panel--t', { yPercent: -101, duration: .95, ease: 'expo.inOut' }, '>-.05')
        .to('.loader__panel--b', { yPercent: 101, duration: .95, ease: 'expo.inOut' }, '<')
        .add(heroIntro, '-=.55');
    }

    /* ---------- Parallax multicouche du hero ---------- */
    const heroST = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
    gsap.to('#heroBg', { yPercent: 16, ease: 'none', scrollTrigger: heroST });
    gsap.to('.ld-1', { yPercent: -60, ease: 'none', scrollTrigger: heroST });
    gsap.to('.ld-2', { yPercent: -110, ease: 'none', scrollTrigger: heroST });
    gsap.to('.ld-3', { yPercent: -35, ease: 'none', scrollTrigger: heroST });
    gsap.to('.hero__content', { yPercent: -16, opacity: .2, ease: 'none', scrollTrigger: heroST });
    gsap.to('.hero__badge', { yPercent: -80, ease: 'none', scrollTrigger: heroST });

    /* ---------- Marquee réactif à la vitesse et au sens du scroll ---------- */
    const rows = $$('.marquee__row').map(row => {
      const track = $('.marquee__track', row);
      track.style.animation = 'none';
      const base = parseFloat(row.dataset.dir) || -1;
      const tween = gsap.fromTo(track, { xPercent: base < 0 ? 0 : -50 }, { xPercent: base < 0 ? -50 : 0, duration: 42, ease: 'none', repeat: -1 });
      return { tween };
    });
    ScrollTrigger.create({
      trigger: '.marquee', start: 'top bottom', end: 'bottom top',
      onUpdate: self => {
        const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 260, 7);
        const dir = self.direction;
        rows.forEach(r => {
          gsap.to(r.tween, { timeScale: dir * boost, duration: .3, overwrite: true });
          gsap.to(r.tween, { timeScale: dir, duration: 1.4, delay: .3, ease: 'power2.out' });
        });
      }
    });

    /* ==========================================================================
       Expériences pinnées (desktop, mouvement autorisé) : créées AVANT le reste
       ========================================================================== */
    const mm = gsap.matchMedia();

    mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
      root.classList.add('has-pin');

      /* 1. Storytelling pinné : 4 temps, images en rideau */
      const steps = $$('.step'), imgs = $$('.story__img');
      gsap.set(steps.slice(1), { opacity: 0, y: 50 });
      gsap.set(imgs.slice(1), { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.25 });
      gsap.set(imgs[0], { scale: 1.08 });
      const tl = gsap.timeline({
        defaults: { ease: 'power3.inOut' },
        scrollTrigger: { trigger: '.story', start: 'top top', end: '+=320%', pin: '.story__pin', scrub: .7, anticipatePin: 1 }
      });
      steps.forEach((s, i) => {
        if (i === 0) return;
        const at = i * 1.4;
        tl.to(steps[i - 1], { opacity: 0, y: -50, duration: .6 }, at - .2)
          .to(imgs[i - 1], { scale: 1.12, duration: 1.2, ease: 'none' }, at - .4)
          .to(imgs[i], { clipPath: 'inset(0% 0% 0% 0%)', scale: 1.05, duration: 1.1 }, at - .3)
          .to(s, { opacity: 1, y: 0, duration: .8 }, at + .3);
      });
      tl.to('.story__bar i', { scaleX: 1, duration: tl.duration(), ease: 'none' }, 0);
      tl.to({}, { duration: .6 }); // temps de respiration sur la dernière étape

      /* 2. Défilement horizontal piloté par le scroll vertical */
      const track = $('#ritualsTrack');
      const dist = () => Math.max(0, track.scrollWidth - document.documentElement.clientWidth + 40);
      const h = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: '.rituals', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 }
      });
      $$('.card__media img').forEach(img => {
        gsap.fromTo(img, { xPercent: -7 }, { xPercent: 7, ease: 'none', scrollTrigger: { trigger: img.closest('.card'), containerAnimation: h, start: 'left right', end: 'right left', scrub: true } });
      });
      gsap.to('.rituals__progress i', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.rituals', start: 'top top', end: () => '+=' + dist(), scrub: true } });

      return () => root.classList.remove('has-pin');
    });

    /* Mobile / tablette (mouvement autorisé) : versions allégées */
    mm.add('(max-width: 899px) and (prefers-reduced-motion: no-preference)', () => {
      $$('.step').forEach(s => gsap.from(s, { opacity: 0, y: 50, duration: 1.1, scrollTrigger: { trigger: s, start: 'top 88%', once: true } }));
      $$('.step__img').forEach(el => gsap.from(el, { clipPath: 'inset(0 0 100% 0)', duration: 1.4, ease: 'expo.inOut', scrollTrigger: { trigger: el, start: 'top 88%', once: true } }));
      gsap.from('.card', { opacity: 0, x: 60, duration: 1.1, stagger: .1, scrollTrigger: { trigger: '.rituals__track', start: 'top 88%', once: true } });
    });

    /* ==========================================================================
       Tout le reste, dans l'ordre de la page
       ========================================================================== */
    $$('[data-split]').forEach(el => {
      const words = splitWords(el);
      gsap.from(words, { yPercent: 112, duration: 1.2, ease: 'expo.out', stagger: .07, scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
      const line = el.previousElementSibling && el.previousElementSibling.querySelector && el.previousElementSibling.querySelector('.eyebrow__line');
      if (line) gsap.from(line, { scaleX: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
    });
    $$('[data-reveal]').forEach(el => {
      gsap.from(el, { opacity: 0, y: 46, duration: 1.2, ease: 'power3.out', delay: parseFloat(el.dataset.delay) || 0, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });
    $$('[data-mask]').forEach(el => {
      const img = $('img', el);
      gsap.fromTo(el, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
      if (img && !img.hasAttribute('data-parallax')) gsap.fromTo(img, { scale: 1.3 }, { scale: 1, duration: 2.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
    $$('[data-parallax]').forEach(img => {
      gsap.fromTo(img, { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    /* Offre : cercle qui s'agrandit + « −10 € » */
    if ($('.offer__circle')) {
      gsap.fromTo('.offer__circle', { scale: 0 }, { scale: 1, duration: 2, ease: 'expo.out', scrollTrigger: { trigger: '.offer', start: 'top 70%', once: true } });
      gsap.from('.offer__minus', { yPercent: 40, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.offer', start: 'top 65%', once: true } });
      gsap.from('.offer__sub, .offer__text, .offer__cta > *', { y: 40, opacity: 0, duration: 1.1, stagger: .12, scrollTrigger: { trigger: '.offer', start: 'top 60%', once: true } });
    }

    /* Compteurs */
    $$('[data-count]').forEach(el => {
      const end = parseFloat(el.dataset.count), dec = parseInt(el.dataset.dec || '0', 10);
      const o = { v: 0 };
      const render = () => { el.textContent = o.v.toFixed(dec).replace('.', ','); };
      ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => gsap.to(o, { v: end, duration: 2.4, ease: 'power3.out', onUpdate: render }) });
    });
    gsap.from('.stat', { opacity: 0, y: 50, duration: 1.2, stagger: .12, scrollTrigger: { trigger: '.stats__grid', start: 'top 85%', once: true } });

    /* Beurres Green Spa : le disque s'ouvre au scroll */
    gsap.fromTo('#scentsDisc', { clipPath: 'circle(8% at 50% 50%)' }, { clipPath: 'circle(72% at 50% 50%)', ease: 'none', scrollTrigger: { trigger: '.scents__visual', start: 'top 85%', end: 'center 45%', scrub: .6 } });
    gsap.fromTo('.scents__disc img', { scale: 1.4 }, { scale: 1.05, ease: 'none', scrollTrigger: { trigger: '.scents__visual', start: 'top 85%', end: 'bottom top', scrub: true } });
    gsap.to('[data-float]', { yPercent: -35, ease: 'none', scrollTrigger: { trigger: '.scents', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.from('.scent-list i', { scale: 0, duration: .9, ease: 'back.out(2)', stagger: .15, scrollTrigger: { trigger: '.scent-list', start: 'top 80%', once: true } });

    /* Avis : entrée en cascade */
    gsap.from('.rev', { opacity: 0, y: 70, rotate: 2, duration: 1.3, ease: 'expo.out', stagger: .14, scrollTrigger: { trigger: '.reviews__track', start: 'top 85%', once: true } });
    gsap.from('.rating', { opacity: 0, x: 40, duration: 1.2, scrollTrigger: { trigger: '.rating', start: 'top 92%', once: true } });

    /* Réservation : halo qui dérive */
    gsap.fromTo('.book__glow', { xPercent: -10, yPercent: 10 }, { xPercent: 25, yPercent: -25, ease: 'none', scrollTrigger: { trigger: '.book', start: 'top bottom', end: 'bottom top', scrub: true } });

    /* Footer : le grand nom se lève lettre par lettre */
    gsap.from(footerChars, { yPercent: 105, duration: 1.6, ease: 'expo.out', stagger: .06, scrollTrigger: { trigger: '#footerBig', start: 'top 92%', once: true } });

    /* Bouton d'appel flottant : apparaît après le hero */
    ScrollTrigger.create({ trigger: '.marquee', start: 'top 85%', end: 'max', onToggle: s => $('#fab').classList.toggle('is-on', s.isActive) });

    /* Rafraîchir quand tout est chargé (polices, images, vidéo) */
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener('load', refresh);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(refresh, 250); });
  }

  /* ---------- Démarrage ---------- */
  function boot() {
    initHours();
    initBooking();
    initOfferExpiry();
    initReviews();
    initHeroVideo();
    if (hasGSAP) {
      try { initMotion(); initMagnetic(); initTilt(); }
      catch (err) {
        console.error('[Magnésens] animations désactivées :', err);
        const l = $('#loader'); if (l) l.remove();
      }
    } else {
      const l = $('#loader'); if (l) l.remove();
      initMenu(null); initAnchors(null);
      const fab = $('#fab'); if (fab) fab.classList.add('is-on');
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
