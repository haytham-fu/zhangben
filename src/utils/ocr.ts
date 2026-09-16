import { createWorker, type Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('chi_sim+eng', 1, {
        logger: () => undefined,
      });
      return worker;
    })();
  }
  return workerPromise;
}

export async function recognizeImage(file: File | Blob): Promise<string> {
  const worker = await getWorker();
  const result = await worker.recognize(file);
  return result.data.text || '';
}

export async function recognizeImages(
  files: File[],
  onProgress?: (info: { index: number; total: number; pct: number }) => void,
): Promise<{ fileName: string; text: string }[]> {
  const out: { fileName: string; text: string }[] = [];
  const total = files.length;
  for (let i = 0; i < files.length; i++) {
    onProgress?.({ index: i, total, pct: Math.round((i / Math.max(total, 1)) * 100) });
    const text = await recognizeImage(files[i]);
    out.push({ fileName: files[i].name, text });
    onProgress?.({
      index: i + 1,
      total,
      pct: Math.round(((i + 1) / Math.max(total, 1)) * 100),
    });
  }
  return out;
}

export async function terminateOcr() {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}
