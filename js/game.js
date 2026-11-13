(() => {
  var Ro = Object.defineProperty;
  var Io = (e, t) => {
    for (var o in t) Ro(e, o, { get: t[o], enumerable: !0 });
  };
  var Ce = {};
  Io(Ce, {
    R: () => pe,
    W: () => I,
    build: () => xe,
    cam: () => H,
    liftoff: () => dt,
    near: () => Q,
    npcs: () => ke,
    objs: () => Z,
    pl: () => b,
    rocket: () => He,
    roverO: () => se,
    scene: () => C,
    shake: () => ct,
    solMat: () => Ee,
    updateWorld: () => ut,
  });
  var m = (e) => document.getElementById(e),
    X = (e, t = 0, o = 100) => Math.min(o, Math.max(t, e)),
    Qe = (e) => () => {
      ((e |= 0), (e = (e + 1831565813) | 0));
      let t = Math.imul(e ^ (e >>> 15), 1 | e);
      return (
        (t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t),
        ((t ^ (t >>> 14)) >>> 0) / 4294967296
      );
    },
    g = { K: {}, joy: { x: 0, y: 0 }, tgt: null, yaw: 0, pitch: 0.38, drag: 0 };
  var s = window.THREE,
    I,
    Z = [],
    ke = [],
    b,
    Ee,
    se,
    Q = null,
    He,
    Pe = "mars",
    rt = [],
    Me = 0,
    be = 0,
    ge = 0,
    et = 0.8,
    st = 0,
    at = 0,
    tt = new s.Vector3(),
    pe = new s.WebGLRenderer({ canvas: m("c"), antialias: !0 });
  pe.setPixelRatio(Math.min(devicePixelRatio, 2));
  pe.shadowMap.enabled = !0;
  pe.shadowMap.type = s.PCFSoftShadowMap;
  var C = new s.Scene(),
    H = new s.PerspectiveCamera(62, 1, 0.1, 400),
    $e = new s.HemisphereLight(16767416, 5583650, 0.7),
    j = new s.DirectionalLight(16773341, 1);
  C.add($e, j, j.target);
  j.castShadow = !0;
  j.shadow.mapSize.set(2048, 2048);
  Object.assign(j.shadow.camera, {
    left: -55,
    right: 55,
    top: 55,
    bottom: -55,
    near: 1,
    far: 260,
  });
  j.shadow.camera.updateProjectionMatrix();
  j.shadow.bias = -6e-4;
  j.shadow.normalBias = 0.05;
  C.background = new s.Color(13933170);
  C.fog = new s.Fog(13933170, 50, 150);
  var Rt = new s.BufferGeometry(),
    It = [];
  for (let e = 0; e < 500; e++) {
    let t = Math.random() * 6.28,
      o = Math.random() * 1.4 + 0.1,
      n = 300;
    It.push(
      Math.cos(t) * Math.cos(o) * n,
      Math.sin(o) * n,
      Math.sin(t) * Math.cos(o) * n,
    );
  }
  Rt.setAttribute("position", new s.Float32BufferAttribute(It, 3));
  var Ot = new s.Points(
    Rt,
    new s.PointsMaterial({
      color: 16777215,
      size: 1.6,
      sizeAttenuation: !1,
      transparent: !0,
      fog: !1,
    }),
  );
  C.add(Ot);
  var We = new s.BufferGeometry(),
    ze = new Float32Array(900);
  for (let e = 0; e < 900; e += 3)
    ((ze[e] = (Math.random() - 0.5) * 70),
      (ze[e + 1] = Math.random() * 18),
      (ze[e + 2] = (Math.random() - 0.5) * 70));
  We.setAttribute("position", new s.BufferAttribute(ze, 3));
  var Fe = new s.Points(
    We,
    new s.PointsMaterial({
      color: 15250570,
      size: 2.5,
      sizeAttenuation: !1,
      transparent: !0,
      opacity: 0.3,
      depthWrite: !1,
    }),
  );
  C.add(Fe);
  var ve = new s.ShaderMaterial({
      side: s.BackSide,
      depthWrite: !1,
      uniforms: { t: { value: new s.Color() }, b: { value: new s.Color() } },
      vertexShader:
        "varying float h;void main(){h=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:
        "uniform vec3 t,b;varying float h;void main(){gl_FragColor=vec4(mix(b,t,pow(clamp(h,0.,1.),.55)),1.);}",
    }),
    it = new s.Mesh(new s.SphereGeometry(350, 24, 12), ve);
  it.renderOrder = -1;
  C.add(it);
  var Se = new s.Mesh(
    new s.CircleGeometry(10, 24),
    new s.MeshBasicMaterial({ color: 16773848, fog: !1 }),
  );
  C.add(Se);
  var Oo = new s.Vector3(),
    Lo = (() => {
      let e = pe.capabilities.isWebGL2 ? s.RedFormat : s.LuminanceFormat,
        t = new s.DataTexture(new Uint8Array([105, 185, 255]), 3, 1, e);
      return (
        (t.minFilter = t.magFilter = s.NearestFilter),
        (t.generateMipmaps = !1),
        (t.needsUpdate = !0),
        t
      );
    })(),
    Lt = (e, t = {}) => {
      let o = {};
      for (let n of [
        "map",
        "emissive",
        "transparent",
        "opacity",
        "side",
        "depthWrite",
        "vertexColors",
      ])
        n in t && (o[n] = t[n]);
      return new s.MeshToonMaterial({ color: e, gradientMap: Lo, ...o });
    },
    K = Lt,
    Nt = new s.MeshBasicMaterial({ color: 1182228, side: s.BackSide });
  Nt.onBeforeCompile = (e) => {
    e.vertexShader = e.vertexShader.replace(
      "#include <begin_vertex>",
      "vec3 transformed=position+normal*clamp(length((modelViewMatrix*vec4(position,1.)).xyz)*.0032,.028,.11);",
    );
  };
  var Et = new WeakMap();
  function No(e) {
    let t = Et.get(e);
    if (t) return t;
    let o = e.attributes.position,
      n = e.attributes.normal;
    if (!n) return null;
    let r = new Map(),
      a = (u) =>
        Math.round(o.getX(u) * 500) +
        "," +
        Math.round(o.getY(u) * 500) +
        "," +
        Math.round(o.getZ(u) * 500);
    for (let u = 0; u < o.count; u++) {
      let h = a(u),
        w = r.get(h) || [0, 0, 0];
      ((w[0] += n.getX(u)),
        (w[1] += n.getY(u)),
        (w[2] += n.getZ(u)),
        r.set(h, w));
    }
    let d = new Float32Array(o.count * 3);
    for (let u = 0; u < o.count; u++) {
      let h = r.get(a(u)),
        w = Math.hypot(h[0], h[1], h[2]) || 1;
      ((d[u * 3] = h[0] / w),
        (d[u * 3 + 1] = h[1] / w),
        (d[u * 3 + 2] = h[2] / w));
    }
    return (
      (t = e.clone()),
      t.setAttribute("normal", new s.BufferAttribute(d, 3)),
      Et.set(e, t),
      t
    );
  }
  function Go(e) {
    let t = [];
    e.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.ol) return;
      let n = o.material;
      if (!n.isMeshToonMaterial || n.transparent || n.vertexColors) return;
      let r = o.geometry;
      r.boundingSphere || r.computeBoundingSphere();
      let a = r.boundingSphere.radius;
      a > 10 || (r.type === "DodecahedronGeometry" && a < 0.9) || t.push(o);
    });
    for (let o of t) {
      let n = No(o.geometry);
      if (!n) continue;
      let r = new s.Mesh(n, Nt);
      ((r.raycast = () => {}),
        (r.userData.ol = 1),
        (r.castShadow = !1),
        (r.receiveShadow = !1),
        o.add(r));
    }
  }
  function Do() {
    let e = document.createElement("canvas");
    e.width = e.height = 256;
    let t = e.getContext("2d"),
      o = t.createImageData(256, 256);
    for (let r = 0; r < o.data.length; r += 4) {
      let a = (200 + Math.random() * 55) | 0;
      ((o.data[r] = o.data[r + 1] = o.data[r + 2] = a), (o.data[r + 3] = 255));
    }
    t.putImageData(o, 0, 0);
    for (let r = 0; r < 70; r++)
      ((t.fillStyle = "rgba(0,0,0," + Math.random() * 0.14 + ")"),
        t.beginPath(),
        t.arc(
          Math.random() * 256,
          Math.random() * 256,
          1 + Math.random() * 4,
          0,
          6.3,
        ),
        t.fill());
    let n = new s.CanvasTexture(e);
    return (
      (n.wrapS = n.wrapT = s.RepeatWrapping),
      n.repeat.set(90, 90),
      (n.anisotropy = 8),
      n
    );
  }
  var zo = Do(),
    Gt = [];
  {
    let e = Qe(3);
    for (let t = 0; t < 26; t++) {
      let o = e() * 6.28,
        n = 48 + e() * 130;
      Gt.push([Math.cos(o) * n, Math.sin(o) * n, 6 + e() * 16]);
    }
  }
  var fe = (e, t) => {
      let o = Pe === "moon",
        n =
          Math.sin(e * 0.05) * Math.cos(t * 0.06) * (o ? 3 : 5) +
          Math.sin(e * 0.13 + t * 0.11) * (o ? 0.7 : 1.3) +
          (o
            ? 0
            : Math.abs(Math.sin(e * 0.09 + t * 0.04)) * 2.5 +
              Math.abs(Math.sin(e * 0.035 + Math.sin(t * 0.05) * 2.5)) * 3.5 +
              Math.sin(e * 0.4 + t * 0.3) * 0.25);
      for (let [r, a, d] of Gt) {
        let u = Math.hypot(e - r, t - a) / (o ? d * 1.4 : d);
        u < 1
          ? (n -= (1 - u * u) * d * 0.35)
          : u < 1.35 && (n += (1.35 - u) * d * 0.5);
      }
      return n * X((Math.hypot(e, t) - 34) / 40, 0, 1);
    },
    Ct = (e, t, o, n, r, a, d, u) => {
      let h = new s.Mesh(new s.BoxGeometry(e, t, o), K(n));
      return (h.position.set(r, a, d), u.add(h), h);
    },
    ot = (e, t, o, n, r, a, d) => {
      let u = new s.Mesh(new s.CylinderGeometry(e, e, t, 20), K(o));
      return (u.position.set(n, r, a), d.add(u), u);
    },
    A = Lt,
    c = (e, t, o, n, r, a, d = 0, u = 0, h = 0) => {
      let w = new s.Mesh(e, t);
      return (w.position.set(o, n, r), w.rotation.set(d, u, h), a.add(w), w);
    },
    M = (e, t, o, n = 32) => new s.CylinderGeometry(e, t, o, n),
    z = (e, t = 32, o = 24) => new s.SphereGeometry(e, t, o),
    v = (e, t, o) => new s.BoxGeometry(e, t, o),
    J = (e, t, o = 6.2832, n = 48) => new s.TorusGeometry(e, t, 10, n, o),
    N = A(15922424, { roughness: 0.5 }),
    k = A(9081244, { metalness: 0.5, roughness: 0.4 }),
    $ = A(2830136, { roughness: 0.7 }),
    lt = () =>
      A(12577023, {
        transparent: !0,
        opacity: 0.28,
        roughness: 0.1,
        side: s.DoubleSide,
        depthWrite: !1,
      }),
    W = (e) => new s.MeshBasicMaterial({ color: e });
  function Fo() {
    let e = document.createElement("canvas");
    e.width = e.height = 256;
    let t = e.getContext("2d");
    ((t.fillStyle = "#e8edf8"), t.fillRect(0, 0, 256, 256));
    for (let n = 0; n < 4; n++)
      for (let r = 0; r < 6; r++) {
        let a = r * 42.6 + 2,
          d = n * 64 + 2,
          u = t.createLinearGradient(a, d, a + 38, d + 60);
        (u.addColorStop(0, "#9fb4e8"),
          u.addColorStop(1, "#6f86c8"),
          (t.fillStyle = u),
          t.fillRect(a, d, 38.6, 60),
          (t.fillStyle = "#dfe6f5"),
          t.fillRect(a + 19, d, 1, 60));
      }
    let o = new s.CanvasTexture(e);
    return ((o.anisotropy = 8), o);
  }
  var Dt = Fo();
  function nt(e, t, o) {
    let n = e.userData;
    if (!n.legs) return;
    let r = t ? Math.sin(o / 110) * 0.7 : 0,
      a = (d, u) => (d.rotation.x += (u - d.rotation.x) * 0.3);
    (a(n.legs[0], r),
      a(n.legs[1], -r),
      a(n.arms[0], -r * 0.8),
      a(n.arms[1], r * 0.8));
  }
  function At(e) {
    let t = new s.Group(),
      o = A(e),
      n = A(2373227, { roughness: 0.08, metalness: 0.6, emissive: 660016 });
    (c(v(0.95, 1.05, 0.62), N, 0, 1.6, 0, t),
      c(v(0.98, 0.2, 0.66), o, 0, 1.15, 0, t),
      c(v(0.5, 0.32, 0.06), $, 0, 1.75, 0.33, t));
    for (let a = 0; a < 3; a++)
      c(
        v(0.09, 0.09, 0.03),
        W([16729156, 4521864, 4491519][a]),
        -0.15 + a * 0.15,
        1.78,
        0.37,
        t,
      );
    c(v(0.8, 0.95, 0.38), k, 0, 1.65, -0.5, t);
    for (let a of [-0.25, 0.25]) c(M(0.13, 0.13, 0.8, 16), N, a, 1.7, -0.78, t);
    return (
      c(z(0.14, 12, 8), W(16724770), 0, 2.1, -0.7, t),
      c(M(0.02, 0.02, 0.7, 6), k, 0.3, 2.4, -0.6, t),
      c(M(0.3, 0.34, 0.14), k, 0, 2.17, 0, t),
      c(z(0.43), N, 0, 2.55, 0, t),
      c(z(0.35), n, 0, 2.55, 0.17, t).scale.set(1.05, 0.85, 0.7),
      c(v(0.16, 0.06, 0.06), W(16773808), 0, 2.97, 0.15, t),
      (t.userData.legs = [0, 1].map((a) => {
        let d = new s.Group();
        return (
          d.position.set(a ? 0.27 : -0.27, 1.08, 0),
          c(M(0.2, 0.17, 0.5, 16), N, 0, -0.25, 0, d),
          c(z(0.19, 16, 12), k, 0, -0.52, 0, d),
          c(M(0.16, 0.15, 0.48, 16), N, 0, -0.8, 0, d),
          c(v(0.34, 0.24, 0.5), $, 0, -0.96, 0.07, d),
          t.add(d),
          d
        );
      })),
      (t.userData.arms = [0, 1].map((a) => {
        let d = new s.Group();
        return (
          d.position.set(a ? 0.6 : -0.6, 2, 0),
          c(z(0.22, 16, 12), o, 0, 0, 0, d),
          c(M(0.14, 0.13, 0.5, 16), N, 0, -0.3, 0, d),
          c(z(0.14, 12, 8), k, 0, -0.58, 0, d),
          c(M(0.13, 0.12, 0.4, 16), N, 0, -0.8, 0, d),
          c(z(0.15, 12, 8), $, 0, -1.03, 0, d),
          t.add(d),
          d
        );
      })),
      t.scale.setScalar(0.85),
      t
    );
  }
  function Ho(e) {
    Ee = A(2047902, {
      map: Dt,
      emissive: 662080,
      roughness: 0.25,
      metalness: 0.35,
    });
    for (let t = 0; t < 5; t++) {
      let o = t * 3.6 - 7.2,
        n = new s.Group();
      (n.position.set(o, 1.9, 0),
        (n.rotation.x = 0.7),
        c(v(3.2, 0.1, 2.4), k, 0, 0, 0, n),
        c(new s.PlaneGeometry(3, 2.2), Ee, 0, 0.06, 0, n, -1.5708),
        c(v(0.08, 0.1, 2.3), N, 0, 0.06, 0, n),
        e.add(n),
        c(M(0.07, 0.07, 2, 12), k, o, 0.95, -0.2, e),
        c(M(0.3, 0.4, 0.2, 16), $, o, 0.1, -0.2, e));
    }
    c(M(0.06, 0.06, 14, 8), $, 7, 0.07, 1.2, e, 0, 0, 1.5708);
  }
  function Po(e) {
    e.rotation.y = 1.5708;
    let t = lt();
    (t.color.set(13172712),
      c(v(5.6, 0.25, 9.6), k, 0, 0.12, 0, e),
      c(
        new s.CylinderGeometry(2.6, 2.6, 9, 40, 1, !0, 1.5708, 3.1416),
        t,
        0,
        0.25,
        0,
        e,
        1.5708,
      ));
    for (let o = 0; o < 7; o++)
      c(J(2.6, 0.06, 3.1416), N, 0, 0.25, -4.5 + o * 1.5, e);
    for (let o of [-1, 1])
      c(new s.CircleGeometry(2.6, 40, 0, 3.1416), t, 0, 0.25, o * 4.5, e);
    for (let o of [-1, 1]) {
      c(v(1.1, 0.5, 8.4), A(5913384, { roughness: 1 }), o * 1.3, 0.5, 0, e);
      for (let n = 0; n < 8; n++) {
        let r = -3.6 + n * 1.03,
          a = 0.5 + (n % 3) * 0.12;
        (c(M(0.03, 0.03, a, 6), A(3120725), o * 1.3, 0.75 + a / 2, r, e),
          c(
            z(0.26, 14, 10),
            A(n % 2 ? 4054138 : 3129186, { roughness: 0.8 }),
            o * 1.3,
            0.85 + a,
            r,
            e,
          ));
      }
      c(v(0.12, 0.05, 8.2), W(16732120), o * 0.8, 2.35, 0, e);
    }
    (c(M(0.9, 0.9, 1.6, 24), N, 3.2, 0.9, -2.5, e),
      c(v(1, 2.2, 0.12), A(3818064), 0, 1.2, 4.6, e));
  }
  function $o(e) {
    let t = lt();
    c(new s.SphereGeometry(6, 48, 24, 0, 6.2832, 0, 1.5708), t, 0, 0, 0, e);
    for (let n = 0; n < 8; n++)
      c(J(6, 0.07, 3.1416, 48), k, 0, 0, 0, e, 0, (n * Math.PI) / 8, 0);
    for (let n of [0.35, 0.7, 1.05, 1.35])
      c(
        J(6 * Math.cos(n), 0.06, 6.2832, 48),
        k,
        0,
        6 * Math.sin(n),
        0,
        e,
        1.5708,
      );
    (c(J(6, 0.28, 6.2832, 48), k, 0, 0.1, 0, e, 1.5708),
      c(M(5.9, 5.9, 0.12, 48), A(13220008), 0, 0.06, 0, e),
      c(M(1.5, 1.5, 5, 32), N, 0, 1.5, -0.5, e, 0, 0, 1.5708));
    for (let n of [-1, 1]) c(z(1.5, 24, 12), N, n * 2.5, 1.5, -0.5, e);
    for (let n of [-1.5, -0.5, 0.5, 1.5])
      c(v(0.5, 0.4, 0.06), W(16765562), n, 1.6, 1.02, e);
    (c(v(1, 0.8, 0.8), A(14262374), 3.2, 0.4, 2, e),
      c(v(0.8, 0.6, 0.8), A(6988031), -3.2, 0.3, 2.4, e),
      c(M(1.3, 1.3, 2.4, 32), N, 0, 1.3, 6.1, e, 1.5708),
      c(J(1.3, 0.1, 6.2832, 32), k, 0, 1.3, 7.3, e),
      c(new s.CircleGeometry(1.1, 32), W(16765562), 0, 1.3, 7.32, e),
      c(M(0.06, 0.06, 2.4, 8), k, 0, 7.2, 0, e),
      c(z(0.16, 12, 8), W(16722474), 0, 8.5, 0, e));
    let o = new s.PointLight(16763258, 0.9, 22);
    (o.position.set(0, 3, 0), e.add(o));
  }
  function Wo(e) {
    (c(v(4.2, 0.2, 3.2), $, 0, 0.1, 0, e),
      c(v(3.6, 2, 2.6), A(7109260, { metalness: 0.4 }), 0, 1.2, 0, e),
      c(v(3.7, 0.25, 2.7), A(14694997), 0, 2.3, 0, e));
    for (let t = 0; t < 7; t++)
      c(v(0.05, 0.9, 2.2), $, 1.82, 1.2, -1 + t * 0.33, e);
    for (let t of [-1, 1])
      (c(M(0.22, 0.22, 1.6, 16), k, t * 1.1, 3.1, -0.6, e),
        c(M(0.3, 0.3, 0.12, 16), $, t * 1.1, 3.95, -0.6, e));
    (c(M(0.6, 0.6, 2.2, 24), A(14211294), -0.9, 2.9, 0.5, e, 0, 0, 1.5708),
      c(z(0.25, 12, 8), W(16751146), 0.9, 2.45, 0.7, e));
    for (let t = 0; t < 3; t++)
      c(
        M(0.14, 0.14, 0.05, 16),
        W(4521864),
        -1.2 + t * 0.5,
        1.5,
        1.32,
        e,
        1.5708,
      );
    for (let t = 0; t < 6; t++)
      c(
        v(0.6, 0.08, 0.04),
        W(t % 2 ? 16765517 : 1118481),
        -1.5 + t * 0.6,
        0.25,
        1.62,
        e,
      );
    c(J(0.5, 0.1, 6.2832, 24), $, 1.4, 0.35, 2, e, 1.5708);
  }
  function Uo(e) {
    (c(M(1.1, 1.1, 2, 40), N, 0, 2.3, 0, e),
      c(z(1.1, 40, 16, 0, 6.2832, 0, 1.5708), N, 0, 3.3, 0, e),
      c(z(1.1, 40, 16, 0, 6.2832, 1.5708, 1.5708), N, 0, 1.3, 0, e),
      c(M(1.12, 1.12, 0.5, 40), A(3111935), 0, 2.3, 0, e));
    for (let t of [1.7, 2.9])
      c(J(1.11, 0.06, 6.2832, 40), k, 0, t, 0, e, 1.5708);
    c(J(1.13, 0.05, 6.2832, 40), W(4054167), 0, 2.7, 0, e, 1.5708);
    for (let t = 0; t < 3; t++) {
      let o = t * 2.094 + 0.5;
      c(
        M(0.08, 0.08, 1.3, 8),
        k,
        Math.cos(o) * 0.8,
        0.65,
        Math.sin(o) * 0.8,
        e,
      );
    }
    (c(M(0.2, 0.2, 0.08, 20), W(4054167), 0, 3, 1.1, e, 1.5708),
      c(M(0.1, 0.1, 3, 12), k, 2.2, 0.15, 0, e, 0, 0, 1.5708),
      c(J(0.28, 0.045, 6.2832, 20), A(16729156), 1.9, 0.55, 0, e));
  }
  function jo(e) {
    (c(v(2.8, 0.45, 1.8), k, 0, 0.85, 0, e),
      c(v(2.4, 0.6, 1.6), N, 0.1, 1.3, 0, e),
      c(
        z(0.85, 28, 14, 0, 6.2832, 0, 1.5708),
        lt(),
        -0.7,
        1.55,
        0,
        e,
      ).scale.set(1, 0.8, 1),
      c(
        v(1.5, 0.05, 1.2),
        A(2047902, { emissive: 662080, map: Dt }),
        0.55,
        1.64,
        0,
        e,
      ));
    for (let o of [-1, 0, 1])
      for (let n of [-1, 1]) {
        let r = o * 1;
        (c(M(0.45, 0.45, 0.34, 28), $, r, 0.45, n, e, 1.5708),
          c(M(0.25, 0.25, 0.36, 20), k, r, 0.45, n, e, 1.5708),
          c(M(0.05, 0.05, 0.7, 6), k, r, 0.7, n * 0.8, e, 1.2));
      }
    for (let o of [-0.6, 0.6])
      c(v(0.1, 0.18, 0.3), W(16774856), -1.42, 0.95, o, e);
    (c(M(0.04, 0.04, 1.3, 6), k, 0.9, 2.25, 0.5, e),
      c(z(0.28, 16, 8, 0, 6.2832, 0, 1.2), N, 0.9, 2.9, 0.5, e, 2.2),
      c(M(0.07, 0.07, 1.4, 10), k, 1.5, 1.1, -0.4, e, 0, 0, 1),
      c(M(0.05, 0.05, 0.8, 8), $, 1.9, 0.5, -0.4, e));
  }
  function Bo(e) {
    c(M(0.5, 0.8, 1, 24), $, 0, 0.5, 0, e);
    for (let t = 0; t < 3; t++) {
      let o = t * 2.094 + 0.5;
      (c(
        M(0.07, 0.07, 2.6, 8),
        k,
        Math.cos(o) * 1.6,
        1.1,
        Math.sin(o) * 1.6,
        e,
      ),
        c(z(0.3, 12, 8), $, Math.cos(o) * 1.6, 0.1, Math.sin(o) * 1.6, e));
    }
    for (let t of [2, 3.2, 5.8])
      c(J(1.12, 0.05, 6.2832, 32), $, 0, t, 0, e, 1.5708);
    for (let t = 0; t < 3; t++)
      c(
        z(0.2, 16, 10),
        A(10475775, { emissive: 2775690, roughness: 0.1 }),
        Math.sin(t * 2.094) * 1.02,
        6.8,
        Math.cos(t * 2.094) * 1.02,
        e,
      );
    for (let [t, o] of [
      [-2.8, -0.4],
      [-2.8, 0.4],
      [-2.2, -0.4],
      [-2.2, 0.4],
    ])
      c(v(0.14, 9.5, 0.14), k, t, 4.75, o, e);
    for (let t = 0; t < 6; t++) c(v(0.8, 0.1, 1), k, -2.5, 1 + t * 1.6, 0, e);
    c(v(1.6, 0.2, 0.3), k, -1.5, 6.3, 0, e);
  }
  function xe(e) {
    ((Pe = e),
      C.remove(I),
      (I = new s.Group()),
      C.add(I),
      (Z = []),
      (ke = []),
      (rt = []),
      (Me = 0));
    let t = Pe === "moon",
      o = Qe(7),
      n = new s.PlaneGeometry(400, 400, 200, 200);
    n.rotateX(-Math.PI / 2);
    let r = n.attributes.position,
      a = new s.Color(t ? 10924236 : 13198911),
      d = new s.Color(t ? 5660800 : 8798251),
      u = new s.Color(t ? 8950448 : 11565650),
      h = new s.Color(t ? 12568800 : 14722154),
      w = new s.Color(t ? 2896720 : 4925986),
      R = new s.Color(),
      D = [];
    for (let i = 0; i < r.count; i++) {
      let p = r.getX(i),
        l = r.getZ(i);
      r.setY(i, fe(p, l));
      let x = r.getY(i),
        _ = X(
          0.5 +
            0.3 * Math.sin(p * 0.07 + Math.sin(l * 0.05) * 3) +
            0.2 * Math.sin(l * 0.21 + p * 0.13) +
            0.12 * Math.sin((p + l * 0.6) * 0.9) +
            (Math.random() - 0.5) * 0.18,
          0,
          1,
        );
      (R.copy(d).lerp(a, _),
        R.lerp(h, (Math.sin(x * 2.2 + p * 0.01) * 0.5 + 0.5) * 0.22));
      let y = Math.sin(p * 0.045 + 2) * Math.sin(l * 0.05 - 1);
      (y > 0.55 && R.lerp(w, Math.min(0.7, (y - 0.55) * 2.2)),
        R.multiplyScalar(X(1 + x * 0.05, 0.65, 1.2)),
        Math.hypot(p, l) < 30 && R.lerp(u, 0.5),
        D.push(R.r, R.g, R.b));
    }
    (n.setAttribute("color", new s.Float32BufferAttribute(D, 3)),
      n.computeVertexNormals(),
      I.add(new s.Mesh(n, K(16777215, { vertexColors: !0, map: zo }))));
    for (let i = 0; i < 260; i++) {
      let p = o() * 6.28,
        l = 18 + Math.pow(o(), 0.7) * 150,
        x = Math.cos(p) * l,
        _ = Math.sin(p) * l,
        y = Math.min(0.3 + Math.pow(o(), 3) * 3.2, l < 36 ? 0.45 : 9),
        S = new s.Mesh(
          new s.DodecahedronGeometry(y, y > 1.2 ? 1 : 0),
          K(
            t
              ? o() < 0.5
                ? 7305368
                : 9673915
              : o() < 0.5
                ? 9389616
                : 11033148,
          ),
        );
      (S.position.set(x, fe(x, _) + y * 0.3, _),
        S.rotation.set(o() * 3, o() * 3, 0),
        (S.scale.y = 0.6 + o() * 0.5),
        I.add(S));
    }
    for (let i = 0; i < 28; i++) {
      let p = (i / 28) * 6.283 + o() * 0.2,
        l = t ? 170 + o() * 30 : 115 + o() * 20,
        x = 14 + o() * 34,
        _ = new s.Mesh(
          new s.ConeGeometry(14 + o() * 14, x, 5 + Math.floor(o() * 3)),
          K(t ? 5923974 : 8010280),
        );
      (_.position.set(Math.cos(p) * l, x / 2 - 4, Math.sin(p) * l), I.add(_));
    }
    if (!t)
      for (let i = 0; i < 16; i++) {
        let p = o() * 6.28,
          l = 55 + o() * 70,
          x = Math.cos(p) * l,
          _ = Math.sin(p) * l,
          y = 4 + o() * 7,
          S = new s.Group();
        S.position.set(x, fe(x, _) - 1, _);
        let F = 0;
        for (let L = 0; L < 3 + Math.floor(o() * 3); L++) {
          let P = 1.6 + o() * 2.2,
            St = y * (1 - L * 0.14),
            kt = new s.Mesh(
              new s.CylinderGeometry(St * 0.9, St, P, 7),
              K([11030575, 9322279, 12741186, 8009252][L % 4]),
            );
          ((kt.position.y = F + P / 2), (F += P), S.add(kt));
        }
        I.add(S);
      }
    {
      let i = new s.InstancedMesh(
          new s.DodecahedronGeometry(1),
          K(t ? 8950448 : 10111536),
          1800,
        ),
        p = new s.Object3D();
      for (let l = 0; l < 1800; l++) {
        let x = o() * 6.28,
          _ = 10 + Math.sqrt(o()) * 90,
          y = Math.cos(x) * _,
          S = Math.sin(x) * _,
          F = 0.06 + Math.pow(o(), 2) * 0.3;
        (p.position.set(y, fe(y, S) + F * 0.3, S),
          p.rotation.set(o() * 3, o() * 3, 0),
          p.scale.set(F, F * 0.6, F),
          p.updateMatrix(),
          i.setMatrixAt(l, p.matrix));
      }
      I.add(i);
    }
    let E = (i, p, l, x) => {
      let _ = new s.Group();
      (_.position.set(p, 0, l), x(_));
      let y = { g: _, a: i, x: p, z: l, p: 0 };
      return (_.traverse((S) => (S.userData.o = y)), I.add(_), Z.push(y), y);
    };
    ((Ee = K(2047902, { emissive: 662080 })),
      E("clean", -17, -5, (i) => Ho(i)),
      E("grow", -6, -17, (i) => Po(i)),
      E("shelter", 5, -14, (i) => $o(i)),
      E("generator", 14, -6, (i) => Wo(i)),
      E("shield", 19, 6, (i) => {
        let p = new s.Mesh(
          new s.ConeGeometry(4, 3, 5),
          K(t ? 7042454 : 10635824),
        );
        (p.scale.set(2.2, 1, 1), (p.position.y = 1.5), i.add(p));
      }),
      E("life", 10, 9, (i) => Uo(i)),
      (se = E("rover", -2, 8, (i) => jo(i))));
    let O = (He = new s.Group());
    ((st = 0),
      (at = 0),
      O.position.set(28, 0, -20),
      ot(1.1, 8, 15921906, 0, 4, 0, O),
      ot(1.12, 0.8, 14496563, 0, 4.5, 0, O));
    let q = new s.Mesh(new s.ConeGeometry(1.1, 2, 12), K(14496563));
    ((q.position.y = 9), O.add(q));
    for (let i = 0; i < 3; i++) {
      let p = i * 2.094;
      Ct(
        0.15,
        2,
        1.2,
        14496563,
        Math.cos(p) * 1.3,
        1,
        Math.sin(p) * 1.3,
        O,
      ).rotation.y = -p;
    }
    (Bo(O), I.add(O));
    {
      let i = new s.Mesh(new s.CylinderGeometry(5, 5, 0.12, 20), K(4868690));
      (i.position.set(28, 0.06, -20), I.add(i));
      let p = new s.Group();
      (p.position.set(-5, 0, 3),
        ot(0.06, 3, 13421772, 0, 1.5, 0, p),
        Ct(1.3, 0.8, 0.05, 4033535, 0.7, 2.6, 0, p),
        I.add(p));
    }
    ((b = At(16742981)),
      b.position.set(0, 0, 2),
      I.add(b),
      [4033535, 4054167, 16765517].forEach((i, p) => {
        let l = At(i);
        (l.position.set(-6 + p * 6, 0, -4), I.add(l));
        let x = { g: l, a: "repair", x: 0, z: 0, p: 0, s0: 0.85 };
        (l.traverse((_) => (_.userData.o = x)),
          Z.push(x),
          ke.push({ g: l, o: x, tx: 0, tz: 0, t: 0 }));
      }));
    let Y = t ? 1451085 : 13933170;
    if (
      (C.background.setHex(Y),
      C.fog.color.setHex(Y),
      (C.fog.near = 50),
      (C.fog.far = t ? 240 : 150),
      $e.color.setHex(t ? 11124991 : 16767416),
      $e.groundColor.setHex(t ? 1844290 : 5583650),
      j.color.setHex(t ? 15134463 : 16773341),
      t)
    ) {
      let i = new s.Mesh(
        new s.SphereGeometry(14, 16, 12),
        new s.MeshBasicMaterial({ color: 4029439, fog: !1 }),
      );
      (i.position.set(-150, 110, -230), I.add(i));
    } else {
      let i = new s.Mesh(
        new s.DodecahedronGeometry(6),
        new s.MeshBasicMaterial({ color: 10129288, fog: !1 }),
      );
      (i.position.set(170, 120, -210), I.add(i));
    }
    (I.traverse((i) => {
      if (!i.isMesh) return;
      let p = i.material;
      ((i.receiveShadow = !0),
        (i.castShadow = !(p.transparent || p.vertexColors)));
    }),
      Go(I));
  }
  var T = new s.Color(),
    To = new s.Color(13933170),
    Ko = new s.Color(8014380),
    Vo = new s.Color(7298962);
  function zt() {
    (pe.setSize(innerWidth, innerHeight, !1),
      (H.aspect = innerWidth / innerHeight),
      H.updateProjectionMatrix());
  }
  addEventListener("resize", zt);
  zt();
  var ct = (e) => {
      ge = e;
    },
    dt = () => {
      st = 1;
    };
  function ut(e, t, o) {
    let { running: n, paused: r, over: a, storm: d, dirt: u } = o,
      h = Pe === "moon";
    et += (o.sf - et) * Math.min(1, e * 2);
    let w = et,
      R = n ? b.position.x : 0,
      D = n ? b.position.z : 0;
    if (
      (j.position.set(R + 60, 25 + 45 * w, D + 40),
      j.target.position.set(R, 0, D),
      (j.intensity = h ? 0.05 + 1.3 * w : 0.1 + w),
      ($e.intensity = h ? 0.22 + 0.3 * w : 0.2 + 0.55 * w),
      h)
    )
      (T.setHex(2243188).multiplyScalar(0.3 + 0.7 * w),
        C.background.copy(T),
        C.fog.color.copy(T),
        ve.uniforms.b.value.copy(T),
        ve.uniforms.t.value.setHex(330276).multiplyScalar(0.4 + 0.6 * w));
    else {
      (T.copy(To).multiplyScalar(0.2 + 0.8 * w),
        d > 0 && n && T.lerp(Ko, 0.55),
        C.background.copy(T),
        C.fog.color.copy(T),
        ve.uniforms.b.value.copy(T),
        ve.uniforms.t.value
          .copy(Vo)
          .multiplyScalar(0.2 + 0.8 * w)
          .lerp(T, d > 0 && n ? 0.8 : 0));
      let l = d > 0 && n ? 12 : 50,
        x = d > 0 && n ? 55 : 150;
      ((C.fog.near += (l - C.fog.near) * e),
        (C.fog.far += (x - C.fog.far) * e));
    }
    ((Ot.material.opacity = h ? 1 : (1 - w) * 0.9),
      Ee.color.setHex(2047902).lerp(T.setHex(9071178), u));
    for (let l of Z)
      ((l.p = Math.max(0, l.p - e)),
        l.g.scale.setScalar(
          (l.s0 || 1) * (1 + 0.14 * Math.sin((l.p / 0.4) * 3.14)),
        ));
    if ((o.rover || be % 1) && !r) {
      let l = be + e * 0.11;
      be = !o.rover && Math.floor(l) > Math.floor(be) ? Math.floor(l) : l;
      let x = be % 1,
        _ = se.g.position.x,
        y = se.g.position.z,
        S = se.x + Math.sin(x * Math.PI) * 34,
        F = se.z + Math.sin(x * Math.PI * 2) * 10;
      (se.g.position.set(S, fe(S, F), F),
        Math.hypot(S - _, F - y) > 0.001 &&
          (se.g.rotation.y = Math.atan2(S - _, F - y) + 1.5708));
    }
    st && He && ((at += e * 4), (He.position.y += at * e));
    let E = n ? b.position : new s.Vector3(0, 2, 0);
    {
      let l = We.attributes.position.array,
        x = (d > 0 && n ? 16 : 1.5) * e;
      for (let _ = 0; _ < l.length; _ += 3)
        ((l[_] += x), l[_] > 35 && (l[_] -= 70));
      ((We.attributes.position.needsUpdate = !0),
        Fe.position.set(E.x, 0, E.z),
        Fe.material.color.setHex(h ? 12109544 : 15250570),
        (Fe.material.opacity = h
          ? d > 0 && n
            ? 0.4
            : 0
          : d > 0 && n
            ? 0.7
            : 0.3));
    }
    if (n && !a) {
      let l = X(
          (g.K.KeyW || g.K.ArrowUp ? 1 : 0) -
            (g.K.KeyS || g.K.ArrowDown ? 1 : 0) -
            g.joy.y,
          -1,
          1,
        ),
        x = X(
          (g.K.KeyD || g.K.ArrowRight ? 1 : 0) -
            (g.K.KeyA || g.K.ArrowLeft ? 1 : 0) +
            g.joy.x,
          -1,
          1,
        ),
        _ = 0,
        y = 0;
      l || x
        ? ((g.tgt = null),
          (_ = -Math.sin(g.yaw) * l + Math.cos(g.yaw) * x),
          (y = -Math.cos(g.yaw) * l - Math.sin(g.yaw) * x))
        : g.tgt &&
          ((_ = g.tgt.x - b.position.x),
          (y = g.tgt.z - b.position.z),
          Math.hypot(_, y) < 0.5 && ((g.tgt = null), (_ = y = 0)));
      let S = Math.hypot(_, y);
      if (S > 0) {
        ((_ /= S),
          (y /= S),
          (b.position.x += _ * 7 * e),
          (b.position.z += y * 7 * e));
        let L = Math.hypot(b.position.x, b.position.z);
        L > 38 && ((b.position.x *= 38 / L), (b.position.z *= 38 / L));
        let P = Math.atan2(_, y) - b.rotation.y;
        ((P = Math.atan2(Math.sin(P), Math.cos(P))),
          (b.rotation.y += P * Math.min(1, e * 12)));
      }
      if (
        ((b.position.y =
          fe(b.position.x, b.position.z) +
          (S > 0 ? Math.abs(Math.sin(t / 90)) * 0.12 : 0)),
        nt(b, S > 0, t),
        S > 0 && Math.hypot(b.position.x - tt.x, b.position.z - tt.z) > 1.1)
      ) {
        tt.copy(b.position);
        let L = rt[Me % 80];
        L ||
          ((L = new s.Mesh(
            new s.BoxGeometry(0.3, 0.03, 0.5),
            new s.MeshBasicMaterial({
              color: 0,
              transparent: !0,
              opacity: 0.25,
            }),
          )),
          I.add(L),
          (rt[Me % 80] = L));
        let P = Me % 2 ? 0.2 : -0.2;
        (L.position.set(
          b.position.x + Math.cos(b.rotation.y) * P,
          fe(b.position.x, b.position.z) + 0.03,
          b.position.z - Math.sin(b.rotation.y) * P,
        ),
          (L.rotation.y = b.rotation.y),
          Me++);
      }
      Q = null;
      let F = 9;
      for (let L of Z) {
        let P = Math.hypot(
          L.g.position.x - b.position.x,
          L.g.position.z - b.position.z,
        );
        P < F && ((F = P), (Q = L));
      }
    } else Q = null;
    for (let l of ke) {
      if (
        ((l.o.x = l.g.position.x),
        (l.o.z = l.g.position.z),
        (l.t -= e),
        o.shelter)
      ) {
        let S = ke.indexOf(l);
        ((l.tx = 3 + S * 2), (l.tz = -12), (l.t = 3));
      }
      let x = l.tx - l.g.position.x,
        _ = l.tz - l.g.position.z,
        y = Math.hypot(x, _);
      l.t <= 0 || y < 0.5
        ? ((l.tx = (Math.random() - 0.5) * 36),
          (l.tz = (Math.random() - 0.5) * 30),
          (l.t = 4 + Math.random() * 5))
        : r
          ? nt(l.g, 0, t)
          : ((l.g.position.x += (x / y) * 2.2 * e),
            (l.g.position.z += (_ / y) * 2.2 * e),
            (l.g.rotation.y = Math.atan2(x, _)),
            nt(l.g, 1, t));
    }
    n || (g.yaw += e * 0.12);
    let O = n ? 9 : 45,
      q = O * Math.sin(g.pitch) + (n ? 1.6 : 0),
      Y = O * Math.cos(g.pitch),
      i = E.x + Math.sin(g.yaw) * Y,
      p = E.z + Math.cos(g.yaw) * Y;
    (H.position.lerp(Oo.set(i, E.y + q, p), Math.min(1, e * 6)),
      H.lookAt(E.x, E.y + 1.6, E.z),
      ge > 0 &&
        ((ge = Math.max(0, ge - e * 2)),
        (H.position.x += (Math.random() - 0.5) * ge),
        (H.position.y += (Math.random() - 0.5) * ge)),
      it.position.copy(H.position));
    {
      let l = 25 + 45 * w,
        x = 300 / Math.hypot(60, l, 40);
      (Se.position.set(
        H.position.x + 60 * x,
        H.position.y + l * x,
        H.position.z + 40 * x,
      ),
        Se.lookAt(H.position),
        Se.material.color.setHex(h ? 16054527 : 16773848),
        (Se.visible = w > 0.03));
    }
    pe.render(C, H);
  }
  /* ---- Sol 72: simulation engine + NASA data now live in js/engine.js and js/nasa.js ---- */
  var SE = window.SimEngine,
    Ae = SE.CORE_KEYS,
    Ue = SE.VARIABLES,
    pt = SE.SHORT_MISSION_TUNING,
    qt = SE.init,
    Yt = SE.step,
    Xt = SE.applyAction,
    Jt = SE.debugTriggerEvent,
    Te = SE.getState,
    Zt = SE.getConfig,
    Qt = SE.getReplayLog,
    jt = SE.subscribe,
    U = (e, t, o) => Math.min(o, Math.max(t, e));
  async function to(e, o) {
    return window.Sol72Data.buildEnv(e, o && o.scn);
  }
  var rn = {
      rover: "toggle_rover",
      clean: "clean_panels",
      repair: "toggle_repair",
      grow: "toggle_greenhouse",
      ration: "toggle_ration",
      generator: "toggle_generator",
      shelter: "toggle_shelter",
      shield: "deploy_shielding",
      life: "ls",
    },
    oo = SE.DIFFICULTY;   // difficulty presets live in engine.js (shared with tests and the balance simulator)
  async function no({ loc: e, diff: t, seed: o, live: n = !1, scn: s0 }) {
    let r = await to(e, { live: n, scn: s0 });
    return (
      qt(o, {
        location: e,
        data: r,
        tuning: oo[t].tuning,
        initial: oo[t].initial,
      }),
      Te()
    );
  }
  function ro(e) {
    let t = rn[e];
    return (
      t === "ls" &&
        (t =
          Te().modes.life_support === "eco"
            ? "set_life_support_normal"
            : "set_life_support_eco"),
      Xt(t)
    );
  }
  var ao = Yt,
    Ke = jt,
    Ve = (a, b, c) => {
      let v = Jt(a, b, c);
      return (v && showCards(window.Sol72Learn.onStep(Te(), [v])), v);
    },
    so = Zt,
    io = Qt;
  var lo = Te;
  var ie,
    uo = !1,
    fo = (e) => {
      uo = e;
    };
  function Ie(e, t = 0.15, o = "sine", n = 0, r = 0.07) {
    if (!uo)
      try {
        ((ie = ie || new (window.AudioContext || window.webkitAudioContext)()),
          ie.state === "suspended" && ie.resume());
        let a = ie.currentTime,
          d = ie.createOscillator(),
          u = ie.createGain();
        ((d.type = o),
          d.frequency.setValueAtTime(e, a),
          n &&
            d.frequency.exponentialRampToValueAtTime(
              Math.max(30, e + n),
              a + t,
            ),
          u.gain.setValueAtTime(r, a),
          u.gain.exponentialRampToValueAtTime(0.001, a + t),
          d.connect(u),
          u.connect(ie.destination),
          d.start(),
          d.stop(a + t));
      } catch {}
  }
  var co = {
      rover: [110, 0.5, "sawtooth", 60],
      clean: [700, 0.18, "triangle", 400],
      repair: [900, 0.1, "square", 300],
      grow: [620, 0.16, "triangle", 160],
      ration: [520, 0.14, "square", -120],
      generator: [80, 0.5, "sawtooth", 120],
      shelter: [300, 0.3, "sine", -120],
      shield: [220, 0.35, "triangle", 200],
      life: [600, 0.2, "sine", 300],
      solar_flare: [900, 0.6, "sawtooth", -500],
      micrometeorite: [140, 0.4, "square", -80],
      dust_storm: [200, 0.8, "sawtooth", -60],
      alert: [330, 0.3, "square", 0],
      win: [660, 0.8, "triangle", 400],
      lose: [120, 0.8, "sawtooth", -60],
      error: [150, 0.2, "square", 0],
      tab: [520, 0.06, "triangle", 0],
    },
    le = (e) => co[e] && Ie(...co[e]);
  var sn = window.THREE,
    ho = [
      ["fuel", "Fuel"],
      ["power", "Power"],
      ["oxygen", "Oxygen"],
      ["food", "Food"],
      ["crew_morale", "Morale"],
      ["shielding", "Shielding"],
      ["habitat_health", "Habitat"],
      ["rad", "Radiation"],
    ],
    Oe = {
      rover: ["\u{1F699}", "Drive rover"],
      clean: ["\u{1F9F9}", "Clean panels"],
      repair: ["\u{1F6E0}", "Repair crew"],
      grow: ["\u{1F331}", "Grow food"],
      ration: ["\u{1F37D}", "Ration food"],
      generator: ["\u26FD", "Generator"],
      shelter: ["\u{1F3E0}", "Shelter"],
      shield: ["\u{1F6E1}", "Add shielding"],
      life: ["\u{1F343}", "Life support"],
    },
    yt = Object.keys(Oe),
    po = {
      clean: "Solar array",
      grow: "Greenhouse",
      shelter: "Dome shelter",
      generator: "Generator",
      shield: "Berm",
      life: "Life-support tank",
      rover: "Rover",
    },
    mo = {},
    Le = [],
    qe = new sn.Vector3(),
    V = m("mm").getContext("2d"),
    B = null,
    ce = {},
    xt = "base",
    Xe = (e) => {
      (Le.unshift(e), Le.length > 40 && Le.pop());
    };
  function de(e, t = 2600) {
    let o = m("toast");
    ((o.textContent = e),
      (o.hidden = !1),
      clearTimeout(de.t),
      (de.t = setTimeout(() => {
        o.hidden = !0;
      }, t)));
  }
  function Ye(e) {
    let t = m("ban");
    ((t.textContent = "\u25B2 " + e),
      (t.hidden = !1),
      clearTimeout(Ye.t),
      (Ye.t = setTimeout(() => {
        t.hidden = !0;
      }, 7e3)));
  }
  function _o() {
    ((Le.length = 0), Ne("base"));
  }
  function go(e) {
    (ho.forEach(([t, o]) => {
      let n = document.createElement("div");
      ((n.className = "st"),
        (n.id = "s_" + t),
        (n.innerHTML =
          "<div><span>" + o + "</span><i></i></div><em><u></u></em>"),
        m("stats").appendChild(n));
    }),
      yt.forEach((t) => {
        let o = document.createElement("button");
        ((o.className = "ab"),
          (o.dataset.k = t),
          (o.innerHTML = Oe[t][0] + "<span class=t> " + Oe[t][1] + "</span>"),
          (o.title = Oe[t][1]),
          (o.onclick = () => e(t)),
          m("dock").appendChild(o));
      }));
    for (let t in po) {
      let o = document.createElement("div");
      ((o.className = "lb"),
        (o.textContent = po[t]),
        (o.hidden = !0),
        m("hud").appendChild(o),
        (mo[t] = o));
    }
  }
  function xo(e, t) {
    ((B = e), (ce = t));
    for (let [n] of ho) {
      let r = n === "rad",
        a = r ? X((e.radiation_dose / t.limit) * 100) : e[n],
        d = r ? (e.diagnostics.radiation_msv_h / t.limit) * 100 : e.rates[n],
        u = r ? a > 60 : a <= ((Ue[n] || {}).warn ?? 25),
        h = m("s_" + n);
      ((h.querySelector("i").textContent =
        Math.round(a) +
        "% " +
        (Math.abs(d) < 0.05 ? "" : d > 0 ? "\u25B2" : "\u25BC")),
        (h.title = (d >= 0 ? "+" : "") + d.toFixed(2) + " % per hour"),
        h.classList.toggle("bad", u),
        (h.querySelector("u").style.width = a + "%"));
    }
    m("hr").textContent =
      t.callsign +
      " \xB7 Sol " +
      e.diagnostics.mission_sol +
      " \xB7 Hour " +
      e.hour +
      "/" +
      e.mission_hours +
      " \xB7 Seed " +
      t.seed +
      (e.active_events.some((n) => n.type === "dust_storm")
        ? " \xB7 Dust"
        : "") +
      (e.modes.life_support === "eco" ? " \xB7 ECO" : "");
    let wmsg = window.Sol72Learn.hud(e),
      bn = m("ban");
    wmsg
      ? ((bn.textContent = wmsg), (bn.hidden = !1), (bn.dataset.w = "1"), clearTimeout(Ye.t))
      : bn.dataset.w && ((bn.dataset.w = ""), (bn.hidden = !0));
    let chT = window.Sol72Learn.coach(e),
      chE = m("coach");
    chE && ((chE.textContent = chT ? "\u{1F4A1} " + chT.text : ""), (chE.hidden = !chT || !!wmsg));   // the red flare banner already says it
    let o = e.modes;
    (document.querySelectorAll("#dock .ab").forEach((n) => {
      let r = n.dataset.k;
      n.classList.toggle(
        "on",
        r === "life"
          ? o.life_support === "eco"
          : !!o[r === "clean" || r === "shield" ? "x" : r],
      );
    }),
      xt !== "base" && Ne(xt));
  }
  var gt = (e) => String(e).replace(/[<>&"]/g, "");
  function Ne(e) {
    xt = e;
    let t = m("panel"),
      o = t.scrollTop;
    if (
      (m("tabs")
        .querySelectorAll("button")
        .forEach((h) => h.classList.toggle("on", h.dataset.t === e)),
      e === "base" || !B)
    ) {
      t.hidden = !0;
      return;
    }
    t.hidden = !1;
    let n = B.diagnostics,
      r = (h, w) => "<tr><td>" + h + "</td><td><b>" + w + "</b></td></tr>",
      a = (h) => h.toFixed(1),
      d = (h) => a(h) + " kW";
    t.innerHTML =
      e === "systems"
        ? "<h2>Systems</h2><table>" +
          r("Solar output", d(n.solar_kw)) +
          r("Generator", d(n.generator_kw)) +
          r("Load", d(n.load_kw)) +
          r("Net power", (n.net_kw >= 0 ? "+" : "") + d(n.net_kw)) +
          r("Temperature", Math.round(n.temp_c) + " \xB0C") +
          r("Daylight", Math.round(n.daylight * 100) + "%") +
          r("Dust in the air (tau)", n.tau_effective.toFixed(2)) +
          r("Dust on panels", Math.round(B.panel_dust * 100) + "%") +
          r("Panel integrity", Math.round(B.panel_integrity * 100) + "%") +
          r("Radiation", a(n.radiation_msv_h) + " mSv/h") +
          r("Dose", Math.round(B.radiation_dose) + " / " + ce.limit + " mSv") +
          r("Shield panels left", B.shield_panels_left) +
          window.Sol72Learn.systemsRows(B) +
          r("Life support", B.modes.life_support) +
          (n.blackout ? r("BLACKOUT", "yes") : "") +
          "</table>"
        : e === "mission"
          ? "<h2>Mission</h2><table>" +
            r("Callsign", gt(ce.callsign)) +
            r("World", ce.loc === "moon" ? "Moon" : "Mars") +
            r(
              "Difficulty",
              ce.diff === "cadet" ? "Cadet \xB7 72 h" : "Commander \xB7 96 h",
            ) +
            r("Seed", ce.seed) +
            r("Progress", "Hour " + B.hour + " of " + B.mission_hours) +
            r("Data", gt(ce.source)) +
            window.Sol72Learn.missionRows() +
            '</table><div class=pb><u style="width:' +
            (B.hour / B.mission_hours) * 100 +
            '%"></u></div><button id="rp">Copy replay log</button><br><b>Event log</b><ul>' +
            (Le.slice(0, 12)
              .map((h) => "<li>" + gt(h) + "</li>")
              .join("") || "<li>No events yet</li>") +
            "</ul>"
          : window.Sol72Learn.nasaTab(B);
    let u = m("rp");
    (u && (u.onclick = () => ce.replay()), (t.scrollTop = o));
  }
  function yo(e) {
    let { objs: t, pl: o, cam: n, near: r } = Ce,
      a = m("pr");
    if (!e) {
      a.hidden = !0;
      return;
    }
    ((a.hidden = !r),
      r && (a.textContent = "E \xB7 " + Oe[r.a][1]),
      V.clearRect(0, 0, 110, 110),
      (V.fillStyle = "rgba(0,0,0,.3)"),
      V.fillRect(0, 0, 110, 110));
    let d = (u) => 55 + u * 1.3;
    for (let u of t)
      ((V.fillStyle = u.a === "repair" ? "#9ab" : "#ffc94d"),
        V.beginPath(),
        V.arc(
          d(u.g.position.x),
          d(u.g.position.z),
          u.a === "repair" ? 2 : 3,
          0,
          6.3,
        ),
        V.fill());
    ((V.fillStyle = "#ff7a45"),
      V.beginPath(),
      V.arc(d(o.position.x), d(o.position.z), 4, 0, 6.3),
      V.fill());
    for (let u of t) {
      let h = mo[u.a];
      if (h) {
        if (
          (qe
            .set(
              u.g.position.x,
              u.g.position.y +
                (u.a === "rover" ? 2.4 : u.a === "shelter" ? 7 : 4),
              u.g.position.z,
            )
            .project(n),
          qe.z > 1 || u.g.position.distanceTo(n.position) > 45)
        ) {
          h.hidden = !0;
          continue;
        }
        ((h.hidden = !1),
          (h.style.left = (qe.x * 0.5 + 0.5) * innerWidth + "px"),
          (h.style.top = (-qe.y * 0.5 + 0.5) * innerHeight + "px"),
          (h.style.borderColor = u === r ? "var(--trim)" : "transparent"));
      }
    }
  }
  var Ge = window.THREE;
  function wo(e) {
    let t = g.K;
    (addEventListener("keydown", (i) => {
      ((t[i.code] = 1),
        e.running() &&
          (i.code === "Space"
            ? (i.preventDefault(), e.pause())
            : i.code === "KeyM"
              ? e.mute()
              : i.code === "Escape"
                ? e.panel("base")
                : i.code === "KeyE" && Q
                  ? e.act(Q.a)
                  : /^Digit[1-9]$/.test(i.code)
                    ? e.act(e.order[+i.code.slice(5) - 1])
                    : e.demo && e.demo(i)));
    }),
      addEventListener("keyup", (i) => {
        t[i.code] = 0;
      }),
      addEventListener("blur", () => {
        for (let i in t) t[i] = 0;
      }),
      document.addEventListener("click", (i) => {
        i.target.tagName === "BUTTON" && i.target.blur();
      }));
    let o = new Ge.Raycaster(),
      n = new Ge.Vector2(),
      r = new Ge.Plane(new Ge.Vector3(0, 1, 0), 0),
      a = new Ge.Vector3(),
      d = m("c"),
      u = 0,
      h = 0,
      w = (i) => {
        (n.set(
          (i.clientX / innerWidth) * 2 - 1,
          (-i.clientY / innerHeight) * 2 + 1,
        ),
          o.setFromCamera(n, H));
      },
      R = () =>
        o.intersectObjects(
          Z.map((i) => i.g),
          !0,
        )[0];
    (d.addEventListener("pointerdown", (i) => {
      ((u = i.clientX), (h = i.clientY), (g.drag = 0));
    }),
      d.addEventListener("pointermove", (i) => {
        if (!i.buttons) {
          e.running() && (w(i), (d.style.cursor = R() ? "pointer" : "default"));
          return;
        }
        let p = i.clientX - u,
          l = i.clientY - h;
        ((u = i.clientX),
          (h = i.clientY),
          (g.drag += Math.abs(p) + Math.abs(l)),
          (g.yaw -= p * 0.006),
          (g.pitch = X(g.pitch + l * 0.004, 0.12, 1.2)));
      }),
      d.addEventListener("pointerup", (i) => {
        if (g.drag > 8 || !e.running() || e.over()) return;
        w(i);
        let p = R();
        if (p) {
          let l = p.object.userData.o;
          ((g.tgt = { x: l.x, z: l.z + 4 }), e.act(l.a));
        } else o.ray.intersectPlane(r, a) && (g.tgt = { x: a.x, z: a.z });
      }));
    let D = m("joy"),
      E = m("jk"),
      O = null,
      q = (i) => {
        let p = D.getBoundingClientRect(),
          l = i.clientX - p.left - 55,
          x = i.clientY - p.top - 55,
          _ = Math.min(1, Math.hypot(l, x) / 45),
          y = Math.atan2(x, l);
        ((g.joy.x = Math.cos(y) * _),
          (g.joy.y = Math.sin(y) * _),
          (E.style.transform =
            "translate(" + g.joy.x * 40 + "px," + g.joy.y * 40 + "px)"));
      },
      Y = () => {
        ((O = null), (g.joy.x = g.joy.y = 0), (E.style.transform = ""));
      };
    ((D.onpointerdown = (i) => {
      ((O = i.pointerId), D.setPointerCapture(O), (g.tgt = null), q(i));
    }),
      (D.onpointermove = (i) => {
        i.pointerId === O && q(i);
      }),
      (D.onpointerup = Y),
      (D.onpointercancel = Y));
  }
  var So = new URLSearchParams(location.search),
    bo = 5,
    ue = "mars",
    wt = "cadet",
    Pscn = "today",
    De = 0,
    ae = null,
    _e = null,
    ne = !1,
    te = !1,
    re = !1,
    Je = !1,
    me = 1,
    Ze = 0,
    Mo = {},
    ko = () => {
      document.documentElement.dataset.world = ue;
      const dust = m("sw") && m("sw").querySelector('[data-v="dust2018"]');
      if (dust) {
        dust.disabled = ue === "moon";
        dust.title = ue === "moon" ? "Mars only" : "";
        if (ue === "moon" && Pscn === "dust2018") {
          Pscn = "today";
          m("sw").querySelectorAll("button").forEach((o) => o.classList.toggle("sel", o.dataset.v === "today"));
        }
      }
      m("brief") && (m("brief").innerHTML = window.Sol72Learn.briefing(ue, Pscn));
    },
    cn = () => ({
      loc: ue,
      diff: wt,
      seed: De,
      callsign: m("cs").value || "Commander",
      limit: _e ? _e.tuning.dose_limit_msv : 100,
      source: _e ? _e.environment.source : "",
      replay: dn,
    }),
    bt = () => {
      ae && xo(ae, cn());
    };
  function dn() {
    let e = JSON.stringify(io());
    (navigator.clipboard
      ? navigator.clipboard.writeText(e)
      : Promise.reject()
    ).then(
      () => de("Replay log copied"),
      () => de("Could not copy the replay log"),
    );
  }
  function Mt(e) {
    if (!ne || te || re) return;
    let t = performance.now();
    if (Mo[e] > t) return;
    Mo[e] = t + 400;
    let o = ro(e);
    if (((ae = o.state), de(o.message), !o.ok)) {
      le("error");
      return;
    }
    (Xe("Hour " + ae.hour + " \xB7 " + o.message), le(e));
    let n = Z.find((r) => r.a === e);
    (n && (n.p = 0.4), bt());
  }
  function Eo() {
    let r = ao();
    ((ae = r.state), bt());
    /* Sol 72: learning layer (science cards, end recap) */
    showCards(window.Sol72Learn.onStep(r.state, r.events));
    re && (m("rc").innerHTML = window.Sol72Learn.recap(r.state, !!(r.state.game_over && r.state.game_over.win)));
  }
  /* ---- Sol 72: science cards (pause once, first time something happens) ---- */
  var cardQ = [],
    cardOn = !1,
    cardPaused = !1;
  function showCards(list) {
    for (let c of list) c && cardQ.push(c);
    nextCard();
  }
  function nextCard() {
    if (cardOn || !cardQ.length || re) return;
    let c = cardQ.shift(),
      el = m("sci");
    cardOn = !0;
    if (!te) {
      ((te = !0), (cardPaused = !0), (m("bp").textContent = "\u25B6"));
    }
    el.innerHTML =
      '<h2><span class="ic">' + c.icon + "</span> " + c.title + "</h2>" + c.html +
      (c.src && c.src.u
        ? '<p class="fine">Source: <a href="' + c.src.u + '" target="_blank" rel="noopener">' + c.src.t + "</a></p>"
        : c.src ? '<p class="fine">' + c.src.t + "</p>" : "") +
      '<button id="scx" class="go">CONTINUE \u25B6</button>';
    el.hidden = !1;
    m("scx").onclick = closeCard;
    le("tab");
  }
  function closeCard() {
    m("sci").hidden = !0;
    cardOn = !1;
    cardPaused && ((cardPaused = !1), (te = !1), (m("bp").textContent = "\u23F8"));
    nextCard();
  }
  Ke("event", (e) => {
    e.phase === "end" ||
      (Ye(e.message),
      Xe("Hour " + (ae ? ae.hour : 0) + " \xB7 " + e.message),
      le(e.type),
      e.type === "micrometeorite" && ct(e.severity === "severe" ? 1 : 0.5));
  });
  Ke("alert", (e) => {
    (Xe("Hour " + e.hour + " \xB7 " + e.message), de(e.message), le("alert"));
  });
  Ke("gameover", (e) => {
    ((cardQ.length = 0), (cardOn = !1), (m("sci").hidden = !0));
    ((re = !0),
      (m("end").querySelector("h2").textContent = e.win
        ? "\u{1F680} Mission complete"
        : "Mission lost"),
      (m("end").querySelector("p").textContent =
        e.reason +
        " (hour " +
        e.hour +
        "). Seed " +
        De +
        " replays the same events."));
    let t = lo(),
      rt = SE.rating(t),
      o = rt.stars;
    ((m("stars").textContent = "\u2605".repeat(o) + "\u2606".repeat(3 - o)),
      (m("end").querySelector("p").textContent +=
        e.win
          ? "  \u2605 Survived" +
            (rt.research ? "  \u2605 Research goal met" : "  \u2606 Research goal missed (drive the rover in daylight)") +
            (rt.healthy ? "  \u2605 Well-run base" : "  \u2606 Not well-run (finish with battery, a sound habitat, happy crew, low dose)")
          : ""),
      e.win && dt(),
      (m("end").hidden = !1),
      le(e.win ? "win" : "lose"));
  });
  function vt() {
    if (cardOn) return closeCard();
    ((te = !te),
      (m("bp").textContent = te ? "\u25B6" : "\u23F8"),
      (m("paused").hidden = !te),
      Ie(te ? 300 : 500, 0.1, "square"));
  }
  function Co() {
    ((Je = !Je),
      fo(Je),
      (m("bm").textContent = Je ? "\u{1F507}" : "\u{1F50A}"));
  }
  async function un() {
    ((De = parseInt(m("sd").value) || Math.floor(Math.random() * 9e5 + 1e5)),
      (m("sd").value = De),
      (ae = await no({ loc: ue, diff: wt, seed: De, live: So.has("live"), scn: Pscn })),
      (_e = so()),
      window.Sol72Learn.reset({
        loc: ue, diff: wt, seed: De, cards: m("cards").checked, episode: window.Sol72Data.episode(Pscn, ue),
        config: _e, sols: _e.environment.daily || [],
      }),
      (cardQ.length = 0),
      (cardOn = !1),
      (m("sci").hidden = !0),
      (m("rc").innerHTML = ""),
      xe(ue),
      (g.tgt = null),
      (g.yaw = 0),
      (Ze = 0),
      (te = !1),
      (re = !1),
      (me = 1),
      (m("bp").textContent = "\u23F8"),
      (m("bs").textContent = "1\xD7"),
      (m("paused").hidden = !0),
      _o(),
      (m("menu").hidden = !0),
      (m("end").hidden = !0),
      (m("hud").hidden = !1),
      (ne = !0),
      bt(),
      Ie(440, 0.4, "sine", 500),
      de("WASD to walk \xB7 tap objects to act \xB7 Space pauses", 7e3),
      showCards([window.Sol72Learn.welcome(ae)]));
  }
  go(Mt);
  m("tabs")
    .querySelectorAll("button")
    .forEach((e) => {
      e.onclick = () => {
        (Ne(e.dataset.t), le("tab"));
      };
    });
  for (let e of ["wd", "df", "sw"])
    m(e)
      .querySelectorAll("button")
      .forEach((t) => {
        t.onclick = () => {
          (m(e)
            .querySelectorAll("button")
            .forEach((o) => o.classList.remove("sel")),
            t.classList.add("sel"),
            e === "wd"
              ? ((ue = t.dataset.v), ko(), xe(ue))
              : e === "sw"
                ? ((Pscn = t.dataset.v), ko())
                : (wt = t.dataset.v),
            le("tab"));
        };
      });
  m("bp").onclick = vt;
  m("bm").onclick = Co;
  m("pr").onclick = () => {
    Q && Mt(Q.a);
  };
  m("go").onclick = un;
  m("bs").onclick = () => {
    ((me = me === 1 ? 2 : me === 2 ? 4 : 1),
      (m("bs").textContent = me + "\xD7"),
      Ie(400 + me * 100, 0.08, "square"));
  };
  m("again").onclick = () => {
    ((m("paused").hidden = !0),
      (m("end").hidden = !0),
      (m("rc").innerHTML = ""),
      (m("sci").hidden = !0),
      (m("hud").hidden = !0),
      (m("menu").hidden = !1),
      (ne = !1),
      (m("sd").value = ""),
      xe(ue));
  };
  var fn = So.has("demo")
    ? (e) => {
        let t = e.shiftKey ? 2 : 1;
        e.code === "KeyZ"
          ? Ve("dust_storm", t)
          : e.code === "KeyX"
            ? Ve("solar_flare", t)
            : e.code === "KeyC"
              ? Ve("micrometeorite", t)
              : e.code === "KeyN" && !re && Eo();
      }
    : null;
  wo({
    running: () => ne,
    over: () => re,
    act: Mt,
    pause: vt,
    mute: Co,
    panel: Ne,
    order: yt,
    demo: fn,
  });
  document.addEventListener("visibilitychange", () => {
    document.hidden && ne && !te && !re && vt();
  });
  var vo = 0;
  function Ao(e) {
    requestAnimationFrame(Ao);
    let t = Math.min(0.05, (e - vo) / 1e3 || 0.016);
    if (((vo = e), ne && !te && !re))
      for (Ze += t * me; Ze >= bo && ((Ze -= bo), Eo(), !re););
    let o = ne ? ae : null;
    (ut(t, e, {
      running: ne,
      paused: te,
      over: re,
      sf: o ? o.diagnostics.daylight : 0.8,
      storm: !!o && o.active_events.some((n) => n.type === "dust_storm"),
      dirt: o
        ? Math.min(1, o.panel_dust / (_e ? _e.tuning.panel_dust_max : 0.6))
        : 0,
      rover: !!o && o.modes.rover,
      shelter: !!o && o.modes.shelter,
    }),
      yo(ne));
  }
  ko();
  xe(ue);
  window.Sol72Data.onUpdate(() => ko());
  window.Sol72Data.init();
  requestAnimationFrame(Ao);
})();
