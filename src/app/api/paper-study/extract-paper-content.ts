import path from "path";
import { validatePath, readFileBuffer } from "@/lib/files/filesystem";
import { extractText, isSupportedFile, normalizeText } from "@/lib/files/text-extractor";
import {
  extractPdfPagesWithImages,
  extractPdfPagesTextOnly,
  type PaperContentPart,
} from "@/lib/files/pdf-image-extractor";

// Re-export for convenience
export type { PaperContentPart } from "@/lib/files/pdf-image-extractor";

interface ArticleRef {
  url: string;
  source: string;
  pdfUrl?: string;
}

/**
 * Download a PDF from a remote URL and return the buffer.
 */
async function downloadPdf(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "open-notebook/1.0" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

/**
 * Resolve a PDF buffer from any article source.
 * - local: read from filesystem
 * - arxiv/huggingface/semantic-scholar: download via pdfUrl
 */
async function resolvePdfBuffer(article: ArticleRef): Promise<Buffer | null> {
  if (article.source === "local") {
    try {
      const filePath = validatePath(article.url);
      if (path.extname(filePath).toLowerCase() !== ".pdf") return null;
      return await readFileBuffer(filePath);
    } catch {
      return null;
    }
  }

  // Remote sources — use pdfUrl if available, or construct from arXiv ID
  let pdfUrl = article.pdfUrl;
  if (!pdfUrl && article.source === "arxiv") {
    // article.url is like https://arxiv.org/abs/2301.12345
    const match = article.url.match(/arxiv\.org\/(?:abs|pdf)\/([0-9]+\.[0-9]+(?:v\d+)?)/i);
    if (match) {
      pdfUrl = `https://arxiv.org/pdf/${match[1]}`;
    }
  }
  if (!pdfUrl) return null;

  return downloadPdf(pdfUrl);
}

/**
 * Extract structured paper content (text + page images) from any source.
 * Returns interleaved PaperContentPart[] for multimodal agent consumption.
 *
 * @param article - must have `url`, `source`, and optionally `pdfUrl`
 * @param withImages - whether to render page images (requires canvas; set false for text-only providers)
 * @param maxPages - maximum pages to process
 */
export async function extractPaperContent(
  article: ArticleRef,
  withImages: boolean = true,
  maxPages: number = 20,
): Promise<PaperContentPart[] | undefined> {
  try {
    const buffer = await resolvePdfBuffer(article);

    if (buffer) {
      // PDF path — extract with or without images
      const parts = withImages
        ? await extractPdfPagesWithImages(buffer, { maxPages })
        : await extractPdfPagesTextOnly(buffer, maxPages);
      return parts.length > 0 ? parts : undefined;
    }

    // Non-PDF local file — text only
    if (article.source === "local") {
      const filePath = validatePath(article.url);
      if (!isSupportedFile(filePath)) return undefined;
      const rawText = await extractText(filePath);
      if (!rawText || rawText.trim().length < 50) return undefined;
      const text = normalizeText(rawText);
      return [{ type: "text", pageNumber: 1, text }];
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract text-only paper content (backward compatible).
 * Kept for callers that don't need images.
 */
export async function extractPaperFullText(
  article: { url: string; source: string; pdfUrl?: string },
  maxChars: number = 30_000,
): Promise<string | undefined> {
  const parts = await extractPaperContent(article, false, 30);
  if (!parts) return undefined;

  const text = parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n\n");

  return text.length > 0 ? text.slice(0, maxChars) : undefined;
}
