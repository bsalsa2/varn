// Records the Command Center can show, all derived from results.js and the evidence files.
// Nothing here is new data: models and datasets are the ones the Kaggle reports name.
import { SRC, roboflow, birdDrone, runs } from './results.js';
import scoreRun from '../evidence/kaggle-report-score-run.md?raw';
import trainRun1 from '../evidence/kaggle-report-train-run1.md?raw';
import logExcerpts from '../evidence/kaggle-log-excerpts.md?raw';
import fineTune2 from '../evidence/fine-tune-run2.md?raw';

export const EVIDENCE = {
  [SRC.score]: scoreRun,
  [SRC.run1]: trainRun1,
  [SRC.log]: logExcerpts,
  [SRC.run2]: fineTune2,
};

export const models = [
  {
    id: 'v3', name: 'v3', status: 'In use', tone: 'ok',
    summary: 'Current detector weights. Kept after fine-tune run 1 regressed.',
    facts: [
      ['Weights', 'v3_best.pt · 18.4 MB'],
      ['Runtime', 'ONNX export, contract check PASS'],
      ['Roboflow clean val', '0.853 mAP50 (.pt) · 0.831 (.onnx)'],
      ['Bird vs Drone test', '0.255 mAP50 (.pt)'],
    ],
    src: SRC.score,
  },
  {
    id: 'ft1', name: 'Fine-tune run 1', detail: 'ft_lr0.0005_freeze10', status: 'Not promoted', tone: 'muted',
    summary: 'Worse than v3 on Roboflow clean validation, so v3 was kept.',
    facts: [
      ['Starting weights', 'v3'],
      ['Optimizer (from log)', 'AdamW lr 0.001667; lr0 0.0005 was ignored'],
      ['Roboflow clean val', '0.810 mAP50 (−0.043 vs v3)'],
      ['Bird vs Drone test', '0.761 mAP50'],
    ],
    src: SRC.run1,
  },
  {
    id: 'ft2', name: 'Fine-tune run 2', status: 'Running', tone: 'pending',
    summary: 'No result recorded yet.',
    facts: [
      ['Starting weights', 'v3'],
      ['Config', 'AdamW lr 0.0005 · backbone frozen (10 layers) · 4 h cap'],
    ],
    src: SRC.run2,
  },
];

export const datasets = [
  {
    id: 'roboflow-val', name: 'Roboflow clean validation', role: 'Validation',
    images: 800, instances: 682, classes: 'drone 274 · aircraft 408',
    note: '2426 of 4045 validation images were near-duplicates of training images and were dropped.',
    caveat: 'v3 was probably trained on this dataset, so scores here favour v3.',
    src: SRC.score,
  },
  {
    id: 'bird-vs-drone-test', name: 'Bird vs Drone test', role: 'Extra public test · never trained on',
    images: 847, instances: 502, classes: 'drone 502 · aircraft 0',
    note: '889 pictures; 42 near-copies of training pictures dropped.',
    caveat: 'Drone-only, so it says nothing about aircraft.',
    src: SRC.log,
  },
  {
    id: 'bird-vs-drone-train', name: 'Bird vs Drone train', role: 'Training',
    images: 3000, instances: null, classes: 'Not reported',
    note: 'Public dataset added to training. Total training pictures now 7000 (Roboflow plus extras).',
    caveat: 'Instance counts were not in the report.',
    src: SRC.score,
  },
];

export const bestVerified = roboflow.rows[0];
export const runOne = roboflow.rows[3];
export const pendingRun = runs.find((r) => r.pending);
export { roboflow, birdDrone, runs, SRC };
