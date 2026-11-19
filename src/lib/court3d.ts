import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

export type Vec2 = { x: number; z: number };
export type PlayerKey = { t: number; x: number; z: number };
export type BoardPlayer = {
  num: number;
  team: "off" | "def";
  keys: PlayerKey[];
};
export type BoardArrow = { t0: number; t1: number; from: Vec2; to: Vec2; lift?: number };
export type BallKey = { t: number; x: number; z: number; y: number };
export type BoardPlay = {
  id: string;
  name: string;
  duration: number;
  players: BoardPlayer[];
  arrows: BoardArrow[];
  ball: BallKey[];
};

export type BoardTexts = { hook: string; subtitle: string; cta: string };

const COURT_LENGTH = 14;
const COURT_WIDTH = 15;
const ACCENT = 0xff7a1a;
const DEFENSE = 0x38b6ff;
const SCENE_SCALE = 0.457;

const easeInOut = (v: number) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);

function sampleKeys<T extends { t: number; x: number; z: number; y?: number }>(
  keys: T[],
  t: number,
): T {
  if (!keys.length) throw new Error("sem keyframes");
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  if (t <= first.t) return first;
  if (t >= last.t) return last;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const a = keys[i]!;
    const b = keys[i + 1]!;
    if (t >= a.t && t <= b.t) {
      const raw = (t - a.t) / Math.max(0.0001, b.t - a.t);
      const k = easeInOut(Math.max(0, Math.min(1, raw)));
      const mixed: T = {
        ...b,
        t,
        x: a.x + (b.x - a.x) * k,
        z: a.z + (b.z - a.z) * k,
      };
      if (typeof a.y === "number" && typeof b.y === "number") mixed.y = a.y + (b.y - a.y) * k;
      return mixed;
    }
  }
  return last;
}

function line(points: THREE.Vector3[], color: number, opacity = 1) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  return new THREE.Line(geometry, material);
}

function arcPoints(
  cx: number,
  cz: number,
  radius: number,
  from: number,
  to: number,
  segments = 64,
) {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = from + ((to - from) * i) / segments;
    points.push(
      new THREE.Vector3(cx + Math.cos(angle) * radius, 0.02, cz + Math.sin(angle) * radius),
    );
  }
  return points;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);
  return lines;
}

type TextSpec = { text: string; size: number; weight: number; color: string };

