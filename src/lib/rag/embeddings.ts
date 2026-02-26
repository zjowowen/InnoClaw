import { embed, embedMany } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

// Create a dedicated OpenAI-compatible provider for embeddings.
// This allows using a separate API key / base URL / model for embeddings
// (e.g. a Gemini embedding model behind an OpenAI-compatible proxy).
const embeddingProvider = createOpenAI({
  apiKey: process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.EMBEDDING_BASE_URL || process.env.OPENAI_BASE_URL,
});

const embeddingModelId = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const embeddingModel = embeddingProvider.embedding(embeddingModelId);

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
  });
  return embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) return [];

  // Process in batches of 100 (OpenAI limit)
  const batchSize = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: batch,
    });
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}
