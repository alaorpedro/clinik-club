import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { importContacts } from "@/lib/crm.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

type Stage = { id: string; name: string };

const FIELD_OPTIONS = [
  { value: "ignore", label: "Ignorar coluna" },
  { value: "name", label: "Nome" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Telefone" },
] as const;
type FieldKey = (typeof FIELD_OPTIONS)[number]["value"];

// Parser simples de CSV: aspas, campos com vírgula/quebra de linha dentro de
// aspas, escape de aspas duplicadas (""). Cobre exportação padrão de
// Excel/Sheets — não cobre XLSX (fica pra uma próxima versão).
function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    if (row.some((f) => f.trim() !== "")) rows.push(row);
  }
  return rows;
}

function detectDelimiter(firstLine: string): string {
  return (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
}

function guessField(header: string): FieldKey {
  const h = header.toLowerCase();
  if (/e-?mail/.test(h)) return "email";
  if (/tel|celular|whats|phone/.test(h)) return "phone";
  if (/nome|name/.test(h)) return "name";
  return "ignore";
}

export function ImportContactsDialog({
  open,
  onOpenChange,
  pipelineId,
  stages,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string | undefined;
  stages: Stage[];
}) {
  const qc = useQueryClient();
  const importFn = useServerFn(importContacts);

  const [step, setStep] = useState<"upload" | "map" | "done">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<FieldKey[]>([]);
  const [stageId, setStageId] = useState<string>("");
  const [fileName, setFileName] = useState("");

  function reset() {
    setStep("upload");
    setHeaders([]);
    setDataRows([]);
    setMapping([]);
    setStageId("");
    setFileName("");
  }

  function handleClose(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleFile(file: File) {
    const text = await file.text();
    const delimiter = detectDelimiter(text.split("\n")[0] ?? "");
    const parsed = parseCsv(text, delimiter);
    if (parsed.length < 2) {
      toast.error("O arquivo precisa ter um cabeçalho e pelo menos uma linha de dados.");
      return;
    }
    const [head, ...rest] = parsed;
    setHeaders(head);
    setDataRows(rest);
    setMapping(head.map(guessField));
    setFileName(file.name);
    setStageId(stages[0]?.id ?? "");
    setStep("map");
  }

  const validRowCount = dataRows.filter((row) =>
    mapping.some((field, i) => field !== "ignore" && row[i]?.trim()),
  ).length;

  const importMut = useMutation({
    mutationFn: () => {
      const rows = dataRows.map((row) => {
        const r: { name?: string; email?: string; phone?: string } = {};
        mapping.forEach((field, i) => {
          if (field !== "ignore" && row[i]?.trim()) r[field] = row[i].trim();
        });
        return r;
      });
      return importFn({ data: { pipelineId: pipelineId!, stageId, rows } });
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["crm", "board"] });
      setStep("done");
      toast.success(`${result.imported} contatos importados.`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível importar."),
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar contatos</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sobe um arquivo CSV (exportado do Excel, Google Sheets ou outro CRM) com uma linha de
              cabeçalho e uma coluna por dado — nome, email, telefone.
            </p>
            <label className="ck-r-sig flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border p-10 text-center cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Clique para escolher o arquivo .csv</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{fileName}</strong> — {dataRows.length} linhas,{" "}
              {validRowCount} com dado utilizável.
            </p>

            <div>
              <p className="ck-eyebrow mb-2">Etapa de destino</p>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger className="ck-input h-9 w-56">
                  <SelectValue placeholder="Escolha a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="ck-eyebrow mb-2">Colunas do arquivo</p>
              <div className="ck-r-sig border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40">
                      {headers.map((h, i) => (
                        <th key={i} className="p-2 text-left font-medium min-w-[140px]">
                          <div className="mb-1 truncate" title={h}>
                            {h}
                          </div>
                          <Select
                            value={mapping[i]}
                            onValueChange={(v) =>
                              setMapping((m) =>
                                m.map((f, idx) => (idx === i ? (v as FieldKey) : f)),
                              )
                            }
                          >
                            <SelectTrigger className="ck-input h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        {headers.map((_, j) => (
                          <td key={j} className="p-2 text-muted-foreground truncate max-w-[160px]">
                            {row[j]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Mostrando as primeiras 5 de {dataRows.length} linhas.
              </p>
            </div>

            {!mapping.includes("name") &&
              !mapping.includes("email") &&
              !mapping.includes("phone") && (
                <p className="text-xs text-destructive">
                  Mapeie ao menos uma coluna (nome, email ou telefone) para continuar.
                </p>
              )}

            <DialogFooter>
              <Button variant="outline" className="ck-btn" onClick={reset}>
                Voltar
              </Button>
              <Button
                className="ck-btn"
                disabled={
                  !stageId ||
                  !validRowCount ||
                  !mapping.some((f) => f !== "ignore") ||
                  importMut.isPending
                }
                onClick={() => importMut.mutate()}
              >
                {importMut.isPending ? "Importando..." : `Importar ${validRowCount} contatos`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-[var(--ck-success)]" />
            <p className="font-semibold">Importação concluída</p>
            <p className="text-sm text-muted-foreground">
              Os contatos já estão na etapa escolhida do pipeline.
            </p>
            <Button className="ck-btn mt-2" onClick={() => handleClose(false)}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
