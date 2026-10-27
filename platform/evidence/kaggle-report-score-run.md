Source: report.md from the Output tab of Kaggle notebook varnlabs/varn-train (score mode), copied by hand. Run date approx Oct 26, 2026.

Varn report
Mode: score
Starting weights: /kaggle/working/varn/v3_best.pt (18.4 MB)
ONNX export vs detector contract: PASS
Validation: 800 clean Roboflow images; 2426 of 4045 validation images were near-duplicates of training images and were dropped.
Validation instances per class: {'drone': 274, 'aircraft': 408} (under about 100 per class = noisy)
v3 mAP50 on clean validation: 0.853
v3 exported to ONNX (what the detector runs): 0.831. Gap vs .pt with matching padding: 0.000
Public datasets used: [('bird-vs-drone', 'train', 3000), ('bird-vs-drone', 'test', 889)]; 42 extra test pictures dropped as near-copies of training pictures.
v3 mAP50 on the extra public test set (never trained on): 0.255
model | mAP50 | vs v3
v3 (.pt) | 0.853 | +0.000
v3 (.pt, square padding) | 0.831 | -0.022
v3 (.onnx, what the detector runs) | 0.831 | -0.022
Verdict: No fine-tune was run (MODE = score). Nothing was changed.
Caveat: v3 was probably trained on this same Roboflow dataset, so these scores favour v3 and cannot prove a model is good in the real sky.
The number that settles it is a score on clips you filmed and labelled by hand and never trained on. Nothing was promoted.
