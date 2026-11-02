# AI providers: where to get a key, and what it costs

You need **at least one** key. Put each key in `engine/.env` yourself, in a
text editor, after the `=` on its line. Never paste a key into a chat.

**Set a spending limit on each provider's website.** The engine also stops
at `MONTHLY_LIMIT_USD`, but only a limit set with the provider stops charges.

Prices are US dollars per **million tokens**, as published in October 2026;
check the provider's page, because they change. A token is roughly
three-quarters of a word. A full 20-lesson unit outline and sequence usually
uses well under 100,000 tokens, so on the cheap models below a unit costs a
few cents.

| Provider | Key line in `.env` | Get a key | Model in the chain | In / out per million | Notes |
|---|---|---|---|---|---|
| **NVIDIA** | `NVIDIA_API_KEY`, `NVIDIA_MODEL` | build.nvidia.com → sign in → *Get API Key* | the model you choose | free tier | Rate-limited developer tier. Copy a model name from the catalog into `NVIDIA_MODEL` |
| **Alibaba Qwen** | `DASHSCOPE_API_KEY` | Alibaba Cloud Model Studio (international) → *API keys* | `qwen3.7-flash` | $0.03 / $0.13 | Keys work in one region only. If yours isn't international, change `DASHSCOPE_BASE_URL` |
| **Anthropic (Claude)** | `ANTHROPIC_API_KEY` | console.anthropic.com → *API keys* | `claude-haiku-5-5`, then `claude-sonnet-5-5` | Haiku $0.10 / $0.50 · Sonnet $2 / $10 | Needs prepaid credit. A Claude subscription is separate from API credit |
| **DeepSeek** | `DEEPSEEK_API_KEY` | platform.deepseek.com → *API keys* | `deepseek-v4-flash` | $0.14 / $0.28 | Needs a small top-up |
| **Google Gemini** | `GEMINI_API_KEY` | aistudio.google.com → *Get API key* | `gemini-3-flash` | $0.50 / $3.00 | Has a free tier with lower limits |
| **OpenAI** | `OPENAI_API_KEY`, `OPENAI_MODEL` | platform.openai.com → *API keys* | the model you choose | set it in `model_chain.json` | Add the model's price to `config/model_chain.json` so costs are logged correctly |
| **OpenRouter** | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | openrouter.ai → *Keys* | the model you choose | set it in `model_chain.json` | One key, many models |

## Changing the order

The order is in `config/model_chain.json`, cheapest first. Move a line up or
down, or delete it. After you edit it, restart the engine:

```bash
docker compose -f engine/docker-compose.yml restart engine
```

## Checking which providers will run

```bash
docker compose -f engine/docker-compose.yml exec engine node chain.js
```

It lists every step, marks the ones that can run, and says why the others
can't (for example, "no key in .env"). It never prints a key.
