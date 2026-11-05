S1 Scope and honesty notes

* Varn is detection only: a camera finds objects in the sky and labels them drone or aircraft. No jamming or interference.
* All numbers were copied by hand from Kaggle report.md files, run logs and a threshold-check notebook, Oct 2026.
* No model has been run on Varn's own camera in a real sky. No hardware has been built. No empty-sky false-alarm rate has been measured.
* metric "mAP50" = mean average precision at IoU 0.5, as reported by the Ultralytics validator.

S2 Models

* M-v3: small YOLO model, 3,006,038 parameters, input 960 px. File v3 best.pt 18.4 MB; ONNX export 11.9 MB (the file the detector runs). Status: baseline and default; never replaced.
* M-run1: fine-tune of v3 on Roboflow + Bird vs Drone pictures. Optimizer "auto" ignored the learning rate setting and used AdamW lr 0.001667. Backbone frozen for 10 layers. Status: not promoted.
* M-run2: same data, notebook v10, intended AdamW lr 0.0005 (optimizer line not checked). Status: not promoted.
* M-run3: same data, same settings name (ft_lr0.0005_freeze10). Weights ft_best.pt 6.31 MB, ONNX 12.5 MB (varn-ft-2026-10-28). Status: not promoted after clip check.
* M-run4: fine-tune on Roboflow + 3,000 Svanstrom training frames (public domain, split by whole video). Status: not promoted.
* M-run5: same as run 4 with a train/validation/test split by video, training watching Roboflow + Svanstrom validation, patience 15. Trained 38 of 126 planned epochs in 73.2 min, best epoch 23, stopped by early stopping (15 epochs without improvement). Status: not promoted.

S3 Datasets

* D-roboflow: Roboflow "airplane-drone-helicopter" v2. 4,045 validation pictures, 2,426 (60%) near-copies of training pictures were dropped, 800 clean pictures used for validation; 4,000 sampled for training. License: not checked.
* D-birdvsdrone: Bird vs Drone (Kaggle), MIT license. 18,323 training pictures (3,000 sampled); 889 test pictures, 847 after removing 42 near-copies. Pictures named DT = drone, BT = bird; birds used as "no drone" examples. Median drone box covers about 8-9% of the picture. No aircraft labels. Test pictures come from the same collection as the training pictures.
* D-svanstrom: Drone-detection-dataset (Svanstrom, Alonso-Fernandez, Englund 2021, "A Dataset for Multi-Sensor Drone Detection"), CC0 public domain. 650 videos (365 infrared, 285 visible) labeled Airplane, Bird, Drone, Helicopter, with per-frame boxes. Only the visible videos were used. Daylight only; drones flown within 200 m. Helicopters were treated as aircraft; bird frames as "nothing here".
* D-clips: 43 licensed real clips (public domain and CC, sources kept in a private SOURCES_and_LICENSES.csv): airplane 4, military_aircraft 15, military_drone 12, drone 12. One drone clip (drone_11) is a broken file and is skipped, leaving 42 clips and 1,701 frames at one frame per second. Labels are per video (the clip name), so frames where the object is out of view or tiny count as misses.

S4 Test sets

* T-roboflow-800: 800 clean Roboflow validation pictures (274 drone and 408 aircraft boxes). Limit: v3 was probably trained on this collection, so it flatters v3.
* T-bvd-847: 847 Bird vs Drone test pictures (502 drone boxes, no aircraft). Limit: same collection as the training pictures.
* T-svan-1195: 1,195 frames from Svanstrom videos held out in run 4. Limit: same drones and sites as training.
* T-svan-897: 897 frames from Svanstrom videos held out in run 5. A DIFFERENT split from T-svan-1195. Limit: same drones and sites as training.
* T-clips-42: the 42 readable real clips, 1,701 frames (aircraft clips 19 clips, 703 frames; drone clips 23 clips, 998 frames).

S5 Results: mAP50

