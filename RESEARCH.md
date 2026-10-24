# Research

Open research questions and summaries of completed experiments. Published results describe only the specific experiments listed. Simulation and recorded-video results do not establish real-world performance.

Detailed notes and reports go in `research/` once there is something to put there. Each experiment should record the dataset version, configuration, evaluation metrics, and random seeds where applicable.

## Open questions

- How well does the v3 detector (`drone`, `aircraft`) reduce false drone labels on real aircraft compared with v2?
- At what range does a wide-lens webcam detect a small drone and an aircraft? (Current README figures are estimates, not measurements.)
- How well do the node's aircraft detections agree with ADS-B flight data for the same view and time window?

## Experiment summaries

### Detection model v2 on real-world video

- **Data:** 43 real-world clips of planes, military jets, and drones.
- **Model:** YOLOv8n, classes `drone` and `aircraft` (v2). Training data: a 28,526-image aircraft and drone dataset (see [datasets/README.md](datasets/README.md)).
- **Results:**
  - On real aircraft, v2 labeled 7.5% of frames a drone (798 of 10,657).
  - 0.8% for civilian planes and 10.8% for military jets (mostly distant F-35s).
  - On drone clips, v2 labeled the drone correctly 14.9% of the time.
- **Limits:** recorded video only, no physical node. Seeds and exact configuration were not recorded for this run.
- **Next:** score v3 on the same 43 clips with the same method.
