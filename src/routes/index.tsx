import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Crosshair,
  Square,
  MoveUpRight,
  Spline,
  Minus,
  Circle,
  Sun,
  RectangleHorizontal,
  PenLine,
  Type,
  Upload,
  MonitorUp,
  Download,
  Save,
  FolderOpen,
  X,
  Undo2,
  Redo2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordSample, trajectoryPosition, type TrajectorySample } from "@/lib/live-trajectory";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prancheta Pro — Editor de vídeos de basquete" },
      {
        name: "description",
        content: "Desenhe jogadas sobre vídeos de basquete e exporte para as redes sociais.",
      },
      { property: "og:title", content: "Prancheta Pro — Editor de vídeos de basquete" },
      {
        property: "og:description",
        content: "Setas, círculos, zonas e textos sobre o vídeo. Exporte pronto para publicar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Editor,
});

type Tool = "arrow" | "dashed" | "line" | "circle" | "zone" | "pen" | "text" | "spot";
type Pt = { x: number; y: number };
type Shape = {
  id: number;
  tool: Tool;
  pts: Pt[];
  color: string;
  width: number;
  start: number;
  dur: number;
  text?: string;
  trajectory?: TrajectorySample[];
};
type Aspect = "source" | "vertical" | "square" | "landscape";
type ProjectFile = {
  version: 1;
  shapes: Shape[];
  width: number;
  dur: number;
  aspect: Aspect;
  clipStart: number;
  clipEnd: number;
};

const TOOLS: { id: Tool; label: string; icon: LucideIcon }[] = [
  { id: "arrow", label: "Seta (passe/corte)", icon: MoveUpRight },
  { id: "dashed", label: "Seta tracejada (passe)", icon: Spline },
  { id: "line", label: "Linha / bloqueio", icon: Minus },
  { id: "circle", label: "Círculo no jogador", icon: Circle },
  { id: "spot", label: "Holofote", icon: Sun },
  { id: "zone", label: "Zona", icon: RectangleHorizontal },
  { id: "pen", label: "Livre", icon: PenLine },
  { id: "text", label: "Texto", icon: Type },
];
const COLORS: string[] = ["#ff7a1a", "#ffd60a", "#ffffff", "#2ee6a6", "#3aa0ff", "#ff3b5c"];
const ASPECTS: { id: Aspect; label: string; ratio: number | null }[] = [
  { id: "source", label: "Original", ratio: null },
  { id: "vertical", label: "9:16 · Reels", ratio: 9 / 16 },
  { id: "square", label: "1:1 · Feed", ratio: 1 },
  { id: "landscape", label: "16:9 · YouTube", ratio: 16 / 9 },
];

