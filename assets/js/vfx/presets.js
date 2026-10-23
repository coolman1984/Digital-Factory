/* DFMotion: animation presets on GSAP, with the page's own loop as the only clock.
   drive(): detach GSAP's ticker; the page calls DFMotion.tick(now) inside its requestAnimationFrame, so tweens,
   camera moves and the frame they are drawn in always agree (no second loop, no tearing between them).
   Presets are timelines built from data, so the same entrance or camera move reads the same on every page, and
   each one has a reduced-motion form (a short fade or a cut). */
(function () {
  let driven = false;
  const reduce = () => (window.DFPerf ? DFPerf.reduceMotion() : matchMedia('(prefers-reduced-motion: reduce)').matches);
  function drive() { if (driven || !window.gsap) return; gsap.ticker.remove(gsap.updateRoot); driven = true; }
  function tick(now) { if (driven) gsap.updateRoot(now / 1000); }

  const EASE = { enter: 'expo.out', exit: 'power2.in', move: 'power3.inOut', settle: 'back.out(1.4)', drift: 'sine.inOut', snap: 'power4.out' };

  // camera: fly a camera and its orbit target together (one timeline), or cut when motion is reduced
  function camera(cam, target, to, o = {}) {
    const tl = gsap.timeline({ defaults: { ease: o.ease || EASE.move }, onUpdate: o.onUpdate, onComplete: o.onComplete });
    if (reduce() || o.cut) { tl.set(cam.position, { x: to.pos[0], y: to.pos[1], z: to.pos[2] }, 0).set(target, { x: to.look[0], y: to.look[1], z: to.look[2] }, 0); return tl; }
    const d = o.duration || 1.6;
    tl.to(cam.position, { x: to.pos[0], y: to.pos[1], z: to.pos[2], duration: d }, 0).to(target, { x: to.look[0], y: to.look[1], z: to.look[2], duration: d }, 0);
    if (to.fov && cam.fov !== undefined) tl.to(cam, { fov: to.fov, duration: d, onUpdate: () => cam.updateProjectionMatrix() }, 0);
    return tl;
  }
  // a sequence of shots: each { pos, look, fov?, d (move seconds), hold (seconds) }
  function shots(cam, target, list, o = {}) {
    const tl = gsap.timeline({ paused: !!o.paused, repeat: o.repeat ?? 0, onUpdate: o.onUpdate });
    for (const s of list) {
      tl.to(cam.position, { x: s.pos[0], y: s.pos[1], z: s.pos[2], duration: s.d || 4, ease: s.ease || EASE.move });
      tl.to(target, { x: s.look[0], y: s.look[1], z: s.look[2], duration: s.d || 4, ease: s.ease || EASE.move }, '<');
      if (s.fov) tl.to(cam, { fov: s.fov, duration: s.d || 4, ease: EASE.drift, onUpdate: () => cam.updateProjectionMatrix() }, '<');
      if (s.hold) tl.to({}, { duration: s.hold });
    }
    return tl;
  }
  // DOM and 2D entrances: rise, reveal, stagger, typewriter-free letter cascade
  function rise(targets, o = {}) { return reduce() ? gsap.fromTo(targets, { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.03 }) : gsap.fromTo(targets, { y: o.y ?? 24, opacity: 0 }, { y: 0, opacity: 1, duration: o.duration || 0.9, ease: EASE.enter, stagger: o.stagger ?? 0.06, delay: o.delay || 0 }); }
  function cascade(items, prop, o = {}) {
    // items are any objects with numeric props (Pixi letters, three objects): from offset to rest
    const from = Object.assign({ alpha: 0 }, o.from), to = Object.assign({ alpha: 1, duration: o.duration || 0.8, ease: o.ease || EASE.settle, stagger: o.stagger ?? 0.035 }, o.to);
    if (reduce()) return gsap.fromTo(items, { alpha: 0 }, { alpha: 1, duration: 0.25 });
    return gsap.fromTo(items, from, to);
  }

  window.DFMotion = { drive, tick, EASE, camera, shots, rise, cascade, reduce };
})();
