import { db } from "@/lib/db";
import { sourceChunks, sources } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateEmbedding } from "./embeddings";
import { searchSimilar } from "./vector-store";

export interface RetrievedChunk {
  chunkId: string;
  sourceId: string;
  fileName: string;
  relativePath: string;
  content: string;
  similarity: number;
}

/**
 * Retrieve the most relevant chunks for a query within a workspace.
 * When the query mentions a source filename, the first chunks of that file
 * are always included so meta-questions (title, summary) can be answered.
 */
export async function retrieveRelevantChunks(
  query: string,
  workspaceId: string,
  topK: number = 8
): Promise<RetrievedChunk[]> {
  // 1. Check if query mentions any source filename
  const fileNameChunks = await getChunksByMentionedFilename(query, workspaceId);

  // 2. Generate query embedding and search for similar chunks
  const queryEmbedding = await generateEmbedding(query);
  const results = await searchSimilar(queryEmbedding, workspaceId, topK);

  // 3. Fetch chunk content and source metadata for embedding results
  const embeddingChunks: RetrievedChunk[] = [];

  for (const result of results) {
    const chunk = await db
      .select({
        id: sourceChunks.id,
        content: sourceChunks.content,
        sourceId: sourceChunks.sourceId,
      })
      .from(sourceChunks)
      .where(eq(sourceChunks.id, result.chunkId))
      .limit(1);

    if (chunk.length === 0) continue;

    const source = await db
      .select({
        fileName: sources.fileName,
        relativePath: sources.relativePath,
      })
      .from(sources)
      .where(eq(sources.id, chunk[0].sourceId))
      .limit(1);

    if (source.length === 0) continue;

    embeddingChunks.push({
      chunkId: result.chunkId,
      sourceId: chunk[0].sourceId,
      fileName: source[0].fileName,
      relativePath: source[0].relativePath,
      content: chunk[0].content,
      similarity: result.similarity,
    });
  }

  // 4. Merge: filename-matched chunks first, then embedding results (deduplicated)
  if (fileNameChunks.length === 0) return embeddingChunks;

  const seen = new Set(fileNameChunks.map((c) => c.chunkId));
  const merged = [...fileNameChunks];
  for (const chunk of embeddingChunks) {
    if (!seen.has(chunk.chunkId)) {
      merged.push(chunk);
      seen.add(chunk.chunkId);
    }
  }
  return merged.slice(0, topK);
}

/**
 * When the query mentions a source filename, return the first few chunks
 * of that source so meta-questions (title, abstract, overview) can be answered.
 */
async function getChunksByMentionedFilename(
  query: string,
  workspaceId: string
): Promise<RetrievedChunk[]> {
  const workspaceSources = await db
    .select({ id: sources.id, fileName: sources.fileName, relativePath: sources.relativePath })
    .from(sources)
    .where(eq(sources.workspaceId, workspaceId));

  const lowerQuery = query.toLowerCase();
  const matchedSources = workspaceSources.filter((s) =>
    lowerQuery.includes(s.fileName.toLowerCase())
  );

  if (matchedSources.length === 0) return [];

  const results: RetrievedChunk[] = [];
  for (const src of matchedSources) {
    const chunks = await db
      .select({ id: sourceChunks.id, content: sourceChunks.content })
      .from(sourceChunks)
      .where(eq(sourceChunks.sourceId, src.id))
      .orderBy(sourceChunks.chunkIndex)
      .limit(3);

    for (const chunk of chunks) {
      results.push({
        chunkId: chunk.id,
        sourceId: src.id,
        fileName: src.fileName,
        relativePath: src.relativePath,
        content: chunk.content,
        similarity: 1.0,
      });
    }
  }

  return results;
}

/**
 * Fallback retrieval using keyword matching when embedding-based search is unavailable.
 * Splits query into keywords and searches chunk content using SQL LIKE.
 */
export async function retrieveByKeywordSearch(
  query: string,
  workspaceId: string,
  topK: number = 8
): Promise<RetrievedChunk[]> {
  // Extract meaningful keywords (filter out very short words)
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  if (keywords.length === 0) return [];

  // Get all chunks for this workspace
  const allChunks = await db
    .select({
      id: sourceChunks.id,
      content: sourceChunks.content,
      sourceId: sourceChunks.sourceId,
    })
    .from(sourceChunks)
    .where(eq(sourceChunks.workspaceId, workspaceId));

  if (allChunks.length === 0) return [];

  // Score chunks by number of keyword matches
  const scored = allChunks.map((chunk) => {
    const lowerContent = chunk.content.toLowerCase();
    const matchCount = keywords.filter((kw) => lowerContent.includes(kw)).length;
    return { ...chunk, matchCount };
  });

  // Filter to chunks with at least one match, sort by match count
  const matched = scored
    .filter((c) => c.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, topK);

  // If no keyword matches, return top chunks by position (first chunks of each source)
  const topChunks =
    matched.length > 0 ? matched : allChunks.slice(0, topK);

  // Enrich with source metadata
  const enrichedChunks: RetrievedChunk[] = [];

  for (const chunk of topChunks) {
    const source = await db
      .select({
        fileName: sources.fileName,
        relativePath: sources.relativePath,
      })
      .from(sources)
      .where(eq(sources.id, chunk.sourceId))
      .limit(1);

    if (source.length === 0) continue;

    enrichedChunks.push({
      chunkId: chunk.id,
      sourceId: chunk.sourceId,
      fileName: source[0].fileName,
      relativePath: source[0].relativePath,
      content: chunk.content,
      similarity: "matchCount" in chunk ? (chunk as { matchCount: number }).matchCount / keywords.length : 0,
    });
  }

  return enrichedChunks;
}
