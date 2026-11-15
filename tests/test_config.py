from src.config import Settings


def test_agent_max_iterations_default_matches_env_example():
    assert Settings(_env_file=None).agent_max_iterations == 8


def test_env_example_value_is_accepted(monkeypatch):
    monkeypatch.setenv("AGENT_MAX_ITERATIONS", "8")
    assert Settings(_env_file=None).agent_max_iterations == 8


def test_openrouter_provider_uses_openrouter_credentials(monkeypatch):
    from src.config import get_settings
    from src.services.llm import get_llm

    monkeypatch.setenv("LLM_PROVIDER", "openrouter")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-openrouter-key")
    monkeypatch.setenv("OPENROUTER_BASE_URL", "https://openrouter.example/v1")
    get_settings.cache_clear()

    llm = get_llm("generate")

    assert str(llm.root_client.base_url).rstrip("/") == "https://openrouter.example/v1"
    get_settings.cache_clear()
