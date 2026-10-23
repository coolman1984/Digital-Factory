/* Problems and their fixes, drawn in the live plant's 3D view. It reads the plant; it never writes to it.
   - A problem (an open recommendation from the agents, P.recs) is a pulsing ring on the floor at the machine or store it
     names, red when critical and amber when it is a warning, with a column of light so it can be found from the overview.
   - Cause → effect: an arc from where the trouble starts to where it lands (an empty source to the station that will
     starve, a stopped SMD machine to the PBA lane to each main line it feeds), with dashes flowing toward the effect.
   - A fix on its way: the route of a technician walking to a stopped machine, and of an AGV on a hot run, in green with
     dashes moving the way they travel; a green ring turns at a machine being repaired.
   - Solved: when a problem clears, a green ring opens once at its place.
   Shown with the Status and Flow overlays; the columns of light step back while you walk the floor. */
(function () {
  function start() {
    const PL = window.Plant; if (!PL || !PL.V || !PL.V.THREE) return setTimeout(start, 400);
    const { E, V } = PL, T = V.THREE, P = E.P, FL = V.FL || 5.4;
    const group = new T.Group(); group.name = 'problems'; V.scene.add(group);
    const COL = { crit: new T.Color(0xFF3B3F), warn: new T.Color(0xFFB020), fix: new T.Color(0x2ED47A), info: new T.Color(0x4DA3FF) };
    const floorY = p => (p[1] > FL + 0.6 ? FL + 0.04 : 0.04);

    /* rings and columns: instanced, additive, never write depth */
    const ringGeo = new T.RingGeometry(0.82, 1, 64).rotateX(-Math.PI / 2);
    const additive = o => new T.MeshBasicMaterial(Object.assign({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, side: T.DoubleSide }, o));
    const rings = new T.InstancedMesh(ringGeo, additive({}), 96); rings.instanceColor = new T.InstancedBufferAttribute(new Float32Array(96 * 3), 3);
    const colGeo = new T.CylinderGeometry(0.5, 0.9, 16, 20, 1, true).translate(0, 8, 0);
    const colMat = new T.ShaderMaterial({
      uniforms: { time: { value: 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      vertexShader: `varying float vH; varying vec3 vC; void main() { vH = position.y / 16.0; vC = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float time; varying float vH; varying vec3 vC; void main() { float a = (1.0 - vH) * (1.0 - vH) * (0.55 + 0.45 * sin(time * 4.0 - vH * 6.0)); gl_FragColor = vec4(vC, a * 0.55); }`
    });
    const cols = new T.InstancedMesh(colGeo, colMat, 48); cols.instanceColor = new T.InstancedBufferAttribute(new Float32Array(48 * 3), 3);
    for (const m of [rings, cols]) { m.count = 0; m.frustumCulled = false; m.renderOrder = 7; m.raycast = () => {}; group.add(m); }

    /* arcs: a tube along a curve, dashes moving from start to end */
    const arcMat = color => new T.ShaderMaterial({
      uniforms: { time: { value: 0 }, color: { value: color.clone() }, len: { value: 10 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float time, len; uniform vec3 color; varying vec2 vUv;
        void main() { float d = fract(vUv.x * len / 1.6 - time * 1.4); float dash = smoothstep(0.0, 0.15, d) * (1.0 - smoothstep(0.55, 0.7, d));
          float ends = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.92, vUv.x); gl_FragColor = vec4(color, min(1.0, (0.3 + 0.9 * dash) * ends)); }`
    });
    const arcs = new Map();   // key → { mesh, keep }
    function arc(key, a, b, color, lift) {
      let e = arcs.get(key);
      const sig = a.map(v => v.toFixed(1)).join() + b.map(v => v.toFixed(1)).join();
      if (e && e.sig === sig) { e.keep = true; return; }
      if (e) { e.mesh.geometry.dispose(); e.mesh.material.dispose(); group.remove(e.mesh); }
      const A = new T.Vector3(...a), B = new T.Vector3(...b), d = A.distanceTo(B), mid = A.clone().lerp(B, 0.5); mid.y = Math.max(A.y, B.y) + (lift ?? Math.min(18, 2 + d * 0.22));
      const curve = new T.QuadraticBezierCurve3(A, mid, B);
      const mesh = new T.Mesh(new T.TubeGeometry(curve, Math.max(24, Math.round(d)), 0.14, 6), arcMat(color));
      mesh.material.uniforms.len.value = curve.getLength(); mesh.renderOrder = 8; mesh.frustumCulled = false; mesh.raycast = () => {};
      mesh.material.blending = document.documentElement.dataset.theme === 'dark' ? T.AdditiveBlending : T.NormalBlending;
      group.add(mesh); arcs.set(key, { mesh, keep: true, sig });
    }
    function route(key, pts, y, color) {
      // a path on the floor (a polyline), raised a little so it reads over the paint
      if (!pts || pts.length < 2) return;
      let e = arcs.get(key); const sig = pts.length + ':' + pts[pts.length - 1].join();
      if (e && e.sig === sig) { e.keep = true; return; }
      if (e) { e.mesh.geometry.dispose(); e.mesh.material.dispose(); group.remove(e.mesh); }
      const path = new T.CurvePath(); for (let i = 1; i < pts.length; i++) path.add(new T.LineCurve3(new T.Vector3(pts[i - 1][0], y + V.lvAt(pts[i - 1][0], pts[i - 1][1]) + 0.12, pts[i - 1][1]), new T.Vector3(pts[i][0], y + V.lvAt(pts[i][0], pts[i][1]) + 0.12, pts[i][1])));
      const mesh = new T.Mesh(new T.TubeGeometry(path, Math.max(16, pts.length * 6), 0.09, 5), arcMat(color));
      mesh.material.uniforms.len.value = path.getLength(); mesh.renderOrder = 8; mesh.frustumCulled = false; mesh.raycast = () => {};
      group.add(mesh); arcs.set(key, { mesh, keep: true, sig });
    }

    // on the dark theme light adds up (additive); on the light theme it would wash out, so the marks are painted over
    function blend() {
      const b = document.documentElement.dataset.theme === 'dark' ? T.AdditiveBlending : T.NormalBlending;
      rings.material.blending = b; colMat.blending = b; for (const e of arcs.values()) e.mesh.material.blending = b;
      rings.material.needsUpdate = colMat.needsUpdate = true; for (const e of arcs.values()) e.mesh.material.needsUpdate = true;
    }
    new MutationObserver(blend).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const solved = [];          // { p, t }
    let last = new Map();        // rec key → position, to notice a problem that clears
    let tick = 0, tAnim = 0;
    const m4 = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), sc = new T.Vector3();
    const putRing = (p, r, c, k = 1) => { const i = rings.count; if (i >= 96) return; m4.compose(v.set(p[0], floorY(p), p[2]), q.identity(), sc.set(r, 1, r)); rings.setMatrixAt(i, m4); rings.setColorAt(i, c.clone().multiplyScalar(k)); rings.count++; };
    const posOf = ref => V.posOfRef(ref);

    function frame(dt) {
      tAnim += dt; const show = (V.overlay === 'status' || V.overlay === 'flow') && !V.cinematic;
      group.visible = show; if (!show) return;
      rings.count = 0; cols.count = 0;
      const pulse = 0.5 + 0.5 * Math.sin(tAnim * 4);
      // problems
      const now = new Map();
      for (const r of P.recs) {
        if (r.level !== 'crit' && r.level !== 'warn') continue;
        const p = posOf(r.ref); if (!p) continue;
        now.set(r.key, p);
        const c = COL[r.level], R = r.level === 'crit' ? 2.6 : 2.1;
        putRing(p, R * (1 + 0.18 * pulse), c, 1.4 - 0.6 * pulse); putRing(p, R * 0.62, c, 0.8);
        if (!V.walking && cols.count < 48) { m4.compose(v.set(p[0], floorY(p), p[2]), q.identity(), sc.set(1, 1, 1)); cols.setMatrixAt(cols.count, m4); cols.setColorAt(cols.count, c); cols.count++; }
      }
      // repairs under way: a green ring that turns at the machine
      for (const s of P.stations) if ((s.state === 'down' || s.state === 'maint') && s.tech && s.tech.state === 'repairing') {
        const p = posOf(s.id); if (!p) continue;
        const i = rings.count; if (i < 96) { m4.compose(v.set(p[0], floorY(p) + 0.01, p[2]), q.setFromAxisAngle(sc.set(0, 1, 0), tAnim * 1.6), sc.set(1.7, 1, 1.7)); rings.setMatrixAt(i, m4); rings.setColorAt(i, COL.fix); rings.count++; }
      }
      // solved: a green ring opens once where a problem was
      for (const [k, p] of last) if (!now.has(k)) solved.push({ p, t: 0 });
      last = now;
      for (let i = solved.length - 1; i >= 0; i--) { const e = solved[i]; e.t += dt; if (e.t > 2.5) { solved.splice(i, 1); continue; } putRing(e.p, 1.2 + e.t * 2.4, COL.fix, 1.6 * (1 - e.t / 2.5)); }
      for (const m of [rings, cols]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
      colMat.uniforms.time.value = tAnim;
      // arcs and routes rebuild at most twice a second
      tick += dt;
      if (tick > 0.5) {
        tick = 0;
        for (const e of arcs.values()) e.keep = false;
        for (const r of P.recs) for (const [a, b] of (r.links || [])) { const pa = posOf(a), pb = posOf(b); if (pa && pb && (Math.abs(pa[0] - pb[0]) + Math.abs(pa[2] - pb[2]) > 1)) arc('c:' + r.key + ':' + a + '>' + b, pa, pb, r.level === 'crit' ? COL.crit : COL.warn); }
        for (const t of P.techs) if (t.state === 'walking' && t.path) route('t:' + t.id, t.path.slice(Math.floor(t.s / Math.max(1e-3, t.len) * (t.path.length - 1))), t.ly || 0, COL.fix);
        for (const a of P.agvs) if (a.mission && a.mission.prio >= 3 && a.path) route('a:' + a.id, a.path, 0, COL.fix);
        for (const [k, e] of arcs) if (!e.keep) { e.mesh.geometry.dispose(); e.mesh.material.dispose(); group.remove(e.mesh); arcs.delete(k); }
      }
      for (const e of arcs.values()) e.mesh.material.uniforms.time.value = tAnim;
    }
    blend();
    V.studio.onFrame(frame);
    window.PlantProblems = { group, get arcs() { return arcs.size; } };
  }
  start();
})();
