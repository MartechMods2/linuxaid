const hero = document.querySelector('[data-kinetic-hero]');

if (hero) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const stage = document.createElement('div');
  stage.className = 'kinetic-stage';
  stage.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  stage.appendChild(canvas);
  hero.prepend(stage);

  const ctx = canvas.getContext('2d', { alpha:true });
  const lines = [
    hero.querySelector('.kinetic-kicker'),
    hero.querySelector('.hero-title'),
    hero.querySelector('.hero-lead'),
    hero.querySelector('.kinetic-proof'),
    hero.querySelector('.hero-actions')
  ].filter(Boolean);

  lines.forEach((node, index) => {
    node.classList.add('kinetic-line');
    node.style.setProperty('--kinetic-delay', `${index * 58}ms`);
  });

  let width = 0;
  let height = 0;
  let dpr = 1;
  let mode = 'stable';
  let frame = 0;
  let cycleTimer = null;
  let phaseTimer = null;
  let visible = true;
  const pointer = { x:-9999, y:-9999, active:false };

  const seedRandom = (() => {
    let seed = 0x1a2b3c4d;
    return () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  })();

  const particles = Array.from({ length:56 }, (_, index) => ({
    index,
    u:seedRandom(),
    v:seedRandom(),
    jitter:seedRandom(),
    radius:1.1 + Math.pow(seedRandom(), 2.2) * 9,
    x:0,
    y:0,
    vx:0,
    vy:0,
    alpha:0,
    targetAlpha:.28 + seedRandom() * .68,
    delay:seedRandom() * .24
  }));

  function layoutParticle(particle) {
    const compact = width < 760;
    const bandLeft = compact ? .50 : .61;
    const bandWidth = compact ? .44 : .34;
    const vertical = .10 + particle.v * .80;
    // A loose crescent/constellation rather than a rectangular particle field.
    const curve = Math.sin((vertical - .08) * Math.PI) * .105;
    const scatter = (particle.u - .5) * bandWidth;
    const x = width * (bandLeft + bandWidth * .56 + curve + scatter * .78);
    const y = height * vertical + Math.sin(particle.index * 1.93) * 9;
    return { x, y };
  }

  function resize() {
    const rect = hero.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    particles.forEach((particle) => {
      const target = layoutParticle(particle);
      if (!particle.x && !particle.y) {
        particle.x = target.x + (seedRandom() - .5) * 80;
        particle.y = height * (.52 + (seedRandom() - .5) * .12);
      }
    });
  }

  function particleTarget(particle) {
    const base = layoutParticle(particle);
    if (mode === 'exit') {
      const centerX = width * .78;
      const dx = base.x - centerX;
      return {
        x:base.x + dx * .95 + (particle.u - .5) * 65,
        y:base.y - height * (.50 + particle.jitter * .28),
        alpha:0
      };
    }
    if (mode === 'gap') {
      return { x:base.x, y:base.y - height * .18, alpha:0 };
    }
    return { x:base.x, y:base.y, alpha:particle.targetAlpha };
  }

  function resetParticlesForEntry() {
    particles.forEach((particle, index) => {
      particle.x = width * (.68 + (index % 5) * .012) + (particle.u - .5) * 42;
      particle.y = height * (.52 + (particle.v - .5) * .10);
      particle.vx = (particle.u - .5) * 1.4;
      particle.vy = (particle.v - .5) * 1.2;
      particle.alpha = 0;
    });
  }

  function themeParticleColor(alpha) {
    const light = document.body.classList.contains('light-theme');
    return light ? `rgba(10, 24, 18, ${alpha})` : `rgba(116, 255, 157, ${alpha})`;
  }

  function draw() {
    frame = requestAnimationFrame(draw);
    if (!visible || !ctx) return;
    ctx.clearRect(0, 0, width, height);

    const ease = mode === 'exit' ? .052 : mode === 'gap' ? .09 : .075;
    particles.forEach((particle) => {
      const target = particleTarget(particle);
      let tx = target.x;
      let ty = target.y;

      if (pointer.active && mode !== 'gap') {
        const dx = particle.x - pointer.x;
        const dy = particle.y - pointer.y;
        const dist = Math.hypot(dx, dy) || 1;
        const radius = 105;
        if (dist < radius) {
          const force = (1 - dist / radius) * 8;
          particle.vx += (dx / dist) * force;
          particle.vy += (dy / dist) * force;
        }
      }

      particle.vx += (tx - particle.x) * ease * .11;
      particle.vy += (ty - particle.y) * ease * .11;
      particle.vx *= .87;
      particle.vy *= .87;
      particle.x += (tx - particle.x) * ease + particle.vx;
      particle.y += (ty - particle.y) * ease + particle.vy;
      particle.alpha += (target.alpha - particle.alpha) * (mode === 'enter' ? .075 : .12);

      const pulse = 1 + Math.sin(performance.now() * .0012 + particle.index * .79) * .08;
      const r = particle.radius * pulse;
      if (particle.alpha <= .008) return;

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, r, 0, Math.PI * 2);
      ctx.fillStyle = themeParticleColor(Math.max(0, Math.min(1, particle.alpha)));
      ctx.fill();

      if (r > 5.5) {
        ctx.beginPath();
        ctx.arc(particle.x - r * .20, particle.y - r * .20, Math.max(1, r * .16), 0, Math.PI * 2);
        ctx.fillStyle = document.body.classList.contains('light-theme')
          ? `rgba(255,255,255,${particle.alpha * .3})`
          : `rgba(255,255,255,${particle.alpha * .22})`;
        ctx.fill();
      }
    });
  }

  function clearTimers() {
    if (cycleTimer) clearTimeout(cycleTimer);
    if (phaseTimer) clearTimeout(phaseTimer);
    cycleTimer = null;
    phaseTimer = null;
  }

  function enterSequence(initial = false) {
    if (reducedMotion.matches || document.hidden) return;
    hero.classList.remove('motion-out', 'motion-in');
    hero.classList.add('motion-reset');
    mode = 'gap';
    resetParticlesForEntry();

    requestAnimationFrame(() => requestAnimationFrame(() => {
      hero.classList.remove('motion-reset');
      hero.classList.add('motion-in');
      mode = 'enter';
      phaseTimer = setTimeout(() => {
        hero.classList.remove('motion-in');
        mode = 'stable';
        scheduleCycle(initial ? 3300 : 3900);
      }, 1050);
    }));
  }

  function runCycle() {
    if (reducedMotion.matches || document.hidden) return;
    hero.classList.add('motion-out');
    mode = 'exit';
    phaseTimer = setTimeout(() => {
      hero.classList.remove('motion-out');
      hero.classList.add('motion-reset');
      mode = 'gap';
      phaseTimer = setTimeout(() => enterSequence(false), 360);
    }, 850);
  }

  function scheduleCycle(delay = 3900) {
    clearTimeout(cycleTimer);
    cycleTimer = setTimeout(runCycle, delay);
  }

  function startMotion() {
    clearTimers();
    if (reducedMotion.matches) {
      mode = 'stable';
      hero.classList.remove('motion-out','motion-reset','motion-in');
      particles.forEach((particle) => { particle.alpha = particle.targetAlpha; });
      return;
    }
    enterSequence(true);
  }

  hero.addEventListener('pointermove', event => {
    const rect = hero.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = true;
  }, { passive:true });
  hero.addEventListener('pointerleave', () => { pointer.active = false; });

  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible) startMotion();
    else clearTimers();
  });

  reducedMotion.addEventListener?.('change', startMotion);
  const observer = new ResizeObserver(resize);
  observer.observe(hero);
  resize();
  draw();
  startMotion();

  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frame);
    clearTimers();
    observer.disconnect();
  }, { once:true });
}
