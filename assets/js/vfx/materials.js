/* DFMaterials: the factory's physically based material library (three.js r170 MeshPhysicalMaterial).
   Values are measured-style starting points: albedo in linear 0.04–0.85, metals with no diffuse, roughness
   that matches the finish, layers (clearcoat, sheen, transmission, anisotropy) only where the surface has them.
   Each preset returns a new material; textures are shared and owned by the caller. */
(function () {
  const lin = (T, hex) => new T.Color(hex);   // three keeps Color in linear; hex input is sRGB
  // wrapped diffuse for skin and wax: light bleeds past the terminator, as it does through skin
  function wrap(m, w) {
    m.onBeforeCompile = sh => {
      const T = window.THREE;
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_pars_fragment>',
        T.ShaderChunk.lights_physical_pars_fragment.replace('float dotNL = saturate( dot( geometryNormal, directLight.direction ) );',
          `float dotNL = saturate( ( dot( geometryNormal, directLight.direction ) + ${w.toFixed(2)} ) / ${(1 + w).toFixed(2)} );`));
    };
    m.customProgramCacheKey = () => 'df-wrap-' + w;
    return m;
  }
  const PRESETS = {
    brushedAluminium: T => new T.MeshPhysicalMaterial({ color: lin(T, 0xC9CDD2), metalness: 1, roughness: 0.3, anisotropy: 0.85, anisotropyRotation: 0 }),
    anodisedGraphite: T => new T.MeshPhysicalMaterial({ color: lin(T, 0x2B2E33), metalness: 1, roughness: 0.36, anisotropy: 0.3 }),
    chrome: T => new T.MeshPhysicalMaterial({ color: lin(T, 0xDCE0E4), metalness: 1, roughness: 0.06 }),
    gold: T => new T.MeshPhysicalMaterial({ color: lin(T, 0xF5C77E), metalness: 1, roughness: 0.22 }),
    glass: T => new T.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.02, transmission: 1, thickness: 0.02, ior: 1.52, specularIntensity: 1, envMapIntensity: 1.2 }),
    frostedGlass: T => new T.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.35, transmission: 1, thickness: 0.02, ior: 1.5 }),
    tintedGlass: T => new T.MeshPhysicalMaterial({ color: lin(T, 0x9FC7D6), metalness: 0, roughness: 0.04, transmission: 0.95, thickness: 0.05, ior: 1.52, attenuationColor: lin(T, 0x5E9AB0), attenuationDistance: 0.12 }),
    fabric: T => new T.MeshPhysicalMaterial({ color: lin(T, 0x3A3D42), roughness: 0.92, sheen: 1, sheenColor: lin(T, 0x8E939C), sheenRoughness: 0.55 }),
    velvet: T => new T.MeshPhysicalMaterial({ color: lin(T, 0x5A1E2E), roughness: 1, sheen: 1, sheenColor: lin(T, 0xD9708A), sheenRoughness: 0.3 }),
    plasticMatte: T => new T.MeshPhysicalMaterial({ color: lin(T, 0x1C1E22), roughness: 0.62, specularIntensity: 0.5 }),
    plasticGloss: T => new T.MeshPhysicalMaterial({ color: lin(T, 0xF2F3F5), roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.08 }),
    carPaint: T => new T.MeshPhysicalMaterial({ color: lin(T, 0x1428A0), metalness: 0.6, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.04 }),
    rubber: T => new T.MeshPhysicalMaterial({ color: lin(T, 0x121315), roughness: 0.88, specularIntensity: 0.4 }),
    skin: T => wrap(new T.MeshPhysicalMaterial({ color: lin(T, 0xC68E72), roughness: 0.52, sheen: 0.35, sheenColor: lin(T, 0xF2A48E), sheenRoughness: 0.6, clearcoat: 0.08, clearcoatRoughness: 0.4, specularIntensity: 0.45 }), 0.45),
    concrete: T => new T.MeshPhysicalMaterial({ color: lin(T, 0x8E9196), roughness: 0.9 }),
    ceramic: T => new T.MeshPhysicalMaterial({ color: lin(T, 0xF4F1EA), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 })
  };
  const make = (T, name) => (PRESETS[name] ? Object.assign(PRESETS[name](T), { name }) : null);
  window.DFMaterials = { PRESETS, make, names: Object.keys(PRESETS), wrap };
})();