* v3 .pt on T-roboflow-800: 0.853 (drone 0.905, aircraft 0.800; mAP50-95 0.468).
* v3 ONNX on T-roboflow-800: 0.831 (drone 0.893, aircraft 0.768; mAP50-95 0.459). Gap versus .pt is padding in scoring, not the export.
* v3 on T-bvd-847: 0.255 (precision 0.344, recall 0.269, mAP50-95 0.086).
* run1: T-roboflow-800 0.810; T-bvd-847 0.761. Verdict: KEEP v3.
* run2: T-roboflow-800 0.831; T-bvd-847 0.812. Verdict: KEEP v3 (margin -0.022, limit -0.020).
* run3: T-roboflow-800 0.834 (drone 0.883, aircraft 0.785); T-bvd-847 0.798 (precision 0.765, recall 0.711). Verdict: promote-candidate, then KEEP v3 after the clip check.
* run4: T-roboflow-800 0.801 (drone 0.847, aircraft 0.754); T-svan-1195: v3 0.063, run4 0.648. Verdict: KEEP v3.
* run5: T-roboflow-800 0.797 (drone 0.846, aircraft 0.748); T-svan-897: v3 0.079, run5 0.736. Verdict: KEEP v3.

S6 Results: real clips (T-clips-42), share of frames, confidence 0.35
Wrong-class numbers count a wrong-class box anywhere in the frame, even when the right class also appears.

* run3 versus v3: false drone on aircraft clips 2.6% to 6.0%; no aircraft box on aircraft clips 63.9% to 72.1%; false aircraft on drone clips 14.8% to 12.9%; no drone box on drone clips 91.6% to 94.1%.
* run4 versus v3: false drone on aircraft clips 2.6% to 4.8%; no aircraft box 63.9% to 46.9%; false aircraft on drone clips 14.8% to 27.6%; no drone box 91.6% to 90.2%.
* run5 versus v3: false drone on aircraft clips 2.6% to 4.1%; no aircraft box 63.9% to 48.6%; false aircraft on drone clips 14.8% to 29.5%; no drone box 91.6% to 92.5%.
* run5 by clip group (v3 to run5), 524 / 521 / 182 / 474 frames: military_drone (12 clips): false aircraft 17.6% to 38.4%; no drone box 89.5% to 93.7%. military_aircraft (15 clips): false drone 3.5% to 5.6%; no aircraft box 63.1% to 44.7%. airplane (4 clips): false drone 0.0% to 0.0%; no aircraft box 65.9% to 59.9%. drone (11 clips): false aircraft 11.8% to 19.6%; no drone box 93.9% to 91.1%.

S7 Results: threshold check on T-clips-42 (v3 versus the run3 weights)
"found" = right class appears (even if the wrong one appears too). "mislabeled only" = wrong class appears and the right one does not. Share of frames.

* v3 at 0.25: aircraft found 44.2%, mislabeled only 6.8%; drone found 12.9%, mislabeled only 19.5%; rough score +0.154.
* v3 at 0.35: aircraft found 36.1%, mislabeled only 2.4%; drone found 8.2%, mislabeled only 13.8%; rough score +0.141.
* v3 at 0.5: 25.5% / 0.6% / 5.5% / 7.9%; +0.112.
* v3 at 0.65: 9.0% / 0.3% / 1.6% / 2.0%; +0.041.
* v3 at 0.8: 1.6% / 0.0% / 0.3% / 0.4%; +0.007.
* run3 at 0.25: 37.4% / 10.8% / 12.5% / 17.2%; +0.110.
* run3 at 0.35: 27.9% / 6.0% / 5.7% / 12.7%; +0.074.
* run3 at 0.5: 16.6% / 1.6% / 1.1% / 6.3%; +0.049.
* run3 at 0.65: 6.5% / 0.0% / 0.0% / 2.5%; +0.020.
* run3 at 0.8: 2.3% / 0.0% / 0.0% / 1.0%; +0.006.
* Rough score = the average over aircraft clips and drone clips of (frames with the right class) minus (frames with only the wrong class). It is a guide, not a verdict. Lowest threshold tested was 0.25.

S8 Known gaps and open questions (show on Overview)

* No run on Varn's own camera in a real sky.
* False alarms on empty sky have not been measured.
* v3 finds a drone in only about 8% of frames of the real drone clips.
* v3 is nearly blind on small, distant objects (0.063 to 0.079 on held-out Svanstrom videos).
* Three kinds of fine-tune found aircraft in more frames but mixed up drone and aircraft more. v3 stays the default.
* Hypothesis, NOT verified: large military unmanned aircraft are called "aircraft" because the training drones were small multirotors.
* 42 clips with per-video labels is a small test. A hand-labeled set of boxes from real footage is needed.

S9 Licenses and credits

* Svanstrom dataset: CC0. Bird vs Drone: MIT. Roboflow set: license not checked. Licensed clips: public domain and Creative Commons, private.
* Credit: Svanstrom, Alonso-Fernandez, Englund (2021), "A Dataset for Multi-Sensor Drone Detection", Data in Brief.
