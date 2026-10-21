/* Digital Factory — Live plant page: records the shift for the presentation's time-window review.
   Saves the recording to this browser every few seconds (localStorage "df-rec-live"). Simulated data. */
(function () {
  'use strict';
  if (!window.Plant || !window.PlantRecorder) return;
  const rec = PlantRecorder.create(Plant.E, Plant.X, Plant.AG, { source: 'live' });
  const save = () => { try { localStorage.setItem('df-rec-live', JSON.stringify(rec.snapshot())); } catch (e) { /* storage full or blocked */ } };
  setInterval(save, 4000);
  addEventListener('pagehide', save);
  Plant.rec = rec;
})();
