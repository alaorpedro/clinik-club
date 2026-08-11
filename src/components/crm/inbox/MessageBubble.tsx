import { Check, CheckCheck, Clock, ImageIcon } from "lucide-react";
import type { Message } from "@/lib/crm-inbox-mock";
import { AudioBubblePlayer } from "./AudioBubblePlayer";

// Bolha uniforme, sem cantos assimétricos — docs/brand/design-system.md §3: numa
// conversa longa, canto diferenciado por direção vira ruído direcional em cada linha.
function StatusIcon({ status }: { status: Message["status"] }) {
  if (status === "pending") return <Clock className="h-3 w-3 opacity-60" />;
  if (status === "sent") return <Check className="h-3 w-3 opacity-60" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 opacity-60" />;
  if (status === "read") return <CheckCheck className="h-3 w-3 text-sky-300" />;
  return null;
}

export function MessageBubble({ message }: { message: Message }) {
  const out = message.direction === "out";
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        style={{ borderRadius: "var(--ck-r-flat-sm)" }}
        className={`max-w-[75%] px-3 py-2 text-sm ${
          out
            ? "bg-primary text-primary-foreground"
            : "bg-background border border-border text-foreground"
        } ${message.status === "pending" ? "opacity-60" : ""}`}
      >
        {message.type === "text" && <p className="whitespace-pre-wrap break-words">{message.body}</p>}

        {message.type === "audio" && <AudioBubblePlayer durationSec={message.durationSec ?? 10} />}

        {message.type === "image" && (
          <div>
            <div
              style={{ borderRadius: "var(--ck-r-flat-sm)" }}
              className="flex h-32 w-48 items-center justify-center bg-foreground/10"
            >
              <ImageIcon className="h-6 w-6 opacity-50" />
            </div>
            {message.imageCaption && <p className="mt-1.5 break-words">{message.imageCaption}</p>}
          </div>
        )}

        <div className={`mt-1 flex items-center gap-1 ${out ? "justify-end" : "justify-start"}`}>
          <span className="ck-num text-[10px] opacity-70">{message.time}</span>
          {out && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}
