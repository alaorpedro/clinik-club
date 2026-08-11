import { useMemo, useRef, useState } from "react";
import { Send, Paperclip, Smile, Mic } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { QUICK_REPLIES } from "@/lib/crm-inbox-mock";

function notAvailable() {
  toast.info("Disponível quando o canal real for conectado (Fase 3b).");
}

export function Composer({ onSend }: { onSend: (text: string) => void }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const quickMatches = useMemo(() => {
    if (!value.startsWith("/")) return [];
    const q = value.slice(1).toLowerCase();
    return QUICK_REPLIES.filter((r) => r.shortcut.slice(1).toLowerCase().startsWith(q));
  }, [value]);

  function send() {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue("");
  }

  function pickQuickReply(text: string) {
    setValue(text);
    textareaRef.current?.focus();
  }

  return (
    <div className="relative border-t border-border p-3">
      {quickMatches.length > 0 && (
        <div
          style={{ borderRadius: "var(--ck-r-sig-md)" }}
          className="absolute bottom-full left-3 right-3 mb-2 max-h-48 overflow-y-auto border border-border bg-popover shadow-md"
        >
          {quickMatches.map((r) => (
            <button
              key={r.shortcut}
              type="button"
              onClick={() => pickQuickReply(r.text)}
              className="block w-full cursor-pointer border-b border-border/60 px-3 py-2 text-left text-xs last:border-b-0 hover:bg-secondary/60"
            >
              <span className="font-semibold text-primary">{r.shortcut}</span>
              <p className="mt-0.5 truncate text-muted-foreground">{r.text}</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex items-center gap-0.5 pb-1.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={notAvailable} title="Anexo">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={notAvailable} title="Emoji">
            <Smile className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={notAvailable} title="Áudio">
            <Mic className="h-4 w-4" />
          </Button>
        </div>

        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
            if (e.key === "Escape") setValue("");
          }}
          placeholder="Escreva uma mensagem... use / para respostas rápidas"
          rows={1}
          className="ck-input min-h-9 flex-1 resize-none py-2"
        />

        <Button size="icon" className="ck-btn h-9 w-9 shrink-0" disabled={!value.trim()} onClick={send}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
