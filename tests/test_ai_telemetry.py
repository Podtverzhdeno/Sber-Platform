"""Langfuse remains optional and receives no prompt/response content by default."""

from collections.abc import Mapping

from impulse.ai.telemetry import LangfuseAdapter


class RecordingClient:
    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.metadata: Mapping[str, str | int | float] = {}

    def create_event(self, *, name: str, metadata: Mapping[str, str | int | float]) -> object:
        if self.fail:
            raise RuntimeError("unavailable")
        assert name == "impulse.ai.run"
        self.metadata = metadata
        return object()


def test_metadata_only_trace_excludes_content_and_credentials() -> None:
    client = RecordingClient()
    assert LangfuseAdapter(client).record_run(
        run_id="run-1",
        purpose="buddy",
        model_id="openrouter/free",
        policy_version="v1",
        latency_ms=12,
        input_tokens=3,
        output_tokens=4,
    )
    assert "content" not in client.metadata
    assert "key" not in client.metadata


def test_unavailable_langfuse_does_not_break_run() -> None:
    client = RecordingClient(fail=True)
    assert not LangfuseAdapter(client).record_run(
        run_id="run-1",
        purpose="buddy",
        model_id="openrouter/free",
        policy_version="v1",
        latency_ms=12,
        input_tokens=3,
        output_tokens=4,
    )
