# Kaggle training

**`varn_kaggle.ipynb` is the one notebook for Kaggle.** Use it for all training from now on.

Legacy, kept for reference only (do not use for new runs):

- `varn_train.ipynb`, `varn_v4_export_and_phone_finetune.ipynb`, `varn_auto_train.ipynb` (Colab notebooks)
- `auto_train.py` and the auto pipeline (`.github/workflows/auto-train.yml`, `training/automation/`)

## What I do by hand

1. **Upload datasets** (Kaggle ▸ Datasets ▸ New Dataset, both private):
   - the clips dataset: a labeled YOLO dataset with `images/`, `labels/` and a `data.yaml`;
   - the checkpoint dataset: the `last.pt` from the previous run.
2. **Attach inputs**: open `varn_kaggle.ipynb` in a Kaggle notebook, Add Input for both datasets, and set Accelerator to a GPU. Make the folder names in the Settings cell match the dataset slugs.
3. **Save Version ▸ Save & Run All.** Watch the Logs tab: one `[epoch n/N]` line per epoch. If it stops moving, the run has stalled.
4. **Download the output** from the finished version's Output tab: `best.pt`, `last.pt`, `best.onnx`, `results/`.
5. **Attach the output for the next session**: upload `last.pt` as a new version of the checkpoint dataset (or add the finished notebook's output as an input and point `CHECKPOINT_DATASET` at it), then repeat from step 2.

## Notes

- Training stops at `MAX_HOURS` (default 8) using Ultralytics' `time` argument. Set `IMGSZ = 960` for the final number; use 800 if you run out of memory or time.
- If `data.yaml` has a `test:` split that exists, the notebook scores it. There is no frozen test set in this repo, so otherwise it says none was found and does not make one.
- Resume is attempted first. A `last.pt` from a finished run can't be resumed exactly, so the notebook then continues from its weights with a fresh optimizer and says so in the log.
