"""Curated official documentation for all 49 AI career stages.

All links were checked on 2026-10-25 against the source publishers.
No progress, grade, certification or external content is inferred by visiting.
"""

from __future__ import annotations

import json

READING_LIBRARY: dict[str, list[str]] = json.loads(r"""{
  "c4": [
    "C4 Model — официальное руководство",
    "https://c4model.com/diagrams"
  ],
  "rag": [
    "Microsoft Learn — RAG и поисковые индексы",
    "https://learn.microsoft.com/azure/ai-studio/concepts/retrieval-augmented-generation"
  ],
  "otel": [
    "OpenTelemetry — руководство по трассировке и метрикам",
    "https://opentelemetry.io/docs/concepts/"
  ],
  "owasp": [
    "OWASP — угрозы безопасности LLM-приложений",
    "https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/"
  ],
  "nist": [
    "NIST — AI Risk Management Framework",
    "https://www.nist.gov/itl/ai-risk-management-framework"
  ],
  "python": [
    "Python — официальный учебник",
    "https://docs.python.org/3/tutorial/"
  ],
  "pydantic": [
    "Pydantic — модели и проверка данных",
    "https://docs.pydantic.dev/latest/concepts/models/"
  ],
  "fastapi": [
    "FastAPI — пошаговое руководство по API",
    "https://fastapi.tiangolo.com/tutorial/"
  ],
  "langgraph": [
    "LangGraph — документация по агентным графам",
    "https://docs.langchain.com/oss/python/langgraph/overview"
  ],
  "eval": [
    "OpenAI Developers — evals и контроль качества",
    "https://developers.openai.com/learn/evals"
  ],
  "docker": [
    "Docker — запуск приложений в контейнерах",
    "https://docs.docker.com/get-started/"
  ],
  "k8s": [
    "Kubernetes — deployments и обновления сервисов",
    "https://kubernetes.io/docs/concepts/workloads/controllers/deployment/"
  ],
  "mlops": [
    "Google Cloud — MLOps: CI/CD и автоматизация",
    "https://cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning"
  ],
  "postgres": [
    "PostgreSQL — EXPLAIN и оптимизация запросов",
    "https://www.postgresql.org/docs/current/using-explain.html"
  ],
  "actions": [
    "GitHub Actions — официальное руководство по CI/CD",
    "https://docs.github.com/en/actions"
  ]
}""")
STAGE_READINGS: dict[str, list[list[str]]] = json.loads(r"""{
  "product": [
    [
      "c4",
      "nist"
    ],
    [
      "c4",
      "nist"
    ],
    [
      "rag",
      "owasp"
    ],
    [
      "langgraph",
      "otel"
    ],
    [
      "owasp",
      "nist"
    ],
    [
      "eval",
      "otel"
    ],
    [
      "c4",
      "nist"
    ]
  ],
  "ml": [
    [
      "python",
      "pydantic"
    ],
    [
      "pydantic",
      "eval"
    ],
    [
      "rag",
      "eval"
    ],
    [
      "langgraph",
      "fastapi"
    ],
    [
      "eval",
      "otel"
    ],
    [
      "fastapi",
      "docker"
    ],
    [
      "actions",
      "docker"
    ]
  ],
  "python": [
    [
      "owasp",
      "nist"
    ],
    [
      "nist",
      "owasp"
    ],
    [
      "owasp",
      "eval"
    ],
    [
      "owasp",
      "rag"
    ],
    [
      "owasp",
      "nist"
    ],
    [
      "eval",
      "owasp"
    ],
    [
      "otel",
      "nist"
    ]
  ],
  "data": [
    [
      "python",
      "pydantic"
    ],
    [
      "postgres",
      "pydantic"
    ],
    [
      "postgres",
      "actions"
    ],
    [
      "rag",
      "owasp"
    ],
    [
      "otel",
      "postgres"
    ],
    [
      "nist",
      "owasp"
    ],
    [
      "postgres",
      "otel"
    ]
  ],
  "backend": [
    [
      "mlops",
      "nist"
    ],
    [
      "docker",
      "fastapi"
    ],
    [
      "actions",
      "mlops"
    ],
    [
      "mlops",
      "actions"
    ],
    [
      "otel",
      "mlops"
    ],
    [
      "k8s",
      "docker"
    ],
    [
      "k8s",
      "actions"
    ]
  ],
  "design": [
    [
      "langgraph",
      "nist"
    ],
    [
      "langgraph",
      "pydantic"
    ],
    [
      "langgraph",
      "otel"
    ],
    [
      "langgraph",
      "owasp"
    ],
    [
      "langgraph",
      "nist"
    ],
    [
      "eval",
      "otel"
    ],
    [
      "langgraph",
      "actions"
    ]
  ],
  "manager": [
    [
      "nist",
      "c4"
    ],
    [
      "mlops",
      "nist"
    ],
    [
      "rag",
      "nist"
    ],
    [
      "c4",
      "fastapi"
    ],
    [
      "eval",
      "langgraph"
    ],
    [
      "eval",
      "owasp"
    ],
    [
      "nist",
      "mlops"
    ]
  ]
}""")


def reading_for_stage(track_key: str, stage_position: int) -> list[dict[str, str]]:
    """Return two official resources aligned with the practical module."""
    codes = STAGE_READINGS[track_key][stage_position - 1]
    return [
        {"title": READING_LIBRARY[key][0], "url": READING_LIBRARY[key][1]}
        for key in codes
    ]
