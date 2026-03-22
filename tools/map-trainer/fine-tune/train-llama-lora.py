#!/usr/bin/env python3
"""
LoRA fine-tune Llama 3.2 3B on map blueprint data.
Training: ~30 min on RTX 3060 12GB.
Output: tools/map-trainer/fine-tune/model-llama-lora/
"""
import torch
from pathlib import Path
from transformers import (
    AutoTokenizer, AutoModelForCausalLM,
    TrainingArguments, Trainer, DataCollatorForLanguageModeling,
    BitsAndBytesConfig
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from datasets import load_dataset

BASE_DIR = Path(__file__).parent
MODEL_NAME = "meta-llama/Llama-3.2-3B"  # or "unsloth/Llama-3.2-3B" for faster
OUTPUT_DIR = BASE_DIR / "model-llama-lora"
TRAIN_FILE = BASE_DIR / "training-data-llama-train.jsonl"
VAL_FILE = BASE_DIR / "training-data-llama-val.jsonl"


def main():
    if not TRAIN_FILE.exists():
        print("No training data found. Run prepare-training-data.js first.")
        return

    print(f"Loading {MODEL_NAME} with 4-bit quantization...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
    )

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        quantization_config=bnb_config,
        device_map="auto",
    )
    model = prepare_model_for_kbit_training(model)

    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    print("Loading datasets...")
    dataset = load_dataset("json", data_files={
        "train": str(TRAIN_FILE),
        "validation": str(VAL_FILE)
    })

    def tokenize(examples):
        texts = [
            f"{inst}\n{out}"
            for inst, out in zip(examples["instruction"], examples["output"])
        ]
        return tokenizer(
            texts,
            truncation=True,
            max_length=1024,
            padding="max_length"
        )

    tokenized = dataset.map(
        tokenize,
        batched=True,
        remove_columns=["instruction", "input", "output"]
    )

    training_args = TrainingArguments(
        output_dir=str(OUTPUT_DIR),
        num_train_epochs=5,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        eval_strategy="epoch",
        save_strategy="epoch",
        logging_steps=5,
        learning_rate=2e-4,
        fp16=True,
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

    print(f"Training LoRA on {len(tokenized['train'])} examples...")
    trainer.train()

    print(f"Saving LoRA adapter to {OUTPUT_DIR}")
    model.save_pretrained(str(OUTPUT_DIR))
    tokenizer.save_pretrained(str(OUTPUT_DIR))
    print("Done!")


if __name__ == "__main__":
    main()
