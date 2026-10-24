# Contributing to Varn

Thanks for looking. Varn is one student's project, so reviews can take a few days, and small, focused pull requests get merged fastest.

## Scope first

Varn is a **passive** sensing and tracking platform. Pull requests that transmit on aviation or drone-control frequencies, jam, spoof, or act on aircraft won't be merged. The README's Scope section is the rule.

## Setup

```bash
pip install -r brain/requirements.txt opencv-python-headless onnx pyyaml
python -m unittest discover tests -v
pip install ruff && ruff check .
```

Website work lives in `web/`:

```bash
cd web
npm ci
npm run check
npm run build
```

## Before you open a pull request

- The tests and `ruff check .` pass. CI runs the same two commands.
- If you change the behavior or status of something, update the README status table and the website Status section together. They must say the same thing.
- Don't add a number to the docs unless its source is in the repo (a file, a test, or a dataset note).
- Anything that hasn't run on real hardware must say "simulated" or "not built yet." Don't remove those labels without evidence.
- Keep the diff to one change. Unrelated cleanup goes in its own pull request.

## Repository standards

- **Issues:** bugs, experiments, research questions, and product hypotheses each have their own template. Pick the one that fits.
- **Project board:** Backlog, Research, In Progress, Validation, Complete. An item moves to Complete only after it has been validated, not just merged.
- **Pull requests:** say what changed, how it was tested, and what remains unverified.
- **Releases:** only tagged versions (`vMAJOR.MINOR.PATCH`) are stable. Other commits on `main` are not production-ready.
- **Experiments:** record the dataset version, configuration, evaluation metrics, and random seeds where they apply, so someone else can rerun it.
- **Security:** never commit API keys, credentials, private data, or sensitive operational information. See [SECURITY.md](SECURITY.md).
- **Licensing:** decide what is open source and what stays proprietary before publishing code, models, or datasets. Until a file or folder says otherwise, the repository is under the [MIT license](LICENSE).

## Commits and branches

Use short imperative commit messages ("Add tracker timeout to config"). Branch from `main`.

## Privacy

Don't commit Wi-Fi names or passwords, camera addresses with passwords, photos or videos of people, or personal details. Snapshots from the logger are gitignored; keep it that way.

## Where things are

| Folder | What's there |
|---|---|
| `brain/` | Detection, tracking, control, logging, dashboard (laptop or Pi) |
| `pico/` | MicroPython servo firmware |
| `hardware/` | Pan-tilt CAD and printable files |
| `web/` | The project website |
| `tests/` | Laptop-side tests |
| `training/` | Colab training notebook and dataset scripts |
