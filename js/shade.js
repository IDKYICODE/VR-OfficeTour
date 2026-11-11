/* Small shader patches shared by materials: leaf sway (wind) and, once a lighting bake
   is loaded, per-vertex baked light that replaces ambient + point lights.
   Uniforms live in OV.U so the light switch and the clock-driven time can drive them. */
(function () {
  const OV = (window.OV = window.OV || {});
  OV.U = { time: { value: 0 }, day: { value: 1 }, lamp: { value: 1 } };

  // o.sway: gentle wind on foliage. o.bake: attributes bakeDay / bakeLamp (vec3 irradiance) replace the ambient term.
  OV.patchMaterial = function (mat, o) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = OV.U.time; sh.uniforms.uDay = OV.U.day; sh.uniforms.uLamp = OV.U.lamp;
      let vs = sh.vertexShader, fs = sh.fragmentShader;
      vs = vs.replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uDay;\nuniform float uLamp;' +
        (o.bake ? '\nattribute vec3 bakeDay;\nattribute vec3 bakeLamp;\nvarying vec3 vBake;' : ''));
      if (o.bake) vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBake = bakeDay * uDay + bakeLamp * uLamp;');
      if (o.sway) vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n{ float sw = max(0.0, position.y - 0.45);\n transformed.x += sin(uTime * 1.3 + position.x * 2.0 + position.z * 1.7) * 0.035 * sw;\n transformed.z += cos(uTime * 1.1 + position.z * 2.3 + position.x) * 0.035 * sw; }');
      if (o.bake) {
        fs = fs.replace('#include <common>', '#include <common>\nvarying vec3 vBake;');
        // the baked irradiance replaces ambient + hemisphere + diffuse IBL; direct sun and specular reflections stay live
        fs = fs.replace('#include <lights_fragment_end>', '#if defined( RE_IndirectDiffuse )\n irradiance = vBake;\n#endif\n#include <lights_fragment_end>');
      }
      sh.vertexShader = vs; sh.fragmentShader = fs;
    };
    mat.customProgramCacheKey = () => (o.sway ? 's' : '') + (o.bake ? 'b' : '');
    mat.needsUpdate = true;
  };
})();
