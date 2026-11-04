import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prancheta Pro — Editor de vídeos de basquete" },
      { name: "description", content: "Desenhe jogadas sobre vídeos de basquete e exporte para as redes sociais." },
      { property: "og:title", content: "Prancheta Pro — Editor de vídeos de basquete" },
      { property: "og:description", content: "Setas, círculos, zonas e textos sobre o vídeo. Exporte pronto para publicar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Editor,
});

type Tool = "arrow" | "dashed" | "line" | "circle" | "zone" | "pen" | "text" | "spot";
type Pt = { x: number; y: number };
type Shape = { id: number; tool: Tool; pts: Pt[]; color: string; width: number; start: number; dur: number; text?: string };

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: "arrow", label: "Seta (passe/corte)", icon: "➜" },
  { id: "dashed", label: "Seta tracejada (passe)", icon: "⇢" },
  { id: "line", label: "Linha / bloqueio", icon: "┤" },
  { id: "circle", label: "Círculo no jogador", icon: "◯" },
  { id: "spot", label: "Holofote", icon: "◉" },
  { id: "zone", label: "Zona", icon: "▭" },
  { id: "pen", label: "Livre", icon: "✎" },
  { id: "text", label: "Texto", icon: "T" },
];
const COLORS = ["#ff7a1a", "#ffd60a", "#ffffff", "#2ee6a6", "#3aa0ff", "#ff3b5c"];

