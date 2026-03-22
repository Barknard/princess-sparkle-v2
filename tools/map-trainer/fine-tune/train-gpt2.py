#!/usr/bin/env python3
"""
Fine-tune DistilGPT2 on map blueprint data.
Quick training: ~10 minutes on RTX 3060.
Output: tools/map-trainer/fine-tune/model-gpt2/
"""
import json
import torch
from pathlib import Path
from transformers import (
    AutoTokenizer, AutoModelForCausalLM,
    TrainingArguments, Trainer, DataCollatorForLanguageModeling
)
from datasets import load_dataset

BASE_DIR = Path(__file__).parent
MODEL_NAME = "distilgpt2"
OUTPUT_DIR = BASE_DIR / "model-gpt2"
TRAIN_FILE = BASE_DIR / "training-data-gpt2-train.jsonl"
VAL_FILE = BASE_DIR / "training-data-gpt2-val.jsonl"


def main():
    if not TRAIN_FILE.exists():
        print("No training data found. Run prepare-training-data.js first.")
        return

    print(f"Loading tokenizer and model: {MODEL_NAME}")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)

    print("Loading datasets...")
    dataset = load_dataset("json", data_files={
        "train": str(TRAIN_FILE),
        "validation": str(VAL_FILE)
    })

    def tokenize(examples):
        return tokenizer(
            examples["text"],
            truncation=True,
            max_length=512,
            padding="max_length"
        )

    tokenized = dataset.map(tokenize, batched=True, remove_columns=["text"])

    training_args = TrainingArguments(
        output_dir=str(OUTPUT_DIR),
        overwrite_output_dir=True,
        num_train_epochs=10,
        per_device_train_batch_size=4,
        per_device_eval_batch_size=4,
        eval_strategy="epoch",
        save_strategy="epoch",
        logging_steps=10,
        learning_rate=5e-5,
        weight_decay=0.01,
        fp16=torch.cuda.is_available(),
        load_best_model_at_end=True,
        report_to="none",
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized["train"],
        eval_dataset=tokenized["validation"],
        data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False),
    )

    print(f"Training on {len(tokenized['train'])} examples...")
    trainer.train()

    print(f"Saving model to {OUTPUT_DIR}")
    trainer.save_model()
    tokenizer.save_pretrained(str(OUTPUT_DIR))
    print("Done!")


if __name__ == "__main__":
    main()
