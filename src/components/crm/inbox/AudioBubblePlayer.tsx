import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

// Player falso — Fase 3a é só protótipo de UX, não existe áudio real ainda
// (crm-plano.md §3a). Avança sozinho enquanto "toca" e para no fim; sem <audio>.
const BAR_HEIGHTS = [6, 10, 14, 8, 16, 11, 7, 13, 9, 15, 6, 12, 10, 8, 14, 9, 6, 11, 13, 7];

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function AudioBubblePlayer({ durationSec }: { durationSec: number }) {
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) return;
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev + 0.25 >= durationSec) {
          setPlaying(false);
          return 0;
        }
        return prev + 0.25;
      });
    }, 250);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, durationSec]);

  const progress = elapsed / durationSec;

  return (
    <div className="flex items-center gap-2 min-w-[190px]">
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? "Pausar áudio" : "Tocar áudio"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/30 cursor-pointer"
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>
      <div className="flex items-end gap-[2px] h-4">
        {BAR_HEIGHTS.map((h, i) => {
          const active = i / BAR_HEIGHTS.length <= progress;
          return (
            <span
              key={i}
              style={{ height: `${h}px` }}
              className={`w-[2px] rounded-full ${active ? "bg-current opacity-90" : "bg-current opacity-30"}`}
            />
          );
        })}
      </div>
      <span className="ck-num shrink-0 text-[11px] opacity-70">
        {formatTime(playing || elapsed > 0 ? elapsed : durationSec)}
      </span>
    </div>
  );
}
