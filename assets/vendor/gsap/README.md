# GSAP 3.15.0 (vendored)

`gsap.min.js` and `CustomEase.min.js` from the npm package `gsap@3.15.0`, unmodified.

Licence: GreenSock's Standard "no charge" licence (https://gsap.com/standard-license). Free for commercial use, including
client work. The one restriction that matters to us: GSAP may not be used in a product that competes with Webflow's
visual website builder. Digital Factory is not one. The licence header stays in each file.

How we use it: GSAP is never the clock. Pages call `gsap.ticker.remove(gsap.updateRoot)` and advance GSAP from their own
render loop (`assets/js/vfx/presets.js`, `DFMotion.drive`), so one requestAnimationFrame drives tweens and frames together.
