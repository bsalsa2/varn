# Training our own Ask model

Goal: a small open model, fine-tuned (LoRA) on Kaggle's free GPU, that can replace `gemma-4-26b-a4b-it` behind the same Worker, password and checks. **The detector (drone/aircraft) is a separate project and is not touched here.**

## What is here (done)

| File | What it does |
|---|---|
| `data.js` | Builds conversations from the Worker's own prompt (`prepare`), tools (`TOOLS`) and answer checker (`verifyAnswer`). An example that would not pass the checker cannot be built. |
| `build-dataset.mjs` | `node training/build-dataset.mjs --n 4000` writes `training/out/train.jsonl` (about 20 MB, chat records with tool calls, for fine-tuning) and `training/out/eval.json` (120 held-out test cases). Both are git-ignored; rebuild any time. |
| `score.js`, `score.mjs` | Runs any model through the real pipeline and reports pass rate by kind, "raw fallback" rate, average model calls and Neurons per question. `--model oracle` must score 100% (it does; that is a test). |

Behaviours covered: briefings from live data, tool questions (counts, strongest, altitude, layers, sun), questions about the written facts, "I don't have that.", refusals, prompt-injection attempts, view-only commands and one-click zoom sequences, and "yes" after an offer.

The test set uses paraphrases, places and facts that never appear in training (about a fifth of facts are held out; two of every eight paraphrases).

## Honest limits

- The wording of training answers is template-based. It teaches format, tool choice, citing, refusing and the allowlist very well; it does not teach rich prose. A fine-tuned small model will sound plainer than Gemma 4.
- A model passes a test case only if the **Worker pipeline accepts its answer and it is the right behaviour**. The same checker protects the live assistant, so a weaker model fails safely (raw results), not wrongly.
- Nothing here has been trained yet.

## Next steps (need decisions)

1. Pick the base model. It must be one Workers AI can serve with a custom LoRA (the model pages show a `lora` setting). Candidates to confirm against current docs: Llama 3.1 8B / 3.2 3B (weights need a Hugging Face licence click), or an openly licensed alternative.
2. Kaggle notebook (separate from the detector notebooks): load the base model in 4-bit, train a LoRA on `train.jsonl` with the base model's chat template, save the adapter to Kaggle Models, then score on `eval.json` using `score.js` logic.
3. Upload the adapter to Cloudflare Workers AI and add a `lora` option to `src/model.js`, behind a setting, so the Worker can switch between models.
4. Compare on the test set. Replace the current model only if ours passes at least as many cases with fewer Neurons.

Open questions to verify before step 3: that adapters are allowed on the Workers Free plan, how the upload works today, and the Neuron price of the chosen base model.

## Our own model (LoRA on Kaggle, served by Workers AI)

**Scope:** the chat assistant only. The drone/aircraft detector is a separate project and nothing here touches it.

**Base model:** `mistralai/Mistral-7B-Instruct-v0.2` (Apache 2.0). It matches Cloudflare's `@cf/mistral/mistral-7b-instruct-v0.2-lora`, which accepts LoRA adapters. Rank 8 keeps the adapter small (limit on that model: rank 8, about 100 MB).

**Protocol:** a custom model has no native tool calling, so it speaks plain JSON: `{"type":"tool_call","name":...,"arguments":...}` or `{"type":"final","text":...,"sources":[...]}`. The Worker converts that (`runModel.textProtocol`) and still runs every check (citations, numbers, command allowlist).

### Steps
1. `node training/build-dataset.mjs --n 4000 --out training/out --gz` regenerates the data (the committed `training/data/*.gz` is what Kaggle downloads).
2. `node training/make-notebook.mjs` regenerates `training/kaggle/ask_lora.ipynb`.
3. Kaggle → Create → Notebook → File → Import → upload `ask_lora.ipynb`. Session options: Accelerator = GPU T4, Internet = on. Run All (about 1 to 2 hours; the free weekly GPU quota applies).
4. Download `varn-ask-adapter.zip` and `eval_report.json` from the Output tab.
5. Only switch if `pass_rate` is at least as good as the current Gemma setup.

### Not verified yet (do not assume)
- Whether LoRA adapters can be uploaded and used on the Workers **Free** plan. If it needs the Paid plan, stop: the rule is free only.
- The exact upload procedure for adapters (`wrangler ai finetune create`, or the dashboard).
- Neuron pricing for the Mistral base compared with Gemma (affects the 8,000 daily budget).
- Whether Hugging Face requires a login for the base weights (the notebook accepts an optional `HF_TOKEN` Kaggle secret).

### Switching on (after the above is confirmed)
Set Worker vars `ASK_LORA` (the finetune name) and optionally `ASK_BASE_MODEL`. With `ASK_LORA` unset the Worker keeps using Gemma.
