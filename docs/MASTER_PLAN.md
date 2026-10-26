# VARN Master Plan

> **Document purpose:** The durable strategic reference for VARN: why it exists, what it is working toward, how it chooses what to build, and how progress is measured.
>
> **Status:** Living document — strategy and hypotheses may change as evidence improves.
>
> **Last reviewed:** 2026-10-26

---

## 1. Executive Summary

VARN is an independent engineering initiative working toward a product-driven autonomous-systems company. The long-term ambition is to develop, own, and bring proprietary systems to market—not merely provide contract engineering or assemble other companies' products.

VARN is currently at an early research and prototype stage. Its immediate job is to build technical credibility through focused experiments, reproducible evaluation, clear documentation, and honest demonstrations.

**Core principle:** Keep the long-term ambition broad, but make the next milestone narrow, measurable, and achievable.

## 2. Vision

Build a durable technology company that develops useful, reliable autonomous products for real-world problems.

Over time, VARN may grow from a focused initial product into a family of systems that share selected capabilities, engineering standards, and a commitment to measurable performance.

The vision is an ambition, not a claim about current capabilities.

## 3. Mission

Identify important problems, develop proprietary technical solutions, and validate them through disciplined engineering and evidence.

VARN will favor products that provide clear practical value, can be tested against meaningful criteria, and can be maintained and improved over time.

## 4. What VARN Is Building Toward

### Product-company model

VARN's intended direction is to own and develop its products and core intellectual property. Services, partnerships, and outside components may be useful, but they should support the product strategy rather than become the entire business.

### Long-term scope

The long-term scope is autonomous systems broadly. The first successful product does not need to define the company's entire future. New product areas should be earned through demonstrated capability, customer evidence, and available resources.

### Initial technical foundation

Current areas of exploration include:

- Computer vision and perception
- Simulation and controlled testing
- Data processing and sensor integration
- Reliability, evaluation, and failure analysis
- Embedded systems and product engineering

These are research interests, not a commitment to build every capability at once.

## 5. Current State

VARN is an early-stage engineering project. The public project describes work around camera-based observation and computer vision, including experimental detection and tracking software, a dashboard, event logging, and a developing research/evaluation workflow.

The current state must be described precisely:

- **Implemented:** Features that exist in the code or project and can be demonstrated.
- **Tested:** Features exercised through a documented test.
- **Measured:** Features evaluated with a defined dataset, method, and reported metrics.
- **Planned:** Ideas or features not yet implemented.
- **Unvalidated:** Features that exist but have not yet been adequately tested.

Do not describe planned hardware, simulations, or software as real-world validated capabilities unless the relevant tests have actually been completed.

## 6. Strategic Priorities

### Priority 1 — Establish a reliable technical baseline

Create one clear, reproducible entry point for the current model workflow. Document the dataset, setup, training procedure, evaluation method, and outputs. Preserve useful existing work while consolidating it carefully.

**Success looks like:** Another person can understand the workflow, run it with the required files and resources, and interpret the results without guessing.

### Priority 2 — Measure before optimizing

Define a fixed evaluation method and keep training data separate from held-out evaluation data. Record relevant metrics, test conditions, examples of failures, and changes between experiments.

**Success looks like:** Each claimed improvement is supported by comparable results rather than a visual impression or a single favorable example.

### Priority 3 — Make the project understandable

Keep the repository organized, explain the purpose of each major file, record experiment decisions, and distinguish verified facts from assumptions.

**Success looks like:** A technically curious reader can tell what VARN has built, what evidence exists, what remains uncertain, and what happens next.

### Priority 4 — Learn about real problems

Explore potential users and use cases before committing to a product direction. Ask what problem is being solved, how it is handled today, what the consequences are, and what evidence would make a new solution useful.

Initial exploration should favor safe, non-operational applications such as infrastructure inspection, environmental observation, and other practical sensing or monitoring problems.

**Success looks like:** A clearly defined problem supported by real user evidence—not just an interesting technology looking for a use.

### Priority 5 — Prove a narrow product capability

Choose a small, testable prototype that addresses the selected problem. Set success criteria in advance, compare against a reasonable baseline, document limitations, and demonstrate the result.

**Success looks like:** A repeatable demonstration with evidence of utility and a credible explanation of its limits.

### Priority 6 — Decide what deserves to scale

Only after technical and problem validation should VARN decide whether to invest in broader hardware, more complex systems, additional product lines, or a commercial launch.

**Success looks like:** The next investment follows from evidence, user needs, feasibility, safety, and available resources.

## 7. Decision Framework

Before starting a major feature or experiment, answer:

1. **Problem:** What specific problem or uncertainty does this address?
2. **User value:** Who benefits, and how?
3. **Evidence:** What do we know, and what are we assuming?
4. **Test:** How will success or failure be measured?
5. **Scope:** What is the smallest useful version?
6. **Cost:** What time, compute, data, and money will it require?
7. **Risk:** Could it create privacy, safety, security, or reliability concerns?
8. **Decision:** What result would justify continuing, changing direction, or stopping?

