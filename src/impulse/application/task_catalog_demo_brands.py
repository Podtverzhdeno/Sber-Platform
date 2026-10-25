"""Approved source logos for explicitly synthetic catalog tasks only.

These brand-name examples are not assertions of real customer relationships.
The actual task owner ID, application permissions, and audit records are
unchanged. The frontend displays its "Демо-заказчик" disclosure beside them.
"""
from __future__ import annotations

_DEMO_REFERENCE_COMPANIES: tuple[str, ...] = (
    "Сбер",
    "Т-Банк",
    "Astra",
    "Яндекс",
    "red_mad_robot",
    "Газпром нефть",
    "VK",
    "Positive Technologies",
    "Тинькофф",
    "Сбер",
    "Astra",
)


def catalog_demo_company_name(
    *,
    demo_mode: bool,
    task_key: str,
    customer_name: str,
    customer_verification: str,
) -> str | None:
    """Allow only known numbered fixtures owned by the original demo persona."""
    if (
        not demo_mode
        or customer_verification != "demo"
        or customer_name != "Роман Заказчик"
    ):
        return None
    prefix = "demo-task-"
    if not task_key.startswith(prefix):
        return None
    suffix = task_key[len(prefix):]
    if not suffix.isdecimal() or suffix.startswith("0"):
        return None
    index = int(suffix)
    if not 1 <= index <= len(_DEMO_REFERENCE_COMPANIES):
        return None
    return _DEMO_REFERENCE_COMPANIES[index - 1]