function drawShape(ctx: CanvasRenderingContext2D, s: Shape, W: number, H: number, t: number) {
  const p = s.pts.map((q) => ({ x: q.x * W, y: q.y * H }));
  if (!p.length) return;
  const k = W / 1000;
  const lw = s.width * k;
  const a = Math.min(1, (t - s.start) / 0.25);
  ctx.save();
  ctx.globalAlpha = isFinite(a) ? Math.max(0, a) : 1;
  ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = lw;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 6 * k;
  const a0 = p[0], b = p[p.length - 1];
  const head = (from: Pt, to: Pt) => {
    const ang = Math.atan2(to.y - from.y, to.x - from.x), L = lw * 4;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - L * Math.cos(ang - 0.45), to.y - L * Math.sin(ang - 0.45));
    ctx.lineTo(to.x - L * Math.cos(ang + 0.45), to.y - L * Math.sin(ang + 0.45));
    ctx.closePath(); ctx.fill();
  };
  switch (s.tool) {
    case "arrow": case "dashed": case "line": {
      if (s.tool === "dashed") ctx.setLineDash([lw * 2.5, lw * 2]);
      ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (s.tool === "line") {
        const ang = Math.atan2(b.y - a0.y, b.x - a0.x) + Math.PI / 2, L = lw * 4;
        ctx.setLineDash([]); ctx.beginPath();
        ctx.moveTo(b.x + L * Math.cos(ang), b.y + L * Math.sin(ang));
        ctx.lineTo(b.x - L * Math.cos(ang), b.y - L * Math.sin(ang)); ctx.stroke();
      } else head(a0, b);
      break;
    }
    case "pen": {
      ctx.beginPath(); p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
      if (p.length > 4) head(p[p.length - 4], b);
      break;
    }
    case "circle": case "spot": {
      const rx = Math.abs(b.x - a0.x) || 30 * k, ry = (rx * 0.4);
      if (s.tool === "spot") {
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(0,0,0,.55)";
        ctx.beginPath(); ctx.rect(0, 0, W, H);
        ctx.ellipse(a0.x, a0.y - ry * 2, rx, ry * 4, 0, 0, Math.PI * 2, true); ctx.fill("evenodd");
        ctx.fillStyle = s.color;
      }
      ctx.beginPath(); ctx.ellipse(a0.x, a0.y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha *= 0.25; ctx.fill();
      break;
    }
    case "zone": {
      ctx.globalAlpha *= 0.3; ctx.fillRect(a0.x, a0.y, b.x - a0.x, b.y - a0.y);
      ctx.globalAlpha /= 0.3; ctx.strokeRect(a0.x, a0.y, b.x - a0.x, b.y - a0.y);
      break;
    }
    case "text": {
      const fs = s.width * 6 * k;
      ctx.font = `700 ${fs}px "Bebas Neue", sans-serif`;
      const w = ctx.measureText(s.text || "").width;
      ctx.shadowBlur = 0; ctx.fillStyle = "rgba(10,10,12,.8)";
      ctx.fillRect(a0.x - fs * 0.3, a0.y - fs, w + fs * 0.6, fs * 1.25);
      ctx.fillStyle = s.color; ctx.fillText(s.text || "", a0.x, a0.y);
      break;
    }
  }
  ctx.restore();
}

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}.${Math.floor((t % 1) * 10)}`;

function Editor() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("arrow");
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(6);
  const [dur, setDur] = useState(3);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const shapesRef = useRef(shapes); shapesRef.current = shapes;
  const draftRef = useRef(draft); draftRef.current = draft;

  // render loop
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const v = videoRef.current, c = canvasRef.current;
      if (v && c) {
        const ctx = c.getContext("2d")!;
        ctx.clearRect(0, 0, c.width, c.height);
        const t = v.currentTime;
        for (const s of shapesRef.current) if (t >= s.start && t <= s.start + s.dur) drawShape(ctx, s, c.width, c.height, t);
        if (draftRef.current) drawShape(ctx, { ...draftRef.current, start: -1 }, c.width, c.height, 99);
        setTime(t);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onLoaded = () => {
    const v = videoRef.current!, c = canvasRef.current!;
    c.width = v.videoWidth; c.height = v.videoHeight; setLength(v.duration);
  };

  const pos = (e: React.PointerEvent): Pt => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const down = (e: React.PointerEvent) => {
    if (!src || exporting !== null) return;
    videoRef.current!.pause();
    const p = pos(e);
    const base = { id: Date.now(), tool, color, width, start: videoRef.current!.currentTime, dur };
    if (tool === "text") {
      const text = prompt("Texto da marcação:");
      if (text) setShapes((s) => [...s, { ...base, pts: [p], text }]);
      return;
    }
    (e.target as Element).setPointerCapture(e.pointerId);
    setDraft({ ...base, pts: [p, p] });
  };
  const move = (e: React.PointerEvent) => {
    if (!draft) return;
    const p = pos(e);
    setDraft({ ...draft, pts: draft.tool === "pen" ? [...draft.pts, p] : [draft.pts[0], p] });
  };
  const up = () => {
    if (draft) setShapes((s) => [...s, draft]);
    setDraft(null);
  };

  const togglePlay = () => { const v = videoRef.current!; v.paused ? v.play() : v.pause(); };
  const seek = (t: number) => { videoRef.current!.currentTime = t; };

  const exportVideo = async () => {
    const v = videoRef.current!;
    const out = document.createElement("canvas");
    out.width = v.videoWidth; out.height = v.videoHeight;
    const ctx = out.getContext("2d")!;
    const stream = out.captureStream(30);
    try {
      const ac = new AudioContext();
      const srcNode = ac.createMediaElementSource(v);
      const dest = ac.createMediaStreamDestination();
      srcNode.connect(dest); srcNode.connect(ac.destination);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    } catch { /* already connected or no audio */ }
    const mime = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m))!;
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    setExporting(0); setSelected(null);
    v.pause(); v.currentTime = 0;
    await new Promise((r) => (v.onseeked = r)); v.onseeked = null;
    let raf = 0;
    const frame = () => {
      ctx.drawImage(v, 0, 0, out.width, out.height);
      const t = v.currentTime;
      for (const s of shapesRef.current) if (t >= s.start && t <= s.start + s.dur) drawShape(ctx, s, out.width, out.height, t);
      setExporting(t / v.duration);
      raf = requestAnimationFrame(frame);
    };
    frame();
    rec.start(200);
    await v.play();
    await new Promise((r) => (v.onended = r)); v.onended = null;
    cancelAnimationFrame(raf);
    rec.stop();
    await new Promise((r) => (rec.onstop = r));
    const blob = new Blob(chunks, { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `jogada.${mime.includes("mp4") ? "mp4" : "webm"}`;
    a.click();
    setExporting(null);
  };

  const sel = shapes.find((s) => s.id === selected);
  const upd = (patch: Partial<Shape>) => setShapes((ss) => ss.map((s) => (s.id === selected ? { ...s, ...patch } : s)));

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <h1 className="font-display text-3xl tracking-wide">PRANCHETA<span className="text-primary">PRO</span></h1>
        <div className="flex gap-2">
          <label className="cursor-pointer rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">
            Abrir vídeo
            <input type="file" accept="video/*" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]; if (f) { setSrc(URL.createObjectURL(f)); setShapes([]); }
            }} />
          </label>
          <button disabled={!src || exporting !== null} onClick={exportVideo}
            className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40">
            {exporting !== null ? `Exportando ${Math.round(exporting * 100)}%` : "Exportar vídeo"}
          </button>
        </div>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[220px_1fr_260px]">
        <aside className="space-y-4 rounded-lg bg-card p-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Ferramentas</p>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {TOOLS.map((t) => (
              <button key={t.id} onClick={() => setTool(t.id)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${tool === t.id ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent"}`}>
                <span className="w-5 text-center text-lg">{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Cor</p>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} aria-label={c} style={{ background: c }}
                className={`h-7 w-7 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`} />
            ))}
          </div>
          <label className="block text-xs text-muted-foreground">Espessura: {width}
            <input type="range" min={2} max={14} value={width} onChange={(e) => setWidth(+e.target.value)} className="w-full accent-primary" /></label>
          <label className="block text-xs text-muted-foreground">Duração na tela: {dur}s
            <input type="range" min={0.5} max={15} step={0.5} value={dur} onChange={(e) => setDur(+e.target.value)} className="w-full accent-primary" /></label>
        </aside>

        <main className="space-y-3">
          <div className="relative overflow-hidden rounded-lg bg-muted">
            {src ? (
              <>
                <video ref={videoRef} src={src} onLoadedMetadata={onLoaded} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
                  className="block w-full" playsInline />
                <canvas ref={canvasRef} onPointerDown={down} onPointerMove={move} onPointerUp={up}
                  className="absolute inset-0 h-full w-full cursor-crosshair touch-none" />
              </>
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-2 text-center">
                <p className="font-display text-4xl">Abra um vídeo de jogo</p>
                <p className="max-w-sm text-sm text-muted-foreground">Pause no momento da jogada, escolha uma ferramenta e desenhe sobre o vídeo. Depois exporte para as redes.</p>
                <video ref={videoRef} className="hidden" /><canvas ref={canvasRef} className="hidden" />
              </div>
            )}
          </div>
          {src && (
            <div className="rounded-lg bg-card p-3">
              <div className="flex items-center gap-3">
                <button onClick={togglePlay} className="w-20 rounded-md bg-secondary py-1.5 text-sm font-bold">{playing ? "Pausar" : "Play"}</button>
                <button onClick={() => seek(Math.max(0, time - 1 / 30))} className="rounded-md bg-secondary px-2 py-1.5 text-sm">◀ quadro</button>
                <button onClick={() => seek(time + 1 / 30)} className="rounded-md bg-secondary px-2 py-1.5 text-sm">quadro ▶</button>
                <span className="ml-auto font-mono text-sm text-muted-foreground">{fmt(time)} / {fmt(length || 0)}</span>
              </div>
              <div className="relative mt-3 h-10">
                <input type="range" min={0} max={length || 0} step={0.01} value={time} onChange={(e) => seek(+e.target.value)}
                  className="absolute inset-x-0 top-0 w-full accent-primary" />
                {length > 0 && shapes.map((s) => (
                  <button key={s.id} onClick={() => { setSelected(s.id); seek(s.start); }}
                    style={{ left: `${(s.start / length) * 100}%`, width: `${Math.max(0.5, (s.dur / length) * 100)}%`, background: s.color }}
                    className={`absolute top-6 h-3 rounded-sm opacity-80 ${selected === s.id ? "ring-2 ring-foreground" : ""}`} />
                ))}
              </div>
            </div>
          )}
        </main>

        <aside className="space-y-3 rounded-lg bg-card p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Marcações ({shapes.length})</p>
            {shapes.length > 0 && <button onClick={() => setShapes((s) => s.slice(0, -1))} className="text-xs text-primary">Desfazer</button>}
          </div>
          <ul className="max-h-72 space-y-1 overflow-auto">
            {shapes.map((s) => (
              <li key={s.id}>
                <button onClick={() => { setSelected(s.id); seek(s.start); }}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${selected === s.id ? "bg-accent" : "hover:bg-secondary"}`}>
                  <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
                  {TOOLS.find((t) => t.id === s.tool)?.label.split(" ")[0]} {s.text ? `“${s.text}”` : ""}
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{fmt(s.start)}</span>
                </button>
              </li>
            ))}
          </ul>
          {sel && (
            <div className="space-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
              <label className="block">Início: {fmt(sel.start)}
                <input type="range" min={0} max={length} step={0.05} value={sel.start} onChange={(e) => { upd({ start: +e.target.value }); seek(+e.target.value); }} className="w-full accent-primary" /></label>
              <label className="block">Duração: {sel.dur}s
                <input type="range" min={0.5} max={15} step={0.5} value={sel.dur} onChange={(e) => upd({ dur: +e.target.value })} className="w-full accent-primary" /></label>
              <button onClick={() => { setShapes((ss) => ss.filter((s) => s.id !== selected)); setSelected(null); }}
                className="w-full rounded-md bg-destructive py-1.5 font-semibold text-destructive-foreground">Apagar marcação</button>
            </div>
          )}
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">Dica: o vídeo pausa sozinho ao desenhar. Cada marcação aparece pelo tempo definido a partir do momento em que foi feita.</p>
        </aside>
      </div>
    </div>
  );
}