function drawShape(ctx: CanvasRenderingContext2D, s: Shape, W: number, H: number, t: number) {
  const anchor = s.pts[0];
  const position = s.trajectory ? trajectoryPosition(s.trajectory, t - s.start) : undefined;
  const p = s.pts.map((q) => ({
    x: (q.x + (position && anchor ? position.x - anchor.x : 0)) * W,
    y: (q.y + (position && anchor ? position.y - anchor.y : 0)) * H,
  }));
  if (!p.length) return;
  const k = W / 1000;
  const lw = s.width * k;
  const a = s.trajectory ? 1 : Math.min(1, (t - s.start) / 0.25);
  ctx.save();
  ctx.globalAlpha = isFinite(a) ? Math.max(0, a) : 1;
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0,0,0,.6)";
  ctx.shadowBlur = 6 * k;
  const a0 = p[0],
    b = p[p.length - 1];
  if (!a0 || !b) {
    ctx.restore();
    return;
  }
  const head = (from: Pt, to: Pt) => {
    const ang = Math.atan2(to.y - from.y, to.x - from.x),
      L = lw * 4;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - L * Math.cos(ang - 0.45), to.y - L * Math.sin(ang - 0.45));
    ctx.lineTo(to.x - L * Math.cos(ang + 0.45), to.y - L * Math.sin(ang + 0.45));
    ctx.closePath();
    ctx.fill();
  };
  switch (s.tool) {
    case "arrow":
    case "dashed":
    case "line": {
      if (s.tool === "dashed") ctx.setLineDash([lw * 2.5, lw * 2]);
      ctx.beginPath();
      ctx.moveTo(a0.x, a0.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      if (s.tool === "line") {
        const ang = Math.atan2(b.y - a0.y, b.x - a0.x) + Math.PI / 2,
          L = lw * 4;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(b.x + L * Math.cos(ang), b.y + L * Math.sin(ang));
        ctx.lineTo(b.x - L * Math.cos(ang), b.y - L * Math.sin(ang));
        ctx.stroke();
      } else head(a0, b);
      break;
    }
    case "pen": {
      ctx.beginPath();
      p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
      const tail = p[p.length - 4];
      if (tail) head(tail, b);
      break;
    }
    case "circle":
    case "spot": {
      const rx = Math.abs(b.x - a0.x) || 30 * k,
        ry = rx * 0.4;
      if (s.tool === "spot") {
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(0,0,0,.55)";
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.ellipse(a0.x, a0.y - ry * 2, rx, ry * 4, 0, 0, Math.PI * 2, true);
        ctx.fill("evenodd");
        ctx.fillStyle = s.color;
      }
      ctx.beginPath();
      ctx.ellipse(a0.x, a0.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha *= 0.25;
      ctx.fill();
      break;
    }
    case "zone": {
      ctx.globalAlpha *= 0.3;
      ctx.fillRect(a0.x, a0.y, b.x - a0.x, b.y - a0.y);
      ctx.globalAlpha /= 0.3;
      ctx.strokeRect(a0.x, a0.y, b.x - a0.x, b.y - a0.y);
      break;
    }
    case "text": {
      const fs = s.width * 6 * k;
      ctx.font = `700 ${fs}px "Bebas Neue", sans-serif`;
      const w = ctx.measureText(s.text || "").width;
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(10,10,12,.8)";
      ctx.fillRect(a0.x - fs * 0.3, a0.y - fs, w + fs * 0.6, fs * 1.25);
      ctx.fillStyle = s.color;
      ctx.fillText(s.text || "", a0.x, a0.y);
      break;
    }
  }
  ctx.restore();
}

function shapeBounds(shape: Shape): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = shape.pts.map((point) => point.x);
  const ys = shape.pts.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function hitShape(shape: Shape, point: Pt, padding = 0.035): boolean {
  const bounds = shapeBounds(shape);
  return (
    point.x >= bounds.minX - padding &&
    point.x <= bounds.maxX + padding &&
    point.y >= bounds.minY - padding &&
    point.y <= bounds.maxY + padding
  );
}

function drawSelection(ctx: CanvasRenderingContext2D, shape: Shape, W: number, H: number) {
  const bounds = shapeBounds(shape);
  const x = bounds.minX * W;
  const y = bounds.minY * H;
  const width = Math.max(0.04 * W, (bounds.maxX - bounds.minX) * W);
  const height = Math.max(0.04 * H, (bounds.maxY - bounds.minY) * H);
  const handle = Math.max(8, Math.min(14, W / 80));
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 4, y - 4, width + 8, height + 8);
  ctx.setLineDash([]);
  ctx.fillStyle = "#ff7a1a";
  ctx.fillRect(x + width - handle / 2, y + height - handle / 2, handle, handle);
  ctx.restore();
}

const fmt = (t: number) =>
  `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}.${Math.floor((t % 1) * 10)}`;

