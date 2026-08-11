import { ArrowRightLeft, CheckCircle2, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MEMBERS, STAGES, type Conversation } from "@/lib/crm-inbox-mock";

export function ConversationHeader({
  conversation,
  onStageChange,
  onAssign,
  onToggleAi,
}: {
  conversation: Conversation;
  onStageChange: (stageId: string) => void;
  onAssign: (assigneeId: string) => void;
  onToggleAi: (active: boolean) => void;
}) {
  return (
    <div className="border-b border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
            {conversation.contactName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{conversation.contactName}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Wifi className="h-3 w-3 text-emerald-600" /> {conversation.channel} · {conversation.phone}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            IA ativa
            <Switch
              checked={conversation.aiActive}
              onCheckedChange={onToggleAi}
              aria-label="IA ativa"
            />
          </label>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ck-btn">
                <ArrowRightLeft className="h-3.5 w-3.5" /> Transferir
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {MEMBERS.map((m) => (
                <DropdownMenuItem key={m.userId} onClick={() => onAssign(m.userId)}>
                  {m.email}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            className="ck-btn"
            onClick={() => toast.success("Conversa marcada como concluída.")}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
          </Button>
        </div>
      </div>

      <div className="mt-2.5">
        <Select value={conversation.stageId} onValueChange={onStageChange}>
          <SelectTrigger className="ck-input h-8 w-48 text-xs">
            <SelectValue placeholder="Etapa do pipeline" />
          </SelectTrigger>
          <SelectContent>
            {STAGES.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
