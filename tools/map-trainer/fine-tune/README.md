# Fine-Tuning a Map Generator

Train a small language model to generate tile-based RPG map blueprints
using winning blueprints from the evolution pipeline.

## Prerequisites

- **Node.js 18+** (for data preparation)
- **Python 3.10+**
- **PyTorch with CUDA** (for RTX 3060 12GB)
- `transformers`, `datasets`, `peft` (for LoRA), `accelerate`, `bitsandbytes`

## Setup

```bash
pip install torch transformers datasets peft accelerate bitsandbytes
```

## Step 1: Prepare Training Data

Run the evolution pipeline first so that `tools/map-trainer/evolution-memory.json` exists,
then convert winning blueprints into training JSONL files:

```bash
node tools/map-trainer/fine-tune/prepare-training-data.js --format=both --min-score=60
```

Options:
- `--format=gpt2|llama|both` - Output format (default: `both`)
- `--min-score=60` - Minimum combinedScore to include (default: `60`)

This produces:
- `training-data-gpt2-train.jsonl` / `training-data-gpt2-val.jsonl`
- `training-data-llama-train.jsonl` / `training-data-llama-val.jsonl`

## Step 2a: Fine-tune DistilGPT2 (quick, ~10 min on RTX 3060)

```bash
python tools/map-trainer/fine-tune/train-gpt2.py
```

Output saved to `tools/map-trainer/fine-tune/model-gpt2/`.

DistilGPT2 is small (82M params) and trains fast. Good for prototyping
and validating that the training data produces sensible blueprints.

## Step 2b: Fine-tune Llama 3.2 3B with LoRA (~30 min on RTX 3060)

```bash
python tools/map-trainer/fine-tune/train-llama-lora.py
```

Output saved to `tools/map-trainer/fine-tune/model-llama-lora/`.

Uses 4-bit quantization + LoRA (rank 16) so the 3B model fits in 12GB VRAM.
Produces higher quality blueprints than DistilGPT2 but takes longer to train.

Requires access to `meta-llama/Llama-3.2-3B` on Hugging Face. You may need
to accept the license and run `huggingface-cli login` first.

## Step 3: Generate Maps from the Fine-tuned Model

```bash
node tools/map-trainer/fine-tune/generate-from-model.js
```

(Script to be created -- will load the fine-tuned model via a local inference
server and generate blueprints on demand.)

## Training Data Format

### GPT-2 (text completion)

Each JSONL line contains a `text` field with system/user/assistant tokens:

```json
{"text": "<|system|>You are a tile-based RPG map designer...<|user|>Generate a 60x40 map, zones: village, forest...<|assistant|>{\"mapSize\":{...},\"zones\":[...]}"}
```

### Llama/Mistral (instruction tuning)

Each JSONL line contains `instruction`, `input`, and `output` fields:

```json
{"instruction": "Generate a 60x40 map, zones: village, forest", "input": "", "output": "{\"mapSize\":{...},\"zones\":[...]}"}
```

## Tips

- More evolution generations = more training data = better models.
- Use `--min-score=70` or higher if you have enough data and want only top-quality examples.
- The seeded shuffle ensures reproducible train/val splits across runs.
- Monitor validation loss during training; if it diverges from training loss, reduce epochs.
