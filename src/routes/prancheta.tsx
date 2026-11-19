import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Pause, Play, RotateCcw, ArrowLeft, Clapperboard } from "lucide-react";
import type { Board } from "@/lib/court3d";
import { PLAY_PRESETS } from "@/lib/plays";

export const Route = createFileRoute("/prancheta")({
  head: () => ({
    meta: [
      { title: "Prancheta 3D — Court Vision Playbook" },
      {
        name: "description",
        content: "Jogadas de basquete animadas em quadra 3D, prontas para exportar em 9:16.",
      },
    ],
  }),
  component: Prancheta3D,
});

const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1920;

function readRenderSize() {
  if (typeof window === "undefined") return { width: EXPORT_WIDTH, height: EXPORT_HEIGHT };
  const params = new URLSearchParams(window.location.search);
  const width = Number(params.get("w"));
  const height = Number(params.get("h"));
  if (width >= 360 && height >= 640) return { width, height };
  return { width: EXPORT_WIDTH, height: EXPORT_HEIGHT };
}

function Prancheta3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<Board | null>(null);
  const [renderSize] = useState(readRenderSize);
  const [presetId, setPresetId] = useState(PLAY_PRESETS[0]?.id ?? "triangle");
  const preset = PLAY_PRESETS.find((item) => item.id === presetId) ?? PLAY_PRESETS[0]!;
  const [hook, setHook] = useState(preset.hook);
  const [subtitle, setSubtitle] = useState(preset.subtitle);
  const [cta, setCta] = useState("Comente a próxima tática");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const exportingRef = useRef(false);
  const duration = preset.play.duration;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let board: Board | null = null;
    let cancelled = false;
    void (async () => {
      const { createBoard } = await import("@/lib/court3d");
      if (cancelled) return;
      board = createBoard(canvas);
      boardRef.current = board;
      board.setSize(renderSize.width, renderSize.height);
      board.setPlay(preset.play);
      board.setTexts({
        hook: preset.hook,
        subtitle: preset.subtitle,
        cta: "Comente a próxima tática",
      });
      board.setTime(0);
      board.render();
    })();
    return () => {
      cancelled = true;
      boardRef.current = null;
      board?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // loop de prévia
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const board = boardRef.current;
      const delta = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (board && playingRef.current && !exportingRef.current) {
        const next = timeRef.current + delta;
        if (next >= duration) {
          timeRef.current = duration;
          playingRef.current = false;
          setPlaying(false);
        } else {
          timeRef.current = next;
        }
        board.setTime(timeRef.current);
        setTime(timeRef.current);
      }
      board?.render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [duration]);

  const applyPreset = (id: string) => {
    const next = PLAY_PRESETS.find((item) => item.id === id);
    if (!next) return;
    setPresetId(id);
    setHook(next.hook);
    setSubtitle(next.subtitle);
    timeRef.current = 0;
    setTime(0);
    playingRef.current = false;
    setPlaying(false);
    boardRef.current?.setPlay(next.play);
    boardRef.current?.setTexts({ hook: next.hook, subtitle: next.subtitle, cta });
    boardRef.current?.setTime(0);
  };

  const updateTexts = useCallback(
    (next: { hook?: string; subtitle?: string; cta?: string }) => {
      boardRef.current?.setTexts({
        hook: next.hook ?? hook,
        subtitle: next.subtitle ?? subtitle,
        cta: next.cta ?? cta,
      });
    },
    [hook, subtitle, cta],
  );

  const seek = (value: number) => {
    timeRef.current = value;
    setTime(value);
    boardRef.current?.setTime(value);
  };

  const toggle = () => {
    if (timeRef.current >= duration) seek(0);
    playingRef.current = !playingRef.current;
    setPlaying(playingRef.current);
  };

  const exportMp4 = async () => {
    const canvas = canvasRef.current;
    const board = boardRef.current;
    if (!canvas || !board || exportingRef.current) return;
    setError(null);
    const mime = [
      "video/mp4;codecs=avc1.42E01E",
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm",
    ].find((item) => MediaRecorder.isTypeSupported(item));
    if (!mime) {
      setError("Este navegador não permite exportar vídeo.");
      return;
    }
    playingRef.current = false;
    setPlaying(false);
    exportingRef.current = true;
    setExporting(0);
    // Sonda rápida: em aparelhos sem GPU a renderização 1080×1920 não sustenta 30 fps,
    // o que encurta o vídeo gravado. Nesses casos exportamos em 720×1280.
    const probeStart = performance.now();
    for (let i = 0; i < 6; i += 1) {
      board.setTime(i * 0.1);
      board.render();
    }
    const probeMs = (performance.now() - probeStart) / 6;
    const slow = probeMs > 26;
    if (slow) board.setSize(720, 1280);
    const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: slow ? 6_000_000 : 12_000_000,
    });
    const chunks: Blob[] = [];
    rec.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    const stopped = new Promise<void>((resolve) =>
      rec.addEventListener("stop", () => resolve(), { once: true }),
    );
    rec.start(200);
    const started = performance.now();
    const hold = 1;
    await new Promise<void>((resolve) => {
      const step = () => {
        const elapsed = (performance.now() - started) / 1000;
        const t = Math.min(duration, elapsed);
        board.setTime(t);
        board.render();
        setExporting(Math.min(1, t / duration));
        if (elapsed >= duration + hold) resolve();
        else requestAnimationFrame(step);
      };
      step();
    });
    rec.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    if (slow) board.setSize(renderSize.width, renderSize.height);
    const blob = new Blob(chunks, { type: mime });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `prancheta-${preset.id}.${mime.includes("mp4") ? "mp4" : "webm"}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    exportingRef.current = false;
    setExporting(null);
    seek(0);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" /> Editor de vídeo
          </Link>
          <h1 className="font-display text-xl tracking-wide sm:text-2xl">
            PRANCHETA<span className="text-primary">3D</span>
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void exportMp4()}
          disabled={exporting !== null}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exporting !== null ? `Gravando ${Math.round(exporting * 100)}%` : "Exportar MP4 9:16"}
        </button>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 p-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <section className="rounded-2xl border border-border bg-black p-3">
          <canvas
            ref={canvasRef}
            width={renderSize.width}
            height={renderSize.height}
            className="mx-auto block h-auto w-full max-w-[380px] rounded-xl"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playing ? "Pausar" : "Reproduzir"}
            </button>
            <button
              type="button"
              onClick={() => {
                playingRef.current = false;
                setPlaying(false);
                seek(0);
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary"
            >
              <RotateCcw className="h-4 w-4" /> Início
            </button>
            <span className="ml-auto font-mono text-sm text-muted-foreground">
              {time.toFixed(1)}s / {duration}s
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.05}
            value={time}
            onChange={(event) => seek(+event.target.value)}
            className="mt-3 w-full accent-primary"
            aria-label="Linha do tempo da jogada"
          />
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </section>

        <section className="space-y-5">
          <div>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              <Clapperboard className="h-4 w-4" /> Jogada
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {PLAY_PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => applyPreset(item.id)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors ${
                    item.id === presetId
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-semibold">
              Gancho (título)
              <input
                value={hook}
                maxLength={48}
                onChange={(event) => {
                  setHook(event.target.value);
                  updateTexts({ hook: event.target.value });
                }}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Contexto
              <input
                value={subtitle}
                maxLength={64}
                onChange={(event) => {
                  setSubtitle(event.target.value);
                  updateTexts({ subtitle: event.target.value });
                }}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Chamada final
              <input
                value={cta}
                maxLength={40}
                onChange={(event) => {
                  setCta(event.target.value);
                  updateTexts({ cta: event.target.value });
                }}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal"
              />
            </label>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Formato do método</p>
            <p className="mt-1">
              Gancho que contraria o senso comum, uma ideia por fala, leitura sem som e chamada para
              comentar. A gravação leva {duration}s, em 1080×1920, pronta para Reels e TikTok.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
