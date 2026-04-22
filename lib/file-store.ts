import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data");

export async function ensureDataDir(): Promise<string> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }

  return DATA_DIR;
}

export async function readJsonFile<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const dataDir = await ensureDataDir();
    const raw = await readFile(path.join(dataDir, fileName), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile<T>(fileName: string, data: T): Promise<void> {
  const dataDir = await ensureDataDir();
  await writeFile(path.join(dataDir, fileName), JSON.stringify(data, null, 2), "utf8");
}
