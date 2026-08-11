import { useState } from "react";
import { Send, Tag as TagIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { tagColorClass } from "@/lib/crm-tag-color";
import type { Conversation } from "@/lib/crm-inbox-mock";

export function SidePanel({
  conversation,
  onUpdateTags,
  onAddNote,
}: {
  conversation: Conversation;
  onUpdateTags: (tags: string[]) => void;
  onAddNote: (body: string) => void;
}) {
  const [tagInput, setTagInput] = useState("");
  const [noteBody, setNoteBody] = useState("");

  function addTag() {
    const t = tagInput.trim();
    if (!t || conversation.tags.includes(t)) {
      setTagInput("");
      return;
    }
    onUpdateTags([...conversation.tags, t]);
    setTagInput("");
  }

  return (
    <div className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-l border-border p-4">
      <div>
        <p className="ck-eyebrow mb-2 flex items-center gap-1.5">
          <TagIcon className="h-3.5 w-3.5" /> Etiquetas
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {conversation.tags.map((t) => (
            <span
              key={t}
              style={{ borderRadius: "var(--ck-r-flat-sm)" }}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium ${tagColorClass(t)}`}
            >
              {t}
              <button
                type="button"
                onClick={() => onUpdateTags(conversation.tags.filter((x) => x !== t))}
                className="opacity-60 hover:opacity-100 cursor-pointer"
                aria-label={`Remover etiqueta ${t}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Nova etiqueta..."
            className="ck-input h-8 w-28 text-xs"
          />
        </div>
      </div>

      <div className="mt-6">
        <p className="ck-eyebrow mb-2">Notas internas</p>
        <div className="space-y-2">
          <Textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Escreva uma nota sobre este atendimento..."
            rows={2}
            className="ck-input"
          />
          <Button
            size="sm"
            className="ck-btn"
            disabled={!noteBody.trim()}
            onClick={() => {
              onAddNote(noteBody.trim());
              setNoteBody("");
            }}
          >
            <Send className="h-3.5 w-3.5" /> Salvar nota
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {conversation.notes.map((n) => (
            <div key={n.id} className="ck-r-flat border border-border bg-secondary/40 p-3 text-sm">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{n.time}</p>
            </div>
          ))}
          {conversation.notes.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhuma nota ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}
