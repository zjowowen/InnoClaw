import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

export interface PaperContentPart {
  type: "text" | "image";
  pageNumber: number;
  /** Present when type === "text" */
  text?: string;
  /** Base64-encoded image data, present when type === "image" */
  data?: string;
  /** MIME type, present when type === "image" */
  mimeType?: string;
}

interface ExtractOptions {
  /** Maximum number of pages to process (default: 20) */
  maxPages?: number;
  /** Scale factor for rendering (default: 1.5 ≈ 150 DPI) */
  imageScale?: number;
  /** JPEG quality 0-1 (default: 0.75) */
  imageQuality?: number;
}

/* ---------- lazy canvas import ---------- */

let canvasModule: typeof import("canvas") | null = null;
let canvasLoadAttempted = false;

async function getCanvasModule(): Promise<typeof import("canvas") | null> {
  if (canvasLoadAttempted) return canvasModule;
  canvasLoadAttempted = true;
  try {
    canvasModule = await import("canvas");
  } catch {
    canvasModule = null;
  }
  return canvasModule;
}

/** Returns true if the native `canvas` package is available. */
export async function isCanvasAvailable(): Promise<boolean> {
  return (await getCanvasModule()) !== null;
}

/* ---------- CustomCanvasFactory ---------- */

/**
 * Custom CanvasFactory for pdfjs-dist in Node.js.
 *
 * pdfjs-dist v5 expects a CanvasFactory **class** (capital C) passed to
 * `getDocument({ CanvasFactory: ... })`. Its built-in NodeCanvasFactory uses
 * `@napi-rs/canvas`, but we use the `canvas` npm package instead.
 *
 * The class must have a constructor accepting `{ enableHWA? }` and implement
 * `_createCanvas(width, height)` (called by BaseCanvasFactory.create).
 * We replicate the BaseCanvasFactory interface inline to avoid importing
 * pdfjs internals.
 */
function buildCanvasFactory(mod: typeof import("canvas")) {
  const { createCanvas } = mod;

  return class CustomCanvasFactory {
    constructor(_opts?: { enableHWA?: boolean; ownerDocument?: unknown }) {
      // opts ignored — node-canvas doesn't use HWA or ownerDocument
    }

    create(width: number, height: number) {
      if (width <= 0 || height <= 0) throw new Error("Invalid canvas size");
      const canvas = createCanvas(width, height);
      return { canvas, context: canvas.getContext("2d") };
    }

    reset(
      canvasAndContext: { canvas: ReturnType<typeof createCanvas>; context: ReturnType<ReturnType<typeof createCanvas>["getContext"]> },
      width: number,
      height: number,
    ) {
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    }

    destroy(canvasAndContext: { canvas: ReturnType<typeof createCanvas> | null; context: unknown | null }) {
      if (canvasAndContext.canvas) {
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
      }
      canvasAndContext.canvas = null;
      canvasAndContext.context = null;
    }

    _createCanvas(width: number, height: number) {
      return createCanvas(width, height);
    }
  };
}

/**
 * Extract text + page images from a PDF buffer using pdfjs-dist.
 * Returns interleaved parts: [text(p1), image(p1), text(p2), image(p2), ...]
 *
 * Falls back to text-only extraction if the native `canvas` package is not installed.
 */
export async function extractPdfPagesWithImages(
  buffer: Buffer,
  opts: ExtractOptions = {},
): Promise<PaperContentPart[]> {
  const mod = await getCanvasModule();
  if (!mod) {
    console.warn(
      "[pdf-image-extractor] Native `canvas` package not available — falling back to text-only extraction. " +
      "Install system dependencies (Cairo, Pango, etc.) and run `npm install canvas` for image support.",
    );
    return extractPdfPagesTextOnly(buffer, opts.maxPages);
  }

  const { createCanvas } = mod;
  type CanvasType = import("canvas").Canvas;
  const { maxPages = 20, imageScale = 1.5, imageQuality = 0.75 } = opts;
  const CanvasFactory = buildCanvasFactory(mod);

  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    CanvasFactory,
  } as Parameters<typeof pdfjsLib.getDocument>[0]).promise;

  const pageCount = Math.min(doc.numPages, maxPages);
  const parts: PaperContentPart[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);

    // --- Extract text ---
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .filter((item): item is TextItem => "str" in item)
      .map((item) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText.length > 0) {
      parts.push({ type: "text", pageNumber: i, text: `[Page ${i}]\n${pageText}` });
    }

    // --- Render page to image ---
    const viewport = page.getViewport({ scale: imageScale });
    const renderCanvas = createCanvas(
      Math.round(viewport.width),
      Math.round(viewport.height),
    );
    const renderCtx = renderCanvas.getContext("2d");

    await page.render({
      canvasContext: renderCtx as unknown as CanvasRenderingContext2D,
      canvas: renderCanvas as unknown as HTMLCanvasElement,
      viewport,
    } as Parameters<typeof page.render>[0]).promise;

    // Convert to JPEG base64
    const jpegBuffer = (renderCanvas as unknown as CanvasType).toBuffer("image/jpeg", {
      quality: imageQuality,
    });
    const base64 = jpegBuffer.toString("base64");

    parts.push({
      type: "image",
      pageNumber: i,
      data: base64,
      mimeType: "image/jpeg",
    });

    page.cleanup();
  }

  await doc.cleanup();
  return parts;
}

/**
 * Extract text-only content from PDF pages (no images).
 * Useful as a fallback for non-vision providers.
 */
export async function extractPdfPagesTextOnly(
  buffer: Buffer,
  maxPages: number = 30,
): Promise<PaperContentPart[]> {
  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;

  const pageCount = Math.min(doc.numPages, maxPages);
  const parts: PaperContentPart[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .filter((item): item is TextItem => "str" in item)
      .map((item) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText.length > 0) {
      parts.push({ type: "text", pageNumber: i, text: `[Page ${i}]\n${pageText}` });
    }
    page.cleanup();
  }

  await doc.cleanup();
  return parts;
}
