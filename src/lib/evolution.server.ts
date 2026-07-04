// Evolution API client (WhatsApp gateway) — server-only, credentials never reach the client bundle.
// Endpoint shapes follow Evolution API v2; verify against the live instance (wa.onmid.app) after deploy,
// since exact payloads can drift between Evolution/Baileys versions.

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

function getBaseUrl(): string {
  return getEnv("EVOLUTION_API_URL").replace(/\/+$/, "");
}

function getApiKey(): string {
  return getEnv("EVOLUTION_API_KEY");
}

function getInstance(instance?: string): string {
  return instance || process.env.EVOLUTION_INSTANCE || "disparo-alaorpedro-mqtsbvi0";
}

async function evolutionFetch(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: getApiKey(),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON response, keep null */
  }
  if (!res.ok) {
    throw new Error(`Evolution API ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return json;
}

export function toParticipantNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}

export async function createGroup(opts: {
  subject: string;
  participants: string[];
  instance?: string;
}): Promise<{ groupJid: string }> {
  const instance = getInstance(opts.instance);
  const json = await evolutionFetch(`/group/create/${instance}`, {
    method: "POST",
    body: JSON.stringify({
      subject: opts.subject,
      participants: opts.participants.map(toParticipantNumber),
    }),
  });
  const groupJid: string | undefined = json?.id ?? json?.groupJid ?? json?.data?.id;
  if (!groupJid) throw new Error("Evolution API did not return a group id");
  return { groupJid };
}

export async function addParticipants(opts: {
  groupJid: string;
  participants: string[];
  instance?: string;
}): Promise<void> {
  const instance = getInstance(opts.instance);
  await evolutionFetch(`/group/updateParticipant/${instance}?groupJid=${encodeURIComponent(opts.groupJid)}`, {
    method: "POST",
    body: JSON.stringify({
      action: "add",
      participants: opts.participants.map(toParticipantNumber),
    }),
  });
}

export async function setAnnounceOnly(opts: {
  groupJid: string;
  announce: boolean;
  instance?: string;
}): Promise<void> {
  const instance = getInstance(opts.instance);
  await evolutionFetch(`/group/updateSetting/${instance}?groupJid=${encodeURIComponent(opts.groupJid)}`, {
    method: "POST",
    body: JSON.stringify({ action: opts.announce ? "announcement" : "not_announcement" }),
  });
}

export async function getInviteLink(opts: { groupJid: string; instance?: string }): Promise<string> {
  const instance = getInstance(opts.instance);
  const json = await evolutionFetch(`/group/inviteCode/${instance}?groupJid=${encodeURIComponent(opts.groupJid)}`, {
    method: "GET",
  });
  const code: string | undefined = json?.inviteCode ?? json?.code;
  if (!code) throw new Error("Evolution API did not return an invite code");
  return `https://chat.whatsapp.com/${code}`;
}

export async function sendGroupMessage(opts: {
  groupJid: string;
  text: string;
  instance?: string;
}): Promise<void> {
  const instance = getInstance(opts.instance);
  await evolutionFetch(`/message/sendText/${instance}`, {
    method: "POST",
    body: JSON.stringify({ number: opts.groupJid, text: opts.text }),
  });
}
