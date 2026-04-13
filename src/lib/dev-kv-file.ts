import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";

/**
 * Redis yokken dosyaya yazarız. Vercel'de proje klasörü salt okunur — yazma 500 verir.
 * OS geçici dizini (Windows/macOS/Linux) her ortamda yazılabilir.
 */
const DEV_KV_FILE = join(tmpdir(), "qr-vote-local-kv.json");

export type HashValue = string | number;

export type KvLike = {
  get: (key: string) => Promise<HashValue | null>;
  set: (key: string, value: HashValue, opts?: { ex?: number }) => Promise<void>;
  hlen: (key: string) => Promise<number>;
  hset: (key: string, obj: Record<string, HashValue>) => Promise<void>;
  hgetall: (key: string) => Promise<Record<string, HashValue> | null>;
  hincrby: (key: string, field: string, inc: number) => Promise<number>;
};

type FileShape = {
  kv: Record<string, { value: HashValue; expiresAt?: number }>;
  hashes: Record<string, Record<string, number>>;
  /** Listen: neueste Einträge zuerst (wie Redis LPUSH). */
  lists?: Record<string, string[]>;
};

let chain: Promise<void> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const p = chain.then(fn);
  chain = p.then(() => undefined).catch(() => undefined);
  return p;
}

function readSync(): FileShape {
  if (!existsSync(DEV_KV_FILE)) return { kv: {}, hashes: {}, lists: {} };
  try {
    const raw = JSON.parse(readFileSync(DEV_KV_FILE, "utf8")) as FileShape;
    return {
      kv: raw.kv ?? {},
      hashes: raw.hashes ?? {},
      lists: raw.lists ?? {},
    };
  } catch {
    return { kv: {}, hashes: {}, lists: {} };
  }
}

function writeSync(s: FileShape) {
  mkdirSync(dirname(DEV_KV_FILE), { recursive: true });
  writeFileSync(DEV_KV_FILE, JSON.stringify(s), "utf8");
}

function now() {
  return Date.now();
}

let singleton: KvLike | null = null;

export function getDevFileKvStore(): KvLike {
  if (singleton) return singleton;

  singleton = {
    async get(key) {
      return enqueue(async () => {
        const s = readSync();
        const item = s.kv[key];
        if (!item) return null;
        if (item.expiresAt !== undefined && item.expiresAt <= now()) {
          delete s.kv[key];
          writeSync(s);
          return null;
        }
        return item.value;
      });
    },
    async set(key, value, opts) {
      return enqueue(async () => {
        const s = readSync();
        const ex = opts?.ex;
        s.kv[key] = {
          value,
          expiresAt: ex !== undefined ? now() + ex * 1000 : undefined,
        };
        writeSync(s);
      });
    },
    async hlen(key) {
      return enqueue(async () => {
        const s = readSync();
        const h = s.hashes[key];
        return h ? Object.keys(h).length : 0;
      });
    },
    async hset(key, obj) {
      return enqueue(async () => {
        const s = readSync();
        const next = { ...(s.hashes[key] ?? {}) };
        for (const [k, v] of Object.entries(obj)) {
          next[k] = Number(v);
        }
        s.hashes[key] = next;
        writeSync(s);
      });
    },
    async hgetall(key) {
      return enqueue(async () => {
        const s = readSync();
        const h = s.hashes[key];
        if (!h || Object.keys(h).length === 0) return null;
        return { ...h } as Record<string, HashValue>;
      });
    },
    async hincrby(key, field, inc) {
      return enqueue(async () => {
        const s = readSync();
        const h = { ...(s.hashes[key] ?? {}) };
        const next = (h[field] ?? 0) + inc;
        h[field] = next;
        s.hashes[key] = h;
        writeSync(s);
        return next;
      });
    },
  };

  return singleton;
}

const EVENTS_MAX_DEFAULT = 10_000;

/** Nur für lokale Entwicklung ohne Redis. */
export async function devListLpush(key: string, value: string, maxLen = EVENTS_MAX_DEFAULT): Promise<void> {
  return enqueue(async () => {
    const s = readSync();
    if (!s.lists) s.lists = {};
    const arr = s.lists[key] ?? [];
    s.lists[key] = [value, ...arr].slice(0, maxLen);
    writeSync(s);
  });
}

/** start/end inklusiv; end = -1 bis Listenende. */
export async function devListLrange(key: string, start: number, end: number): Promise<string[]> {
  return enqueue(async () => {
    const s = readSync();
    const arr = s.lists?.[key] ?? [];
    if (end < 0) return arr.slice(start);
    return arr.slice(start, end + 1);
  });
}
