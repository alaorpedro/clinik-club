import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PromptOptions = {
  title?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  okText?: string;
  cancelText?: string;
};

type ConfirmOptions = {
  title?: string;
  description?: string;
  okText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type PromptState = PromptOptions & { resolve: (v: string | null) => void };
type ConfirmState = ConfirmOptions & { resolve: (v: boolean) => void };

let promptSetter: ((s: PromptState | null) => void) | null = null;
let confirmSetter: ((s: ConfirmState | null) => void) | null = null;

export function showPrompt(opts: PromptOptions = {}): Promise<string | null> {
  return new Promise((resolve) => {
    if (!promptSetter) return resolve(null);
    promptSetter({ ...opts, resolve });
  });
}

export function showConfirm(opts: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!confirmSetter) return resolve(false);
    confirmSetter({ ...opts, resolve });
  });
}

export function ModalDialogsHost() {
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    promptSetter = setPrompt;
    confirmSetter = setConfirm;
    return () => {
      promptSetter = null;
      confirmSetter = null;
    };
  }, []);

  useEffect(() => {
    if (prompt) {
      setValue(prompt.defaultValue ?? "");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [prompt]);

  function closePrompt(v: string | null) {
    prompt?.resolve(v);
    setPrompt(null);
  }
  function closeConfirm(v: boolean) {
    confirm?.resolve(v);
    setConfirm(null);
  }

  return (
    <>
      <Dialog open={!!prompt} onOpenChange={(o) => !o && closePrompt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{prompt?.title ?? "clinik.club"}</DialogTitle>
            {prompt?.label && <DialogDescription>{prompt.label}</DialogDescription>}
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              closePrompt(value);
            }}
            className="space-y-3"
          >
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={prompt?.placeholder}
            />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => closePrompt(null)} className="rounded-full">
                {prompt?.cancelText ?? "Cancelar"}
              </Button>
              <Button type="submit" className="rounded-full">
                {prompt?.okText ?? "OK"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && closeConfirm(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm?.title ?? "Confirmar"}</DialogTitle>
            {confirm?.description && <DialogDescription>{confirm.description}</DialogDescription>}
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => closeConfirm(false)} className="rounded-full">
              {confirm?.cancelText ?? "Cancelar"}
            </Button>
            <Button
              variant={confirm?.destructive ? "destructive" : "default"}
              onClick={() => closeConfirm(true)}
              className="rounded-full"
            >
              {confirm?.okText ?? "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}