/* Digital Factory — website behaviour: the hero shutter and the lit name in the proof sentence */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // signature move: the twin opens like a shutter once fonts are ready
  const twin = document.querySelector('.twin');
  if (twin) (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(() => twin.classList.add('open')));

  // one name lit at a time; its sourced result shows beside the sentence
  const FIG = [
    ['−78%', 'Lead time at the Siemens electronics plant in Nanjing'],
    ['−40%', 'Defect rate at the Haier water-purifier factory in Qingdao'],
    ['≈50%', 'Faster factory setup and planning at Foxconn, by company estimate'],
    ['80%+', 'Fewer defects on average across Lighthouse factories']
  ];
  const names = [...document.querySelectorAll('[data-names] [data-n]')];
  const fig = document.querySelector('[data-fig]'), figl = document.querySelector('[data-figl]');
  if (!names.length || !fig) return;
  let k = 0;
  const lite = n => {
    names.forEach((e, i) => e.classList.toggle('lit', i === n));
    fig.textContent = FIG[n][0]; figl.textContent = FIG[n][1];
  };
  lite(0);
  if (reduce) return;
  let timer = null;
  new IntersectionObserver(es => {
    if (es[es.length - 1].isIntersecting) { if (!timer) timer = setInterval(() => lite(k = (k + 1) % names.length), 2600); }
    else { clearInterval(timer); timer = null; }
  }).observe(names[0].parentElement);
})();
