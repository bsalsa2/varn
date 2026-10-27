Source: lines copied from the Kaggle Logs tab (colour codes removed).

pt {'mAP50': 0.853, 'mAP50-95': 0.468, 'AP50 drone': 0.905, 'AP50 aircraft': 0.8}
onnx {'mAP50': 0.831, 'mAP50-95': 0.459, 'AP50 drone': 0.893, 'AP50 aircraft': 0.768}
all 800 images, 682 instances, P 0.896, R 0.767, mAP50 0.853, mAP50-95 0.468  (v3 .pt, Roboflow validation)
v3 on the extra public test set (never trained on): {'mAP50': 0.255, 'mAP50-95': 0.086, 'AP50 drone': 0.255}
all 847 images, 502 instances, P 0.344, R 0.269, mAP50 0.255, mAP50-95 0.0864  (v3 .pt, Bird vs Drone test)
Extra test pictures: 889; dropped 42 near-copies of training pictures; kept 847.
Extra test instances: {'drone': 502, 'aircraft': 0}
Training pictures now: 7000 (Roboflow plus extras)
optimizer: 'optimizer=auto' found, ignoring 'lr0=0.0005' and determining best 'optimizer' and 'lr0' automatically...
AdamW(lr=0.001667, momentum=0.9) with parameter groups 57 weight(decay=0.0), 64 weight(decay=0.0005), 63 bias(decay=0.0)
Starting training for 4 hours...
