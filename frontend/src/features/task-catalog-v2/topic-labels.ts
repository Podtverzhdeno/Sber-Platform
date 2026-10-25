/** Human-readable labels for published competency/direction identifiers.
 * The API always receives the original keys; unknown values are preserved.
 * This is presentation only, not an inferred competency or qualification.
 */
const topicLabels: Readonly<Record<string, string>> = {
  ml: "ML / AI",
  python: "Python",
  llm: "LLM",
  nlp: "NLP",
  rag: "RAG",
  sql: "SQL",
  analytics: "Аналитика",
  product: "Продукт",
  data: "Данные",
  security: "Безопасность",
  "recommender-systems": "Рекомендательные системы",
  "computer-vision": "Computer Vision",
  "data-analysis": "Анализ данных",
  "product-analytics": "Продуктовая аналитика",
  "time-series": "Временные ряды",
  "agentic-coding": "Agentic Coding",
  "ai-agents": "AI-агенты",
};

export function displayCatalogTopic(key: string): string {
  return topicLabels[key.trim().toLowerCase()] ?? key;
}