function textTexture(specs: TextSpec[], canvasWidth = 1024, padding = 24) {
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d indisponível");

  const rendered: { text: string; size: number; weight: number; color: string }[] = [];
  specs.forEach((spec) => {
    ctx.font = `${spec.weight} ${spec.size}px "Anton", "Bebas Neue", Impact, sans-serif`;
    wrap(ctx, spec.text, canvasWidth - padding * 2).forEach((piece) => {
      rendered.push({ text: piece, size: spec.size, weight: spec.weight, color: spec.color });
    });
  });

  const totalHeight = rendered.reduce((sum, item) => sum + item.size * 1.18, 0) + padding * 2;
  canvas.height = Math.ceil(totalHeight);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  let y = padding;
  rendered.forEach((item) => {
    ctx.font = `${item.weight} ${item.size}px "Anton", "Bebas Neue", Impact, sans-serif`;
    ctx.textBaseline = "top";
    ctx.shadowColor = "rgba(0,0,0,.85)";
    ctx.shadowBlur = 22;
    ctx.fillStyle = item.color;
    ctx.fillText(item.text, padding, y);
    y += item.size * 1.18;
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return { texture, width: canvas.width, height: canvas.height };
}

export type Board = {
  setSize: (width: number, height: number) => void;
  setPlay: (play: BoardPlay) => void;
  setTexts: (texts: BoardTexts) => void;
  setTime: (time: number) => void;
  render: () => void;
  dispose: () => void;
};

export function createBoard(canvas: HTMLCanvasElement): Board {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070a);
  scene.fog = new THREE.Fog(0x05070a, 14, 34);

  const camera = new THREE.PerspectiveCamera(38, 9 / 16, 0.1, 200);
  camera.position.set(13, 12.5, 0.1);
  camera.lookAt(0, -0.2, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(4, 16, 9);
  scene.add(key);
  const rimLight = new THREE.DirectionalLight(ACCENT, 0.7);
  rimLight.position.set(-8, 8, -10);
  scene.add(rimLight);

  // Grupo raiz centraliza a quadra e reduz para caber no quadro 9:16
  const root = new THREE.Group();
  root.scale.setScalar(SCENE_SCALE);
  root.position.set(-(COURT_LENGTH / 2) * SCENE_SCALE, -1.05, 0);
  scene.add(root);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(COURT_LENGTH + 2, COURT_WIDTH + 2),
    new THREE.MeshStandardMaterial({ color: 0x121c26, roughness: 0.85, metalness: 0.15 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(COURT_LENGTH / 2, -0.02, 0);
  root.add(floor);

  const court = new THREE.Group();
  const half = COURT_WIDTH / 2;
  const lineColor = 0x86a6c0;
  court.add(
    line(
      [
        new THREE.Vector3(0, 0.02, -half),
        new THREE.Vector3(COURT_LENGTH, 0.02, -half),
        new THREE.Vector3(COURT_LENGTH, 0.02, half),
        new THREE.Vector3(0, 0.02, half),
        new THREE.Vector3(0, 0.02, -half),
      ],
      lineColor,
      1,
    ),
  );
  const paint = new THREE.Mesh(
    new THREE.PlaneGeometry(5.8, 4.9),
    new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.07 }),
  );
  paint.rotation.x = -Math.PI / 2;
  paint.position.set(2.9, 0.008, 0);
  court.add(paint);
  court.add(
    line(
      [
        new THREE.Vector3(0, 0.02, -2.45),
        new THREE.Vector3(5.8, 0.02, -2.45),
        new THREE.Vector3(5.8, 0.02, 2.45),
        new THREE.Vector3(0, 0.02, 2.45),
      ],
      lineColor,
    ),
  );
  court.add(line(arcPoints(5.8, 0, 1.8, Math.PI / 2, -Math.PI / 2), lineColor));
  const threeRadius = 6.75;
  const cornerZ = 6.6;
  const startAngle = Math.asin(cornerZ / threeRadius);
  court.add(line(arcPoints(1.6, 0, threeRadius, -startAngle, startAngle), ACCENT, 0.95));
  court.add(
    line(
      [
        new THREE.Vector3(0, 0.02, cornerZ),
        new THREE.Vector3(1.6 + Math.cos(startAngle) * threeRadius * 0.98, 0.02, cornerZ),
      ],
      ACCENT,
      0.7,
    ),
  );
  court.add(
    line(
      [
        new THREE.Vector3(0, 0.02, -cornerZ),
        new THREE.Vector3(1.6 + Math.cos(startAngle) * threeRadius * 0.98, 0.02, -cornerZ),
      ],
      ACCENT,
      0.7,
    ),
  );
  court.add(
    line(
      [new THREE.Vector3(COURT_LENGTH, 0.02, -half), new THREE.Vector3(COURT_LENGTH, 0.02, half)],
      lineColor,
    ),
  );

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 1.05, 1.8),
    new THREE.MeshStandardMaterial({ color: 0xd8e6f2, emissive: 0x1d2a36, roughness: 0.4 }),
  );
  board.position.set(1.25, 3.05, 0);
  court.add(board);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.23, 0.025, 12, 40),
    new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 2.2 }),
  );
  rim.position.set(1.6, 3.05, 0);
  rim.rotation.x = Math.PI / 2;
  court.add(rim);
  const net = new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.14, 0.42, 18, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x9fb4c7,
      transparent: true,
      opacity: 0.3,
      wireframe: true,
    }),
  );
  net.position.set(1.6, 2.83, 0);
  court.add(net);
  root.add(court);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.7, 0.22);
  composer.addPass(bloom);

  const playersGroup = new THREE.Group();
  const arrowsGroup = new THREE.Group();
  root.add(playersGroup, arrowsGroup);

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 24, 24),
    new THREE.MeshStandardMaterial({
      color: 0xffb066,
      emissive: 0xff7a1a,
      emissiveIntensity: 1.8,
      roughness: 0.35,
    }),
  );
  root.add(ball);

  const numberTexture = (num: number, color: number) => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("canvas 2d indisponível");
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, Math.PI * 2);
    ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
    ctx.fill();
    ctx.fillStyle = "#05070a";
    ctx.font = '700 62px "Anton", "Bebas Neue", Impact, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(num), 64, 68);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  type Token = { group: THREE.Group; keys: PlayerKey[] };
  let tokens: Token[] = [];
  type ArrowObj = {
    line: THREE.Mesh;
    head: THREE.Mesh;
    data: BoardArrow;
    curve: THREE.QuadraticBezierCurve3;
  };
  let arrowObjects: ArrowObj[] = [];
  let play: BoardPlay | null = null;

  const clearGroup = (group: THREE.Group) => {
    group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material?.dispose();
    });
    group.clear();
  };

  const buildPlayer = (player: BoardPlayer) => {
    const color = player.team === "off" ? ACCENT : DEFENSE;
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.5, 0.1, 32),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.5,
        roughness: 0.35,
        metalness: 0.2,
      }),
    );
    base.position.y = 0.05;
    group.add(base);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.25, 1.0, 18),
      new THREE.MeshStandardMaterial({
        color: player.team === "off" ? 0x2a1508 : 0x071a26,
        emissive: color,
        emissiveIntensity: 0.3,
        roughness: 0.6,
      }),
    );
    body.position.y = 0.62;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 20, 20),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.0,
        roughness: 0.4,
      }),
    );
    head.position.y = 1.26;
    group.add(head);
    if (player.team === "off") {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: numberTexture(player.num, color), transparent: true }),
      );
      sprite.scale.set(0.92, 0.92, 1);
      sprite.position.y = 2.05;
      group.add(sprite);
    }
    return group;
  };

  const buildArrow = (data: BoardArrow): ArrowObj => {
    const start = new THREE.Vector3(data.from.x, 0.12, data.from.z);
    const end = new THREE.Vector3(data.to.x, 0.12, data.to.z);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    mid.y += data.lift ?? 1.5;
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const geometry = new THREE.TubeGeometry(curve, 64, 0.11, 8, false);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffb066,
      emissive: ACCENT,
      emissiveIntensity: 1.9,
      roughness: 0.35,
    });
    const lineObj = new THREE.Mesh(geometry, material);
    geometry.setDrawRange(0, 0);
    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.8, 18),
      new THREE.MeshStandardMaterial({ color: 0xffb066, emissive: ACCENT, emissiveIntensity: 2.2 }),
    );
    head.visible = false;
    return { line: lineObj, head, data, curve };
  };

  const setPlay = (next: BoardPlay) => {
    play = next;
    clearGroup(playersGroup);
    clearGroup(arrowsGroup);
    tokens = next.players.map((player) => {
      const group = buildPlayer(player);
      playersGroup.add(group);
      return { group, keys: player.keys };
    });
    arrowObjects = next.arrows.map((arrow) => {
      const built = buildArrow(arrow);
      arrowsGroup.add(built.line, built.head);
      return built;
    });
  };

  // Textos fixos, presos à câmera
  const SPRITE_DISTANCE = 6;
  const visibleWidth = 2 * SPRITE_DISTANCE * Math.tan((38 * Math.PI) / 360) * (9 / 16);
  const spriteWidth = visibleWidth * 0.9;

  const makeSprite = (specs: TextSpec[]) => {
    const { texture, width: texW, height: texH } = textTexture(specs);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    const height = (spriteWidth * texH) / texW;
    sprite.scale.set(spriteWidth, height, 1);
    sprite.position.z = -SPRITE_DISTANCE;
    camera.add(sprite);
    return sprite;
  };

  let hookSprite: THREE.Sprite | null = null;
  let subtitleSprite: THREE.Sprite | null = null;
  let ctaSprite: THREE.Sprite | null = null;

  const disposeSprite = (sprite: THREE.Sprite | null) => {
    if (!sprite) return;
    camera.remove(sprite);
    sprite.material.map?.dispose();
    sprite.material.dispose();
  };

  const setTexts = ({ hook, subtitle, cta }: BoardTexts) => {
    disposeSprite(hookSprite);
    disposeSprite(subtitleSprite);
    disposeSprite(ctaSprite);
    hookSprite = makeSprite([
      { text: hook.toUpperCase(), size: 68, weight: 800, color: "#ffffff" },
    ]);
    hookSprite.position.set(0, 1.58, -SPRITE_DISTANCE);
    subtitleSprite = makeSprite([{ text: subtitle, size: 46, weight: 600, color: "#ff9a4d" }]);
    subtitleSprite.position.set(0, 0.92, -SPRITE_DISTANCE);
    ctaSprite = makeSprite([{ text: cta, size: 34, weight: 600, color: "#c9d6e2" }]);
    ctaSprite.position.set(0, -1.72, -SPRITE_DISTANCE);
  };
  scene.add(camera);

  const setTime = (time: number) => {
    tokens.forEach((token) => {
      const key = sampleKeys(token.keys, time);
      token.group.position.set(key.x, 0, key.z);
    });
    if (play) {
      const ballKey = sampleKeys(play.ball, time);
      const bounce = Math.abs(Math.sin(time * 7)) * 0.16;
      ball.position.set(
        ballKey.x,
        Math.max(0.18, ballKey.y) + (ballKey.y < 0.5 ? bounce : 0),
        ballKey.z,
      );
    }
    arrowObjects.forEach((arrow) => {
      const { t0, t1 } = arrow.data;
      const progress = Math.max(0, Math.min(1, (time - t0) / Math.max(0.001, t1 - t0)));
      const visible = time >= t0 && time <= t1 + 0.5;
      arrow.line.visible = visible;
      arrow.head.visible = visible && progress > 0.08;
      const indexCount = arrow.line.geometry.index?.count ?? 0;
      arrow.line.geometry.setDrawRange(0, Math.max(0, Math.round(indexCount * progress)));
      const point = arrow.curve.getPoint(Math.max(0.02, progress));
      arrow.head.position.copy(point);
      const tangent = arrow.curve.getTangent(Math.max(0.02, progress)).normalize();
      arrow.head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    });
    const drift = Math.sin(time * 0.25) * 0.25;
    camera.position.z = 0.1 + drift;
    camera.lookAt(0, -0.2, 0);
  };

  const setSize = (width: number, height: number) => {
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  };

  const render = () => composer.render();

  const dispose = () => {
    clearGroup(playersGroup);
    clearGroup(arrowsGroup);
    composer.dispose();
    renderer.dispose();
  };

  return { setSize, setPlay, setTexts, setTime, render, dispose };
}
