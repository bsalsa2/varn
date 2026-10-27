// Every value below is hand-copied from a file in platform/evidence/.
// `src` names that file. Do not add a number that is not in one of them.
export const SRC = {
  score: 'kaggle-report-score-run.md',
  run1: 'kaggle-report-train-run1.md',
  log: 'kaggle-log-excerpts.md',
  run2: 'fine-tune-run2.md',
};

export const roboflow = {
  title: 'Roboflow clean validation',
  detail: '800 images · 682 instances (drone 274, aircraft 408). 2426 of 4045 validation images were near-duplicates of training images and were dropped.',
  rows: [
    { model: 'v3 (.pt)', metric: 0.853, vsV3: '+0.000', src: SRC.run1 },
    { model: 'v3 (.pt, square padding)', metric: 0.831, vsV3: '−0.022', src: SRC.run1 },
    { model: 'v3 (.onnx, what the detector runs)', metric: 0.831, vsV3: '−0.022', src: SRC.run1 },
    { model: 'Fine-tune run 1 (ft_lr0.0005_freeze10)', metric: 0.810, vsV3: '−0.043', src: SRC.run1 },
  ],
  detail2: [
    { label: 'v3 (.pt)', map5095: '0.468', drone: '0.905', aircraft: '0.8', src: SRC.log },
    { label: 'v3 (.onnx)', map5095: '0.459', drone: '0.893', aircraft: '0.768', src: SRC.log },
  ],
  pr: 'v3 (.pt) on all 800 images: P 0.896, R 0.767',
};

export const birdDrone = {
  title: 'Bird vs Drone test set',
  detail: '847 images kept of 889 (42 near-copies of training pictures dropped) · 502 instances, all drone, 0 aircraft.',
  rows: [
    { model: 'v3 (.pt)', kind: 'v3', metric: 0.255, extra: 'mAP50-95 0.0864 · P 0.344 · R 0.269', src: SRC.log },
    { model: 'Fine-tune run 1 (ft_lr0.0005_freeze10)', kind: 'fine-tune', metric: 0.761, extra: 'Different model from v3', src: SRC.run1 },
  ],
};

export const runs = [
  {
    id: 'score', name: 'Score run', mode: 'score', date: 'approx Oct 26, 2026', src: SRC.score,
    verdict: 'No fine-tune was run (MODE = score). Nothing was changed. Nothing was promoted.',
  },
  {
    id: 'run1', name: 'Fine-tune run 1', mode: 'train', date: 'approx Oct 27, 2026', src: SRC.run1,
    verdict: 'KEEP v3: the fine-tune got worse on the Roboflow validation set, so it forgot something v3 knew.',
    note: "Log: optimizer=auto ignored lr0=0.0005; AdamW(lr=0.001667) was used.",
  },
  {
    id: 'run2', name: 'Fine-tune run 2', mode: 'train', date: '', src: SRC.run2, pending: true,
    config: 'From v3 · AdamW lr 0.0005 · backbone frozen (10 layers) · 4 h cap',
  },
];

export const caveats = [
  'v3 was probably trained on this same Roboflow dataset, so these scores favour v3 and cannot prove a model is good in the real sky.',
  'The number that settles it is a score on clips filmed and labelled by hand and never trained on. None exists yet.',
];
