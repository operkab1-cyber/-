// AI-поиск, embedding-канал (AI Architecture §4, System Architecture §9.2).
// [решено самостоятельно] Voyage AI как embedding-провайдер — см. TODO.md, Phase 0:
// Claude API эмбеддингов не отдаёт, Voyage — рекомендованный партнёр Anthropic.
// Деградация по Architecture §14 ("при недоступности LLM API — fallback вместо
// ошибки"): без VOYAGE_API_KEY функция возвращает null, вызывающий код (searchPlants)
// просто не подмешивает embedding-канал и остаётся на tsvector+pg_trgm (уже рабочий
// MVP-поиск, не заглушка).

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: text, model: "voyage-3" }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { data?: { embedding: number[] }[] };
    return data.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}