Prefer work that reduces an important uncertainty or creates a demonstrable capability. Avoid adding features merely because they look impressive.

## 8. Product and Business Principles

- **Solve a real problem:** Customer value comes before feature count.
- **Own meaningful differentiation:** Build capabilities or product experiences that are difficult to replace with a generic integration.
- **Evidence over claims:** Public statements should match the work actually completed.
- **Reliability over spectacle:** A repeatable result is more valuable than a flashy but fragile demo.
- **Start narrow, expand deliberately:** Do one useful thing well before pursuing a broad product family.
- **Keep options open:** Do not lock the company into a market or architecture before evidence supports it.
- **Build sustainably:** Account for cost, maintenance, usability, support, and deployment—not only the first prototype.
- **Protect trust:** Handle data responsibly and explain limitations clearly.

## 9. Engineering and Research Standards

Every significant experiment should record:

- Question or hypothesis
- Dataset or input source and relevant permissions
- Model, code version, and configuration
- Train/validation/test separation where applicable
- Evaluation method and metrics
- Results, including negative results and failure cases
- Known limitations and possible sources of bias
- Next decision and reason

Keep experiments comparable. Change one major variable at a time when practical. Do not present training-set performance as evidence of generalization. Keep secrets, credentials, and private data out of the repository.

## 10. Roadmap

This roadmap is ordered by dependencies, not fixed calendar dates.

### Phase A — Organize and establish a baseline
- Review the existing notebooks and code before deleting or replacing anything.
- Consolidate the useful model workflow into one main notebook.
- Make setup, inputs, outputs, and required files explicit.
- Define a held-out evaluation procedure and save a baseline report.

**Exit condition:** The current workflow is understandable and its measured performance can be reproduced.

### Phase B — Improve through controlled experiments
- Identify the largest documented failure modes.
- Select one improvement hypothesis at a time.
- Compare each experiment with the baseline.
- Keep a concise experiment log and update the limitations.

**Exit condition:** VARN can explain which changes help, which do not, and how strong the evidence is.

### Phase C — Validate a problem
- Explore potential non-operational, real-world use cases.
- Talk with appropriate potential users with suitable adult guidance where needed.
- Compare existing approaches and define the unmet need.
- Write a short problem statement and measurable product requirements.

**Exit condition:** There is a specific problem and a reason to believe solving it would matter.

### Phase D — Build and test a focused prototype
- Define a minimal prototype and acceptance criteria.
- Build only what is needed to test the core value.
- Test in controlled, appropriate conditions.
- Document performance, limitations, and user feedback.

**Exit condition:** A repeatable demonstration provides evidence for or against the product hypothesis.

### Phase E — Make a product decision
- Review technical results, user evidence, costs, safety, and feasibility.
- Decide whether to continue, pivot, narrow the scope, or stop.
- If justified, plan productization, maintainability, support, and a responsible path to market.

**Exit condition:** The next stage is justified by evidence, not momentum alone.

### Phase F — Expand carefully
- Reuse only the capabilities that genuinely transfer.
- Develop additional products when there is a validated reason.
- Establish stronger testing, security, documentation, and operational practices as complexity grows.

**Exit condition:** Expansion improves the company without weakening reliability or focus.

## 11. Current Next Milestone

**Milestone:** Create one maintainable main model notebook and establish a reproducible baseline.

Checklist:

- [ ] Review all existing notebooks and identify their purpose.
- [ ] Preserve originals until the consolidated workflow is checked.
- [ ] Consolidate reusable steps without blindly copying duplicate or conflicting code.
- [ ] Make data paths and required files configurable.
- [ ] Separate training from held-out evaluation.
- [ ] Record metrics, example outputs, and failure cases.
- [ ] Document what has and has not been validated.
- [ ] Update this plan when the evidence changes the next priority.

This is the immediate priority; broader product expansion comes later.

## 12. Operating Rules

- Do not claim a feature works without a relevant demonstration or test.
- Do not claim real-world performance based only on simulation or training results.
- Do not publish private data, secrets, credentials, or information without permission.
- Do not delete or replace important project assets before reviewing and preserving them.
- Keep early experiments small enough to understand and reproduce.
- Seek appropriate adult guidance for legal, financial, physical testing, and other consequential decisions.
- Keep prototypes and research within safe, lawful, and responsible boundaries.

## 13. Decision Log

Record major strategic decisions here using this format:

| Date | Decision | Evidence or reasoning | Revisit when |
|---|---|---|---|
| 2026-10-26 | Make reproducible technical evidence the next milestone before broad expansion. | The current project needs a clear baseline to distinguish demonstrated capability from aspiration. | A reproducible baseline is complete or new evidence changes priorities. |

## 14. Review Cadence

Review this document when a milestone is completed, a major assumption changes, or meaningful customer or technical evidence appears. Update the current state and next milestone; do not rewrite the long-term vision just because an experiment succeeds or fails.

---

**VARN — Autonomous Systems**  
*Build carefully. Measure honestly. Expand when the evidence earns it.*
