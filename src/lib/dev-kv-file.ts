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
};

let chain: Promise<void> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const p = chain.then(fn);
  chain = p.then(() => undefined).catch(() => undefined);
  return p;
}

function readSync(): FileShape {
  if (!existsSync(DEV_KV_FILE)) return { kv: {}, hashes: {} };
  try {
    return JSON.parse(readFileSync(DEV_KV_FILE, "utf8")) as FileShape;
  } catch {
    return { kv: {}, hashes: {} };
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
