import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tagColorClass } from "@/lib/crm-tag-color";
import { CURRENT_USER_ID, type Conversation } from "@/lib/crm-inbox-mock";

export type InboxTab = "novos" | "meus" | "outros";

function tabOf(c: Conversation): InboxTab {
  if (c.assigneeId === null) return "novos";
  if (c.assigneeId === CURRENT_USER_ID) return "meus";
  return "outros";
}

function previewOf(c: Conversation): string {
  const last = c.messages[c.messages.length - 1];
  if (!last) return "Sem mensagens ainda";
  if (last.type === "audio") return "🎤 Mensagem de áudio";
  if (last.type === "image") return "📷 Imagem" + (last.imageCaption ? ` · ${last.imageCaption}` : "");
  return last.body ?? "";
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  activeTab,
  onTabChange,
  search,
  onSearchChange,
}: {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  activeTab: InboxTab;
  onTabChange: (t: InboxTab) => void;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const counts = { novos: 0, meus: 0, outros: 0 };
  conversations.forEach((c) => counts[tabOf(c)]++);

  const q = search.trim().toLowerCase();
  const filtered = conversations
    .filter((c) => tabOf(c) === activeTab)
    .filter((c) => {
      if (!q) return true;
      return `${c.contactName} ${c.phone}`.toLowerCase().includes(q);
    });

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-r border-border">
      <div className="p-3 space-y-3 border-b border-border">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar conversa..."
            className="ck-input h-9 pl-8"
          />
        </div>
        <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as InboxTab)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="novos">Novos {counts.novos > 0 && `(${counts.novos})`}</TabsTrigger>
            <TabsTrigger value="meus">Meus {counts.meus > 0 && `(${counts.meus})`}</TabsTrigger>
            <TabsTrigger value="outros">Outros {counts.outros > 0 && `(${counts.outros})`}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-xs text-muted-foreground">
            Nenhuma conversa aqui.
          </div>
        )}
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className={`w-full border-b border-border/60 px-3 py-3 text-left transition-colors cursor-pointer hover:bg-secondary/60 ${
              selectedId === c.id ? "bg-secondary" : ""
            }`}
          >
            <div className="flex items-start gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                {c.contactName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{c.contactName}</span>
                  <span className="ck-num shrink-0 text-[10px] text-muted-foreground">
                    {c.messages[c.messages.length - 1]?.time ?? ""}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-muted-foreground">{previewOf(c)}</p>
                  {c.unread > 0 && (
                    <span className="ck-num flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {c.unread}
                    </span>
                  )}
                </div>
                {c.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <span
                        key={t}
                        style={{ borderRadius: "var(--ck-r-flat-sm)" }}
                        className={`px-1.5 py-0.5 text-[10px] font-medium ${tagColorClass(t)}`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export { tabOf };
