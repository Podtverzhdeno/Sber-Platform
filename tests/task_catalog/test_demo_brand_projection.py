"""Exact original logo names must never leak into real or unverified tasks."""

from impulse.application.task_catalog_demo_brands import catalog_demo_company_name


def test_all_approved_source_svg_names_are_used_in_synthetic_catalog() -> None:
    expected = (
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
    for index, company in enumerate(expected, start=1):
        assert (
            catalog_demo_company_name(
                demo_mode=True,
                task_key=f"demo-task-{index}",
                customer_name="Роман Заказчик",
                customer_verification="demo",
            )
            == company
        )


def test_approved_brand_never_impersonates_non_demo_customer() -> None:
    base = {
        "demo_mode": True,
        "task_key": "demo-task-1",
        "customer_name": "Роман Заказчик",
        "customer_verification": "demo",
    }
    for override in (
        {"demo_mode": False},
        {"customer_verification": "verified"},
        {"customer_verification": "unverified"},
        {"customer_name": "Сбер"},
        {"customer_name": "Настоящая компания"},
        {"task_key": "customer-made-task-1"},
        {"task_key": "demo-task-0"},
        {"task_key": "demo-task-01"},
        {"task_key": "demo-task-12"},
        {"task_key": "demo-task-99999"},
        {"task_key": "demo-task-1/extra"},
        {"task_key": "../../demo-task-1"},
    ):
        case = base | override
        assert catalog_demo_company_name(
            demo_mode=bool(case["demo_mode"]),
            task_key=str(case["task_key"]),
            customer_name=str(case["customer_name"]),
            customer_verification=str(case["customer_verification"]),
        ) is None