function Editor() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("arrow");
  const [color, setColor] = useState<string>(COLORS[0] ?? "");
  const [width, setWidth] = useState(6);
  const [dur, setDur] = useState(3);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [liveMode, setLiveMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(0);
  const [aspect, setAspect] = useState<Aspect>("source");
  const [projectMessage, setProjectMessage] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [, setHistoryVersion] = useState(0);
  const liveRef = useRef<{ shape: Shape; point: Pt } | null>(null);
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const exportCancelRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const ffmpegRef = useRef<import("@ffmpeg/ffmpeg").FFmpeg | null>(null);
  const ffmpegLoadedRef = useRef(false);
  const pastRef = useRef<Shape[][]>([]);
  const futureRef = useRef<Shape[][]>([]);
  const interactionRef = useRef<{
    mode: "move" | "resize";
    id: number;
    origin: Pt;
    before: Shape[];
  } | null>(null);

  const recordShapes = (next: Shape[]) => {
    pastRef.current = [...pastRef.current, shapesRef.current].slice(-50);
    futureRef.current = [];
    shapesRef.current = next;
    setShapes(next);
    setHistoryVersion((version) => version + 1);
  };
  const resetShapes = (next: Shape[] = []) => {
    pastRef.current = [];
    futureRef.current = [];
    shapesRef.current = next;
    setShapes(next);
    setHistoryVersion((version) => version + 1);
  };
  const undo = () => {
    const previous = pastRef.current.pop();
    if (!previous) return;
    futureRef.current = [...futureRef.current, shapesRef.current].slice(-50);
    shapesRef.current = previous;
    setShapes(previous);
    setSelected(null);
    setHistoryVersion((version) => version + 1);
  };
  const redo = () => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current = [...pastRef.current, shapesRef.current].slice(-50);
    shapesRef.current = next;
    setShapes(next);
    setSelected(null);
    setHistoryVersion((version) => version + 1);
  };

  const finishRecording = () => {
    const live = liveRef.current,
      v = videoRef.current;
    if (!live || !v) return;
    const elapsed = Math.max(0, v.currentTime - live.shape.start);
    const trajectory = recordSample(live.shape.trajectory ?? [], live.point, elapsed);
    const shape = { ...live.shape, trajectory, dur: elapsed };
    liveRef.current = null;
    if (elapsed > 0) {
      recordShapes([...shapesRef.current, shape]);
      setSelected(shape.id);
    }
    setRecording(false);
    v.pause();
  };

  // render loop
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const v = videoRef.current,
        c = canvasRef.current;
      if (v && c) {
        const ctx = c.getContext("2d");
        if (!ctx) {
          raf = requestAnimationFrame(loop);
          return;
        }
        ctx.clearRect(0, 0, c.width, c.height);
        const t = v.currentTime;
        const live = liveRef.current;
        if (live) {
          live.shape.trajectory = recordSample(
            live.shape.trajectory ?? [],
            live.point,
            Math.max(0, t - live.shape.start),
          );
          drawShape(ctx, live.shape, c.width, c.height, t);
        }
        for (const s of shapesRef.current)
          if (t >= s.start && t <= s.start + s.dur) drawShape(ctx, s, c.width, c.height, t);
        const selectedShape = shapesRef.current.find((shape) => shape.id === selectedRef.current);
        if (
          selectedShape &&
          t >= selectedShape.start &&
          t <= selectedShape.start + selectedShape.dur
        )
          drawSelection(ctx, selectedShape, c.width, c.height);
        if (draftRef.current)
          drawShape(ctx, { ...draftRef.current, start: -1 }, c.width, c.height, 99);
        setTime(t);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
        return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const onLoaded = () => {
    const v = videoRef.current,
      c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    setLength(v.duration);
    setClipEnd(v.duration);
  };

  const pos = (e: { clientX: number; clientY: number }): Pt => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  };
  const down = (e: React.PointerEvent) => {
    const v = videoRef.current;
    if (!src || !v || exporting !== null || liveRef.current) return;
    const p = pos(e);

    const hit = [...shapesRef.current]
      .reverse()
      .find(
        (shape) =>
          v.currentTime >= shape.start &&
          v.currentTime <= shape.start + shape.dur &&
          hitShape(shape, p),
      );
    if (hit) {
      const bounds = shapeBounds(hit);
      const nearHandle =
        Math.abs(p.x - bounds.maxX) <= 0.06 &&
        Math.abs(p.y - bounds.maxY) <= 0.06 &&
        hit.pts.length > 1;
      v.pause();
      setSelected(hit.id);
      interactionRef.current = {
        mode: nearHandle ? "resize" : "move",
        id: hit.id,
        origin: p,
        before: shapesRef.current.map((shape) => ({
          ...shape,
          pts: shape.pts.map((point) => ({ ...point })),
        })),
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    const base = { id: Date.now(), tool, color, width, start: v.currentTime, dur };
    if (liveMode) {
      if (v.ended) {
        v.currentTime = 0;
        base.start = 0;
      }
      const shape: Shape = {
        ...base,
        tool: tool === "spot" ? "spot" : "circle",
        pts: [p, { x: p.x + 0.035, y: p.y }],
        trajectory: [{ ...p, time: 0 }],
      };
      liveRef.current = { shape, point: p };
      setRecording(true);
      setSelected(null);
      e.currentTarget.setPointerCapture(e.pointerId);
      void v.play().catch(() => {
        liveRef.current = null;
        setRecording(false);
      });
      return;
    }
    v.pause();
    if (tool === "text") {
      const textShape: Shape = { ...base, pts: [p], text: "Texto" };
      recordShapes([...shapesRef.current, textShape]);
      setSelected(textShape.id);
      return;
    }
    (e.target as Element).setPointerCapture(e.pointerId);
    setDraft({ ...base, pts: [p, p] });
  };
  const move = (e: React.PointerEvent) => {
    if (liveRef.current) {
      liveRef.current.point = pos(e);
      return;
    }
    const interaction = interactionRef.current;
    if (interaction) {
      const point = pos(e);
      const dx = point.x - interaction.origin.x;
      const dy = point.y - interaction.origin.y;
      const next = interaction.before.map((shape) => {
        if (shape.id !== interaction.id) return shape;
        if (interaction.mode === "resize") {
          const pts = shape.pts.map((item, index) =>
            index === shape.pts.length - 1 ? { x: point.x, y: point.y } : { ...item },
          );
          return { ...shape, pts };
        }
        return {
          ...shape,
          pts: shape.pts.map((item) => ({
            x: Math.max(0, Math.min(1, item.x + dx)),
            y: Math.max(0, Math.min(1, item.y + dy)),
          })),
        };
      });
      shapesRef.current = next;
      setShapes(next);
      return;
    }
    if (!draft) return;
    const p = pos(e);
    const first = draft.pts[0];
    if (!first) return;
    setDraft({ ...draft, pts: draft.tool === "pen" ? [...draft.pts, p] : [first, p] });
  };
  const up = () => {
    if (liveRef.current) {
      finishRecording();
      return;
    }
    const interaction = interactionRef.current;
    if (interaction) {
      if (JSON.stringify(interaction.before) !== JSON.stringify(shapesRef.current)) {
        pastRef.current = [...pastRef.current, interaction.before].slice(-50);
        futureRef.current = [];
        setHistoryVersion((version) => version + 1);
      }
      interactionRef.current = null;
      return;
    }
    if (draft) recordShapes([...shapesRef.current, draft]);
    setDraft(null);
  };
  const doubleClick = (e: React.MouseEvent) => {
    const v = videoRef.current;
    if (!v || exporting !== null) return;
    const point = pos(e);
    const hit = [...shapesRef.current]
      .reverse()
      .find(
        (shape) =>
          v.currentTime >= shape.start &&
          v.currentTime <= shape.start + shape.dur &&
          hitShape(shape, point),
      );
    if (!hit) return;
    setSelected(hit.id);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
    } else {
      v.pause();
    }
  };
  const seek = (t: number) => {
    const v = videoRef.current;
    if (v && !liveRef.current && exporting === null)
      v.currentTime = Math.max(0, Math.min(v.duration || 0, t));
  };

  const convertToMp4 = async (input: Blob): Promise<Blob> => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { fetchFile, toBlobURL } = await import("@ffmpeg/util");
    const ffmpeg = ffmpegRef.current ?? new FFmpeg();
    ffmpegRef.current = ffmpeg;
    if (!ffmpegLoadedRef.current) {
      setConverting(true);
      setProjectMessage("Carregando conversor MP4 pela primeira vez (aprox. 31 MB)…");
      const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      ffmpegLoadedRef.current = true;
    }
    setConverting(true);
    setProjectMessage("Convertendo o vídeo para MP4 compatível…");
    await ffmpeg.writeFile("input.webm", await fetchFile(input));
    await ffmpeg.exec([
      "-i",
      "input.webm",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "output.mp4",
    ]);
    const data = await ffmpeg.readFile("output.mp4");
    if (typeof data === "string") throw new Error("FFmpeg retornou saída inválida");
    return new Blob([new Uint8Array(data)], { type: "video/mp4" });
  };

  const exportVideo = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || liveRef.current) return;
    const start = Math.max(0, Math.min(clipStart, v.duration));
    const end = Math.max(start + 0.05, Math.min(clipEnd || v.duration, v.duration));
    const selectedAspect = ASPECTS.find((item) => item.id === aspect);
    const ratio = selectedAspect?.ratio ?? v.videoWidth / v.videoHeight;
    const out = document.createElement("canvas");
    out.width =
      aspect === "source" ? v.videoWidth : Math.round(Math.min(1080, v.videoHeight * ratio));
    out.height = aspect === "source" ? v.videoHeight : Math.round(out.width / ratio);
    const ctx = out.getContext("2d");
    if (!ctx) return;
    const stream = out.captureStream(30);
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      const audioContext = audioContextRef.current;
      if (!audioSourceRef.current) {
        audioSourceRef.current = audioContext.createMediaElementSource(v);
        audioDestinationRef.current = audioContext.createMediaStreamDestination();
        audioSourceRef.current.connect(audioDestinationRef.current);
        audioSourceRef.current.connect(audioContext.destination);
      }
      await audioContext.resume();
      audioDestinationRef.current?.stream
        .getAudioTracks()
        .forEach((track) => stream.addTrack(track));
    } catch {
      setExportError("O vídeo será exportado sem áudio porque o navegador bloqueou o áudio.");
    }
    const mime = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find(
      (item) => MediaRecorder.isTypeSupported(item),
    );
    if (!mime) {
      setExportError("Este navegador não permite exportar vídeos.");
      return;
    }
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    setExportError(null);
    setExporting(0);
    setSelected(null);
    exportCancelRef.current = false;
    v.pause();
    await new Promise<void>((resolve) => {
      const onSeeked = () => resolve();
      v.addEventListener("seeked", onSeeked, { once: true });
      v.currentTime = start;
    });
    const drawVideo = () => {
      const sourceRatio = v.videoWidth / v.videoHeight;
      const destinationRatio = out.width / out.height;
      let sx = 0;
      let sy = 0;
      let sw = v.videoWidth;
      let sh = v.videoHeight;
      if (sourceRatio > destinationRatio) {
        sw = v.videoHeight * destinationRatio;
        sx = (v.videoWidth - sw) / 2;
      }
      if (sourceRatio < destinationRatio) {
        sh = v.videoWidth / destinationRatio;
        sy = (v.videoHeight - sh) / 2;
      }
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, out.width, out.height);
      const t = v.currentTime;
      for (const shape of shapesRef.current)
        if (t >= shape.start && t <= shape.start + shape.dur)
          drawShape(ctx, shape, out.width, out.height, t);
    };
    let raf = 0;
    const frame = () => {
      drawVideo();
      setExporting(Math.max(0, Math.min(1, (v.currentTime - start) / (end - start))));
      if (!exportCancelRef.current && v.currentTime < end) raf = requestAnimationFrame(frame);
    };
    frame();
    rec.start(200);
    await v.play();
    await new Promise<void>((resolve) => {
      const check = () => {
        if (exportCancelRef.current || v.currentTime >= end || v.ended) {
          resolve();
          return;
        }
        requestAnimationFrame(check);
      };
      check();
    });
    v.pause();
    cancelAnimationFrame(raf);
    const stopped = new Promise<void>((resolve) =>
      rec.addEventListener("stop", () => resolve(), { once: true }),
    );
    rec.stop();
    await stopped;
    if (!exportCancelRef.current) {
      const recordedBlob = new Blob(chunks, { type: mime });
      let blob: Blob;
      try {
        blob = mime.includes("mp4") ? recordedBlob : await convertToMp4(recordedBlob);
      } catch {
        setExportError("Não foi possível converter o vídeo para MP4 neste navegador.");
        stream.getTracks().forEach((track) => track.stop());
        setExporting(null);
        setConverting(false);
        return;
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `jogada-${aspect}.mp4`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }
    stream.getTracks().forEach((track) => track.stop());
    setExporting(null);
    setConverting(false);
  };

  const cancelExport = () => {
    exportCancelRef.current = true;
  };

  const sel = shapes.find((s) => s.id === selected);
  const upd = (patch: Partial<Shape>) =>
    selected !== null &&
    recordShapes(shapesRef.current.map((s) => (s.id === selected ? { ...s, ...patch } : s)));
  const saveProject = () => {
    const project: ProjectFile = { version: 1, shapes, width, dur, aspect, clipStart, clipEnd };
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }),
    );
    link.download = "prancheta-pro-projeto.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    setProjectMessage("Projeto salvo. Para reabrir, carregue o JSON e depois o vídeo original.");
  };
  const openProject = async (file: File) => {
    try {
      const project = JSON.parse(await file.text()) as ProjectFile;
      if (project.version !== 1 || !Array.isArray(project.shapes))
        throw new Error("invalid project");
      resetShapes(project.shapes);
      setWidth(project.width);
      setDur(project.dur);
      setAspect(project.aspect);
      setClipStart(project.clipStart);
      setClipEnd(project.clipEnd);
      setProjectMessage("Projeto carregado. Abra o vídeo original para visualizar as marcações.");
    } catch {
      setProjectMessage("Não foi possível abrir este projeto.");
    }
  };
  const resetProjectMessage = () => {
    if (projectMessage) setProjectMessage(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <h1 className="font-display text-3xl tracking-wide">
          PRANCHETA<span className="text-primary">PRO</span>
        </h1>
        <div className="flex gap-2">
          <label
            className={`inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary ${recording || exporting !== null ? "opacity-40" : "cursor-pointer"}`}
          >
            <Upload className="h-4 w-4" /> Abrir vídeo
            <input
              type="file"
              accept="video/*"
              disabled={recording || exporting !== null}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (src) URL.revokeObjectURL(src);
                  setSrc(URL.createObjectURL(f));
                  resetShapes();
                  setSelected(null);
                  setTime(0);
                  setLength(0);
                  setClipStart(0);
                  setClipEnd(0);
                  setExportError(null);
                  resetProjectMessage();
                }
              }}
            />
          </label>
          <ScreenCapture
            disabled={recording || exporting !== null}
            onCaptured={(url) => {
              if (src) URL.revokeObjectURL(src);
              setSrc(url);
              resetShapes();
              setSelected(null);
              setTime(0);
              setLength(0);
              setClipStart(0);
              setClipEnd(0);
              setExportError(null);
              resetProjectMessage();
            }}
          />
          <button
            disabled={recording || exporting !== null}
            onClick={saveProject}
            title="Salvar marcações e configurações"
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary"
          >
            <Save className="h-4 w-4" />
          </button>
          <label
            title="Abrir projeto JSON"
            className="cursor-pointer rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary"
          >
            <FolderOpen className="h-4 w-4" />
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void openProject(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          {exporting !== null && (
            <button
              onClick={cancelExport}
              className="rounded-lg bg-destructive px-3 py-2 text-sm font-bold text-destructive-foreground"
              title="Cancelar exportação"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            disabled={!src || !length || recording || exporting !== null}
            onClick={() => void exportVideo()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-[var(--shadow-glow)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            {converting
              ? "Convertendo MP4…"
              : exporting !== null
                ? `Exportando ${Math.round(exporting * 100)}%`
                : "Exportar vídeo"}
          </button>
        </div>
      </header>
      {projectMessage && (
        <p
          role="status"
          className="border-b border-border bg-secondary px-6 py-2 text-sm text-muted-foreground"
        >
          {projectMessage}
        </p>
      )}

      <div className="grid gap-4 p-4 lg:grid-cols-[220px_1fr_260px]">
        <aside className="space-y-4 rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Ferramentas
          </p>
          <Button
            variant={liveMode ? "default" : "secondary"}
            className="w-full"
            aria-pressed={liveMode}
            disabled={recording || exporting !== null}
            onClick={() => {
              setLiveMode(!liveMode);
              if (!liveMode) setTool("circle");
            }}
          >
            <Crosshair /> Trajeto ao vivo
          </Button>
          {recording && (
            <Button variant="destructive" className="w-full" onClick={finishRecording}>
              <Square /> Encerrar gravação
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                disabled={
                  recording ||
                  exporting !== null ||
                  (liveMode && t.id !== "circle" && t.id !== "spot")
                }
                onClick={() => setTool(t.id)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:opacity-40 ${tool === t.id ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent"}`}
              >
                <t.icon className="h-4 w-4 shrink-0" />
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Cor</p>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  if (selected !== null)
                    recordShapes(
                      shapesRef.current.map((shape) =>
                        shape.id === selected ? { ...shape, color: c } : shape,
                      ),
                    );
                }}
                aria-label={c}
                style={{ background: c }}
                className={`h-7 w-7 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`}
              />
            ))}
          </div>
          <label className="block text-xs text-muted-foreground">
            Espessura: {width}
            <input
              type="range"
              min={2}
              max={14}
              value={width}
              onChange={(e) => setWidth(+e.target.value)}
              className="w-full accent-primary"
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Duração na tela: {dur}s
            <input
              type="range"
              min={0.5}
              max={15}
              step={0.5}
              value={dur}
              onChange={(e) => setDur(+e.target.value)}
              className="w-full accent-primary"
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Formato de exportação
            <select
              value={aspect}
              onChange={(e) => setAspect(e.target.value as Aspect)}
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
            >
              {ASPECTS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </aside>

        <main className="space-y-3">
          <div className="relative overflow-hidden rounded-lg bg-muted">
            {src ? (
              <>
                <video
                  ref={videoRef}
                  src={src}
                  onLoadedMetadata={onLoaded}
                  onPlay={() => setPlaying(true)}
                  onPause={() => {
                    setPlaying(false);
                    if (liveRef.current) finishRecording();
                  }}
                  onEnded={finishRecording}
                  className="block w-full"
                  playsInline
                />
                <canvas
                  ref={canvasRef}
                  aria-label="Marcações sobre o vídeo"
                  onPointerDown={down}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerCancel={up}
                  onLostPointerCapture={up}
                  onDoubleClick={doubleClick}
                  className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
                />
              </>
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-2 text-center">
                <p className="font-display text-4xl">Abra um vídeo de jogo</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Pause no momento da jogada, escolha uma ferramenta e desenhe sobre o vídeo. Depois
                  exporte para as redes.
                </p>
                <video ref={videoRef} className="hidden" />
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}
          </div>
          {recording && (
            <p role="status" className="text-sm font-semibold text-destructive">
              ● Gravando trajeto · {fmt(time)}
            </p>
          )}
          {exportError && (
            <p role="alert" className="text-sm text-destructive">
              {exportError}
            </p>
          )}
          {src && (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-3">
                <button
                  disabled={recording || exporting !== null}
                  onClick={togglePlay}
                  className="w-20 rounded-md bg-secondary py-1.5 text-sm font-bold"
                >
                  {playing ? "Pausar" : "Play"}
                </button>
                <button
                  onClick={() => seek(Math.max(0, time - 1 / 30))}
                  className="rounded-md bg-secondary px-2 py-1.5 text-sm"
                >
                  ◀ quadro
                </button>
                <button
                  onClick={() => seek(time + 1 / 30)}
                  className="rounded-md bg-secondary px-2 py-1.5 text-sm"
                >
                  quadro ▶
                </button>
                <span className="ml-auto font-mono text-sm text-muted-foreground">
                  {fmt(time)} / {fmt(length || 0)}
                </span>
              </div>
              <div className="relative mt-3 h-10">
                <input
                  type="range"
                  min={0}
                  max={length || 0}
                  step={0.01}
                  value={time}
                  onChange={(e) => seek(+e.target.value)}
                  className="absolute inset-x-0 top-0 w-full accent-primary"
                />
                {length > 0 &&
                  shapes.map((s) => (
                    <button
                      key={s.id}
                      aria-label={`Selecionar ${s.trajectory ? "trajeto" : "marcação"} em ${fmt(s.start)}`}
                      onClick={() => {
                        setSelected(s.id);
                        seek(s.start);
                      }}
                      style={{
                        left: `${(s.start / length) * 100}%`,
                        width: `${Math.max(0.5, (s.dur / length) * 100)}%`,
                        background: s.color,
                      }}
                      className={`absolute top-6 h-3 rounded-sm opacity-80 ${selected === s.id ? "ring-2 ring-foreground" : ""}`}
                    />
                  ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <label>
                  Início do trecho: {fmt(clipStart)}
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, clipEnd - 0.05)}
                    step={0.05}
                    value={clipStart}
                    onChange={(e) => setClipStart(+e.target.value)}
                    className="w-full accent-primary"
                  />
                </label>
                <label>
                  Fim do trecho: {fmt(clipEnd || length)}
                  <input
                    type="range"
                    min={Math.min(length, clipStart + 0.05)}
                    max={length || 0}
                    step={0.05}
                    value={clipEnd || length}
                    onChange={(e) => setClipEnd(+e.target.value)}
                    className="w-full accent-primary"
                  />
                </label>
              </div>
            </div>
          )}
        </main>

        <aside className="space-y-3 rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Marcações ({shapes.length})
            </p>
            <div className="flex gap-1">
              <button
                onClick={undo}
                disabled={pastRef.current.length === 0}
                title="Desfazer (Ctrl/Cmd+Z)"
                className="rounded p-1 text-primary hover:bg-secondary disabled:opacity-30"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                onClick={redo}
                disabled={futureRef.current.length === 0}
                title="Refazer (Ctrl/Cmd+Shift+Z)"
                className="rounded p-1 text-primary hover:bg-secondary disabled:opacity-30"
              >
                <Redo2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <ul className="max-h-72 space-y-1 overflow-auto">
            {shapes.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => {
                    setSelected(s.id);
                    seek(s.start);
                  }}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${selected === s.id ? "bg-accent" : "hover:bg-secondary"}`}
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
                  {s.trajectory
                    ? "Trajeto"
                    : TOOLS.find((t) => t.id === s.tool)?.label.split(" ")[0]}{" "}
                  {s.text ? `“${s.text}”` : ""}
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {fmt(s.start)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {sel && (
            <div className="space-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <p className="font-bold uppercase tracking-widest text-foreground">Propriedades</p>
                <span>{TOOLS.find((item) => item.id === sel.tool)?.label}</span>
              </div>
              {sel.tool === "text" && (
                <label className="block">
                  Texto
                  <textarea
                    value={sel.text ?? ""}
                    onChange={(event) => upd({ text: event.target.value })}
                    rows={3}
                    autoFocus
                    className="mt-1 w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                    placeholder="Digite o texto da marcação"
                  />
                </label>
              )}
              <div>
                <span className="block">Cor</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {COLORS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-label={`Usar cor ${item}`}
                      onClick={() => {
                        setColor(item);
                        upd({ color: item });
                      }}
                      style={{ background: item }}
                      className={`h-6 w-6 rounded-full border-2 ${sel.color === item ? "border-foreground" : "border-transparent"}`}
                    />
                  ))}
                </div>
              </div>
              <label className="block">
                Espessura: {sel.width}
                <input
                  type="range"
                  min={2}
                  max={14}
                  value={sel.width}
                  onChange={(event) => {
                    const value = +event.target.value;
                    setWidth(value);
                    upd({ width: value });
                  }}
                  className="w-full accent-primary"
                />
              </label>
              <label className="block">
                Início: {fmt(sel.start)}
                <input
                  type="range"
                  min={0}
                  max={length}
                  step={0.05}
                  value={sel.start}
                  onChange={(e) => {
                    upd({ start: +e.target.value });
                    seek(+e.target.value);
                  }}
                  className="w-full accent-primary"
                />
              </label>
              <label className="block">
                Duração: {sel.dur}s
                <input
                  type="range"
                  min={0.5}
                  max={15}
                  step={0.5}
                  value={sel.dur}
                  onChange={(e) => upd({ dur: +e.target.value })}
                  className="w-full accent-primary"
                />
              </label>
              <button
                onClick={() => {
                  recordShapes(shapesRef.current.filter((s) => s.id !== selected));
                  setSelected(null);
                }}
                className="w-full rounded-md bg-destructive py-1.5 font-semibold text-destructive-foreground"
              >
                Apagar marcação
              </button>
            </div>
          )}
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            Dica: o vídeo pausa sozinho ao desenhar. Cada marcação aparece pelo tempo definido a
            partir do momento em que foi feita.
          </p>
        </aside>
      </div>
    </div>
  );
}

function ScreenCapture({
  disabled,
  onCaptured,
}: {
  disabled: boolean;
  onCaptured: (url: string) => void;
}) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Seu navegador não suporta captura de tela. Use o Chrome ou Edge no computador.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      const mime = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "video/mp4",
      ].find((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(
        stream,
        mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined,
      );
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setActive(false);
        if (chunks.length)
          onCaptured(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || "video/webm" })));
      };
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (rec.state !== "inactive") rec.stop();
      });
      rec.start(500);
      recRef.current = rec;
      setActive(true);
    } catch {
      setError("Captura cancelada ou não permitida.");
    }
  };

  return (
    <div className="relative">
      {active ? (
        <button
          onClick={() => recRef.current?.stop()}
          className="animate-pulse rounded-md bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground"
        >
          ● Parar captura
        </button>
      ) : (
        <button
          disabled={disabled}
          onClick={start}
          title="Grave uma aba do YouTube ou qualquer janela"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-40"
        >
          <MonitorUp className="h-4 w-4" /> Capturar tela / YouTube
        </button>
      )}
      {error && (
        <p className="absolute right-0 top-full z-10 mt-1 w-64 rounded bg-card p-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
