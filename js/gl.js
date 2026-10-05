/* ============================================================
   CANON COLLAGE SHOWCASE — hand-written WebGL layers
   (fullscreen triangles only, no 3D objects)

   Fixed PAPER palette for the whole page — a warm off-white
   collage board that never changes theme.

   #gl-bg : paper fibre, riso colour patches that PARALLAX with
            the scroll, travelling ink bands tied to scroll
            progress, halftone print dots, cut strips, film
            grain and scroll-velocity smear.

   #gl-fx : transparent overlay — grain / dust / scratches
            (blended in CSS with mix-blend-mode:overlay)
   ============================================================ */
(function () {
  'use strict';

  // shared scroll state — written by js/main.js
  var S = (window.SHOWTIME = window.SHOWTIME || {
    scroll: 0,   // 0..1 page progress (smoothed)
    vel: 0,      // smoothed scroll velocity (-1..1-ish)
    mx: 0.5,     // pointer, 0..1
    my: 0.5
  });

  var VERT = [
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  /* ---------------------------------------------------------- */
  /*  BACKGROUND SHADER — PAPER COLLAGE BOARD                    */
  /* ---------------------------------------------------------- */
  var FRAG_BG = [
    'precision highp float;',
    'uniform vec2 uRes, uMouse;',
    'uniform float uTime, uScroll, uVel;',

    'float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    'float noise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  f = f * f * (3.0 - 2.0 * f);',
    '  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));',
    '  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
    '}',
    'float fbm(vec2 p){',
    '  float v = 0.0, a = 0.5;',
    '  for(int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; }',
    '  return v;',
    '}',

    /* rotated halftone cell distance */
    'float halftone(vec2 uv, float scale, float ang){',
    '  float s = sin(ang), c = cos(ang);',
    '  vec2 p = mat2(c, -s, s, c) * uv * scale;',
    '  return length(fract(p) - 0.5);',
    '}',

    /* soft ink blob used for the misregistered riso patches */
    'float blob(vec2 p, vec2 c, vec2 r){',
    '  return smoothstep(1.0, 0.0, length((p - c) / r));',
    '}',

    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  float aspect = uRes.x / uRes.y;',
    '  vec2 suv = uv;',
    '  suv.x = (uv.x - 0.5) * aspect + 0.5;',

    /* ---- warm paper stock ---- */
    '  vec3 col = vec3(0.957, 0.945, 0.912);',

    /* ---- paper fibre: horizontal grain + tooth ---- */
    '  float fiber = fbm(suv * vec2(4.0, 160.0)) * 0.55 + fbm(suv * 26.0) * 0.45;',
    '  col -= (fiber - 0.5) * 0.075;',

    /* ---- riso colour patches, parallaxing with the scroll ---- */
    '  float sc = uScroll;',
    '  vec2 drift = vec2((uMouse.x - 0.5) * 0.05, 0.0);',
    '  float p1 = blob(suv, vec2(0.84, 0.74 - sc * 0.55) + drift, vec2(0.34, 0.30));',
    '  float p2 = blob(suv, vec2(0.14, 0.30 + sc * 0.72) - drift, vec2(0.30, 0.34));',
    '  float p3 = blob(suv, vec2(0.56, 0.06 + sc * 1.35), vec2(0.42, 0.26));',
    '  float p4 = blob(suv, vec2(0.36 - sc * 0.4, 0.96 - sc * 1.1), vec2(0.26, 0.24));',
    '  float wob = 0.75 + 0.25 * fbm(suv * 5.0 + sc * 3.0);',
    '  col = mix(col, vec3(1.000, 0.843, 0.302), p1 * 0.34 * wob);',
    '  col = mix(col, vec3(1.000, 0.443, 0.478), p2 * 0.30 * wob);',
    '  col = mix(col, vec3(0.462, 0.580, 1.000), p3 * 0.24 * wob);',
    '  col = mix(col, vec3(0.549, 0.925, 0.760), p4 * 0.24 * wob);',

    /* ---- travelling ink bands: position is driven by scroll ---- */
    '  float t = uTime;',
    '  float y1 = 1.24 - uScroll * 1.75;',
    '  float d1 = dot(suv - vec2(0.5, y1), normalize(vec2(0.30, 1.0)));',
    '  float band1 = smoothstep(0.30, 0.0, abs(d1));',
    '  float y2 = -0.30 + uScroll * 1.85;',
    '  float d2 = dot(suv - vec2(0.42, y2), normalize(vec2(-0.24, 1.0)));',
    '  float band2 = smoothstep(0.26, 0.0, abs(d2));',
    '  col = mix(col, vec3(1.0, 0.36, 0.44), band1 * 0.26);',
    '  col = mix(col, vec3(0.36, 0.52, 1.0), band2 * 0.22);',

    /* thin ink rule that rides just above the red band */
    '  float rule = smoothstep(0.010, 0.0, abs(d1 - 0.34));',
    '  rule *= 0.25 + 0.75 * step(0.44, fbm(suv * vec2(11.0, 26.0)));',
    '  col = mix(col, vec3(0.10, 0.09, 0.11), rule * 0.16);',

    /* ---- scroll-velocity smear on the whole board ---- */
    '  float smear = uVel * 0.06 * sin(suv.y * 24.0 + t * 0.5);',
    '  col = mix(col, col * vec3(1.0 + abs(uVel) * 0.10, 1.0, 1.0 - abs(uVel) * 0.06), abs(smear) * 3.0);',

    /* ---- collage cut strips: faint tinted horizontal bands ---- */
    '  float band = floor(suv.y * 7.0 + 0.6 * fbm(suv * 2.2 + sc));',
    '  float bt = hash21(vec2(band, 3.0));',
    '  col *= 1.0 + (bt - 0.5) * 0.048;',

    /* ---- halftone print dots, angle turning with the scroll ---- */
    '  float hAng = 0.30 + sc * 1.15;',
    '  float scale = mix(86.0, 58.0, sc);',
    '  float cell = halftone(suv, scale, hAng);',
    '  float dotR = 0.17 + 0.055 * fbm(suv * 3.0 + sc * 2.0);',
    '  float dot = smoothstep(dotR, dotR - 0.10, cell);',
    '  float dotVis = 0.115 + 0.05 * fbm(suv * 1.7);',
    '  col = mix(col, col * (1.0 - 0.80 * dotVis) + vec3(dotVis * 0.30) * dot, dot);',

    /* ---- soft vignette, paper never blows out at the edges ---- */
    '  vec2 vc = uv - 0.5;',
    '  float vig = smoothstep(1.05, 0.30, length(vc * vec2(1.14, 1.0)));',
    '  col *= 1.0 - (1.0 - vig) * 0.16;',

    /* ---- grain + velocity flash ---- */
    '  col *= 1.0 + abs(uVel) * 0.07;',
    '  float gr = hash21(gl_FragCoord.xy + fract(uTime) * 431.0);',
    '  col += (gr - 0.5) * 0.045;',

    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ---------------------------------------------------------- */
  /*  FX OVERLAY SHADER (grain / dust / scratches)               */
  /* ---------------------------------------------------------- */
  var FRAG_FX = [
    'precision mediump float;',
    'uniform vec2 uRes, uMouse;',
    'uniform float uTime, uScroll, uVel;',

    'float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',

    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  float g = hash21(uv * uRes * 0.5 + fract(uTime) * 97.0);',
    '  float grain = smoothstep(0.25, 0.95, g);',

    /* occasional vertical scratch on the emulsion */
    '  float colId = floor(uv.x * 160.0);',
    '  float slot = floor(uTime * 3.0);',
    '  float isScratch = step(0.995, hash21(vec2(colId, slot)));',
    '  float wobble = 0.5 + 0.5 * sin(uv.y * 40.0 + hash21(vec2(colId, 7.0)) * 6.28 + uTime * 2.0);',
    '  float scratch = isScratch * smoothstep(0.85, 1.0, wobble);',

    /* dust specks + motes drifting with the scroll */
    '  float dust = step(0.9978, hash21(floor(uv * uRes / 3.0) + slot));',
    '  float drift = fract(uv.y + uTime * 0.02 + uScroll * 0.5);',
    '  float mote = step(0.9987, hash21(floor(vec2(uv.x * 220.0, drift * 220.0))));',

    '  float a = grain * 0.15 + scratch * 0.20 + dust * 0.34 + mote * 0.24;',
    '  a *= 0.55 + abs(uVel) * 1.1;',
    '  a = clamp(a, 0.0, 0.55);',

    /* neutral grey keeps mix-blend-mode:overlay from tinting the paper */
    '  float shade = 0.5 + (g - 0.5) * 0.9;',
    '  gl_FragColor = vec4(vec3(shade), a);',
    '}'
  ].join('\n');

  /* ---------------------------------------------------------- */
  /*  GL BOOTSTRAP                                               */
  /* ---------------------------------------------------------- */
  function createGL(canvas, opts) {
    var attrs = { alpha: !!opts.alpha, antialias: false, depth: false, stencil: false,
                  premultipliedAlpha: true, powerPreference: 'high-performance' };
    var gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
    if (!gl) return null;

    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('[GL] shader:', gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    }
    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, opts.frag);
    if (!vs || !fs) return null;

    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[GL] link:', gl.getProgramInfoLog(prog));
      return null;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    return {
      gl: gl,
      prog: prog,
      u: {
        res: gl.getUniformLocation(prog, 'uRes'),
        mouse: gl.getUniformLocation(prog, 'uMouse'),
        time: gl.getUniformLocation(prog, 'uTime'),
        scroll: gl.getUniformLocation(prog, 'uScroll'),
        vel: gl.getUniformLocation(prog, 'uVel')
      }
    };
  }

  function fit(canvas, ctx, dprCap) {
    var dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    var w = Math.max(1, Math.round(window.innerWidth * dpr));
    var h = Math.max(1, Math.round(window.innerHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      ctx.viewport(0, 0, w, h);
    }
    return [w, h];
  }

  var bgCanvas = document.getElementById('gl-bg');
  var fxCtx = document.getElementById('gl-fx');
  if (!bgCanvas || !fxCtx) return;

  var bg = createGL(bgCanvas, { frag: FRAG_BG, alpha: false });
  var fx = createGL(fxCtx, { frag: FRAG_FX, alpha: true });

  if (!bg && !fx) {
    document.body.classList.add('no-gl');
    console.warn('[GL] WebGL unavailable — CSS fallback background active.');
    return;
  }

  var running = true;
  document.addEventListener('visibilitychange', function () { running = !document.hidden; });

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var t0 = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    if (!running) return;
    var t = (now - t0) / 1000;
    if (reduced) t = 1.0;

    if (bg) {
      var res = fit(bgCanvas, bg.gl, 1.5);
      bg.gl.uniform2f(bg.u.res, res[0], res[1]);
      bg.gl.uniform2f(bg.u.mouse, S.mx, S.my);
      bg.gl.uniform1f(bg.u.time, t);
      bg.gl.uniform1f(bg.u.scroll, S.scroll);
      bg.gl.uniform1f(bg.u.vel, S.vel);
      bg.gl.drawArrays(bg.gl.TRIANGLES, 0, 3);
    }
    if (fx) {
      var res2 = fit(fxCtx, fx.gl, 0.6);   // grain at low res — cheaper & chunkier
      fx.gl.uniform2f(fx.u.res, res2[0], res2[1]);
      fx.gl.uniform2f(fx.u.mouse, S.mx, S.my);
      fx.gl.uniform1f(fx.u.time, t);
      fx.gl.uniform1f(fx.u.scroll, S.scroll);
      fx.gl.uniform1f(fx.u.vel, S.vel);
      fx.gl.clearColor(0, 0, 0, 0);
      fx.gl.clear(fx.gl.COLOR_BUFFER_BIT);
      fx.gl.drawArrays(fx.gl.TRIANGLES, 0, 3);
    }
  }
  requestAnimationFrame(frame);

  window.SHOWTIME_GL_OK = !!(bg || fx);
})();
