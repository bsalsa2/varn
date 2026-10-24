# Roadmap

Long-term research and product milestones. Items are checked only when the evidence is in the repository. Nothing has run on physical hardware yet.

## Direction

1. Establish reproducible research and evaluation methods.
2. Improve the reliability and documentation of existing experiments.
3. Develop controlled simulation and testing capabilities.
4. Identify and validate a differentiated product opportunity.
5. Develop a working prototype and evaluate its practical utility.
6. Expand into a family of proprietary autonomous products as capabilities and resources mature.

## Current project: passive sky-tracking node

- [x] Pico servo firmware: smooth motion, calibration, command protocol (tested in software)
- [x] Detection and tracking loop, working in simulation, covered by automated tests
- [x] Pan-tilt mount designed in CAD, with STEP and STL files
- [x] Wiring diagram and bill of materials
- [ ] Detection model v3 (`drone` and `aircraft`): in training, not yet scored
- [ ] Sighting logger and live dashboard on real hardware (built and tested in simulation only)
- [ ] Build the physical hardware
- [ ] Outdoor test: measure detection range and conditions
- [ ] Compare detections against ADS-B flight data and publish accuracy results
- [ ] Raspberry Pi 4 and solar deployment

Scope: passive sensing and tracking only. See the [README](README.md).

## How milestones are tracked

Open work lives in GitHub issues and the project board (Backlog, Research, In Progress, Validation, Complete). Results are summarized in [RESEARCH.md](RESEARCH.md).
