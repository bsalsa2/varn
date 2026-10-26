# VARN — Master Plan

> **Purpose:** The strategic source of truth for VARN's vision, product philosophy, priorities, and milestones.  
> **Status:** Living document. Distinguish ambition from implemented, tested, measured, and validated work.  
> **Last updated:** 2026-10-26

## 1. Executive Summary

**VARN is an ambitious, defense-first autonomous-systems product company.** Its long-term ambition is to develop breakthrough intelligence, turn that technology into exceptional complete products, and achieve capabilities that are difficult to deliver today.

VARN is a **product company, not a contractor-first business**. Its purpose is to invent, own, develop, improve, and sell proprietary products. Customer contracts and partnerships may support that goal, but custom work for its own sake is not the business model.

VARN intends to combine:
- **Breakthrough technology:** Build proprietary capabilities that are difficult to reproduce.
- **Exceptional products:** Turn those capabilities into complete, dependable systems that solve real problems.
- **Vertical integration:** Own the critical software, intelligence, sensing, hardware, and system-level decisions where they create a genuine advantage.

National defense is the primary market. Civilian, industrial, and infrastructure markets may become relevant where the technology and customer need transfer naturally.

VARN is currently an early-stage engineering initiative exploring computer vision and detection. The immediate priority is to make the training workflow understandable, repeatable, and measurable while building company foundations in parallel.

**Operating principle: Think on a 15-year horizon. Engineer for the next milestone. Prove progress with evidence.**

## 2. Vision and Mission

### Vision
Build a major autonomous-systems product company known for difficult engineering, proprietary technology, and complete products that deliver meaningful capabilities.

### Mission
Develop advanced autonomous technology and turn it into dependable products that address important problems, initially in national defense.

VARN believes capable autonomous systems can help people perform dangerous or complex work with less unnecessary exposure to risk. The value of a system must be demonstrated through testing, reliability, appropriate oversight, and responsible use—not assumed from the fact that it is autonomous.

The ambition is intentionally larger than the first project. Today's work is a starting point, not the ceiling.

## 3. What VARN Is—and Is Not

### A defense product company
VARN intends to own its product vision and core intellectual property, develop complete products, and improve them over time. It should build a product roadmap rather than rely primarily on custom engineering services.

### Not contractor-first
VARN may sell to government customers, participate in procurement, work with partners, and fulfill contracts. These are ways to bring products to customers, not the company's identity. Work should be evaluated on whether it builds reusable capability, product value, or strategically useful customer understanding.

### Vertically integrated where it matters
VARN does not need to make every component or reinvent commodity technology. It should own the critical capabilities and system decisions that create its differentiation. Partnerships and external components are useful when they strengthen the product without giving away its core advantage.

### Defense-first, not necessarily defense-only
Defense is the primary strategic market. Some technology may also serve industrial, infrastructure, or civilian needs. Expansion should follow evidence and customer demand rather than dilute focus prematurely.

## 4. Technological Thesis

VARN's ambition has three inseparable parts:

1. **Intelligence:** Develop systems that interpret sensor data reliably and operate within clearly understood limits.
2. **Complete products:** Integrate software, sensing, hardware, interfaces, and testing into coherent systems.
3. **New capabilities:** Pursue difficult problems and develop capabilities that current solutions cannot adequately deliver.

VARN's competitive priorities are:
1. Build what others struggle to build.
2. Solve real customer problems.
3. Pursue ambitious opportunities early, while testing assumptions.
4. Challenge established approaches when doing so improves the outcome.

VARN wants to prove skeptics wrong through engineering evidence, not rhetoric. Technical difficulty is a source of motivation, but complexity alone is not value.

## 5. Product Strategy

VARN aims to be a product company, a technology company, and a full-stack systems company at once. These ambitions reinforce one another: proprietary technology creates an advantage, product engineering turns it into customer value, and system-level ownership makes the result coherent.

Evaluate product opportunities by:
- Importance of the customer problem.
- Potential for a distinctive technical advantage.
- Feasibility of demonstrating value with available resources.
- Reliability, safety, security, and maintainability requirements.
- Potential for a repeatable product rather than one-off custom work.
- Contribution to VARN's long-term capabilities.
- Customer access, cost, and time to market.

Do not choose a product simply because it looks futuristic or resembles a successful company's product.

## 6. Current State

VARN is at an early research and prototype stage. Current work explores camera-based observation and computer vision, including experimental detection and tracking software, a dashboard, event logging, and a developing evaluation workflow. Current model-training work includes learning to distinguish visually similar classes such as drones, airplanes, and birds.

The immediate challenge is organizing the training workflow so experiments can be repeated and improved systematically.

Use these terms precisely:
- **Implemented:** Exists in code or a project artifact.
- **Tested:** Exercised under a stated procedure.
- **Measured:** Evaluated using a defined method and reported results.
- **Planned:** Not yet implemented.
- **Unvalidated:** Exists but has not been adequately tested.

Do not claim model accuracy, real-world performance, hardware readiness, customer validation, or product readiness without evidence. Training performance alone does not establish generalization.

## 7. First-Year Objective

**Proposed horizon: October 2026–October 2027.** This is a planning target, not a guarantee.

VARN will develop three mutually reinforcing foundations: technical evidence, an integrated prototype, and a credible early-stage company. Technical progress is the foundation; company-building proceeds in parallel without replacing engineering work.

### Track A — Technical evidence
- Review the existing training notebooks before combining them.
- Build one understandable main workflow while preserving useful originals.
- Make inputs, configuration, dependencies, and outputs explicit.
- Establish a baseline and consistent evaluation procedure.
- Keep training data separate from held-out evaluation data.
- Track relevant per-class metrics and representative failure cases.
- Run controlled experiments and record what changed.
- Document dataset provenance, limitations, and results.

**Target:** A repeatable workflow and credible report showing what the current model can and cannot do.

### Track B — Integrated prototype
- Begin with a controlled software demonstration using recorded imagery or a sensor feed.
- Define what the prototype is meant to demonstrate before building it.
- Test data input, perception outputs, logging, and interface behavior.
- Consider physical hardware only when the software baseline, resources, and safety requirements support it.
- Treat results as valid only for the conditions actually tested.

**Target:** A coherent demonstration with understood behavior and limitations.

### Track C — Company foundations
- Define a specific product hypothesis and the problem it addresses.
- Study how successful product-led technology companies developed early products, demonstrated capability, found customers, and funded their work.
- Seek feedback from experienced technical and entrepreneurial mentors.
- Maintain a professional public portfolio that distinguishes completed work from future ambition.
- Explore appropriate competitions, grants, research programs, accelerators, and eventual investor opportunities.
- Check eligibility and legal requirements individually; involve a trusted adult where legal or financial commitments are involved.

**Target:** A credible early-stage company story supported by technical evidence, feedback, and a clear next milestone.

External recognition from grants, accelerators, or investors is an ambition, not a guaranteed result or substitute for progress.

## 8. Market Entry

VARN does not yet need to commit to a first commercial product. The initial choice should follow research into customer problems, feasibility, differentiation, and available resources.

Questions to investigate:
- Which important problems are poorly served by existing products?
- How are they handled today, and what is missing?
- What would count as a measurable improvement?
- Who evaluates, purchases, operates, and maintains a solution?
- What testing, security, procurement, and support requirements apply?
- Can a controlled demonstration test the central product hypothesis?

Learn from companies such as Anduril and Mach Industries without copying their product choices or assuming their circumstances can be replicated. Study how they moved from technical work to defined products, evidence, customer access, and a sustainable business.

## 9. Engineering Standards

For significant experiments, record:
- Question or hypothesis.
- Dataset or input source and permissions.
- Code, model, configuration, and dependency versions.
- Evaluation method and conditions.
- Results, including negative results and failure cases.
- Known limitations and possible sources of bias.
- Next decision and its rationale.

Keep experiments comparable. Avoid changing many major variables at once when that makes results hard to interpret. Protect credentials, private data, and sensitive information. Do not publish unsupported claims.

## 10. Decision Framework

Before a major project or feature, answer:
1. What problem or uncertainty does this address?
2. Who benefits, and why would they care?
3. What is known versus assumed?
4. What is the smallest useful experiment?
5. How will success and failure be measured?
6. What will it cost in time, compute, data, money, and attention?
7. What safety, privacy, security, or reliability risks exist?
8. Does it build reusable capability or product advantage?
9. What result would justify continuing, changing direction, or stopping?

Prefer work that reduces an important uncertainty or creates a demonstrable capability. Avoid features added solely for appearance.

## 11. What VARN Must Never Become

- A generic contractor with no meaningful proprietary advantage.
- A custom engineering shop whose work rarely compounds into products.
- A reseller or integrator whose core capability belongs entirely to others.
- A company that substitutes branding or hype for proven engineering.
- A company that claims more than its evidence supports.
- A company that pursues complexity for its own sake.

Partners, contractors, external components, and customer contracts can be useful when they support the product strategy rather than replace it.

## 12. Roadmap and Decision Gates

### Phase 1 — Make current work reproducible
Review and consolidate the training workflow; establish a documented baseline.  
**Exit condition:** The workflow is understandable and measured results can be reproduced.

### Phase 2 — Improve through controlled experiments
Identify major failure modes and test one improvement hypothesis at a time.  
**Exit condition:** VARN can explain which changes help, which do not, and how strong the evidence is.

### Phase 3 — Define a product problem
Research users, alternatives, unmet needs, and measurable product requirements.  
**Exit condition:** A specific problem and a credible reason to pursue it are documented.

### Phase 4 — Demonstrate an integrated prototype
Build a controlled prototype that tests the product hypothesis and records limitations.  
**Exit condition:** A repeatable demonstration provides evidence for or against the idea.

### Phase 5 — Validate the company opportunity
Review technical results, user feedback, feasibility, differentiation, and possible routes to customers.  
**Exit condition:** Evidence justifies the next investment.

### Phase 6 — Productize and expand
Address maintainability, support, security, testing, sourcing or manufacturing, and commercial requirements.  
**Exit condition:** Expansion is justified by evidence, resources, and responsible planning.

Progress through evidence, not elapsed time. If an experiment disproves an assumption, update the plan.

## 13. Immediate Next Milestone

**Make the current computer-vision training workflow repeatable and measurable.**

- [ ] Review each existing notebook and identify its purpose.
- [ ] Preserve originals until the consolidated workflow is verified.
- [ ] Build one clear main notebook without blindly copying conflicting code.
- [ ] Make inputs, paths, configuration, and outputs understandable.
- [ ] Establish a baseline with held-out evaluation data.
- [ ] Record metrics, errors, and limitations.
- [ ] Use the evidence to choose the next experiment.
- [ ] Keep public descriptions aligned with what is actually implemented and tested.

## 14. Founder and Company-Building Principles

VARN starts with limited resources and an ambitious destination. The response is not to shrink the vision, but to focus the work.

- Learn fundamentals rather than depending on tools that are difficult to understand.
- Build evidence and a portfolio before relying on credentials or external validation.
- Seek mentors and constructive criticism.
- Spend carefully and prefer experiments that teach something valuable.
- Protect time for engineering while developing business and market knowledge in parallel.
- Seek appropriate adult guidance for legal, financial, physical testing, and other consequential decisions.

## 15. Decision Log

| Date | Decision | Reason |
|---|---|---|
| 2026-10-26 | VARN is a defense product company, not contractor-first. | The company should own proprietary products and a durable product roadmap. |
| 2026-10-26 | Long-term ambition combines breakthrough technology, complete products, and vertical integration. | VARN wants to turn proprietary capabilities into exceptional systems. |
| 2026-10-26 | Defense is the primary market, with possible civilian and industrial expansion. | Focus first while preserving options for transferable technology. |
| 2026-10-26 | Technical progress is the foundation; company-building proceeds in parallel. | Strong evidence supports products, relationships, recognition, and funding. |
| 2026-10-26 | The immediate milestone is a reproducible training and evaluation workflow. | A reliable baseline is necessary for meaningful improvement. |

## 16. Review Cadence

Review this plan after significant technical milestones, meaningful customer feedback, changes in resources, or evidence that changes an assumption. Update current status and next steps without confusing a temporary result with the long-term vision.

---

**VARN — Autonomous Systems**  
*Build what others struggle to build. Prove it works. Turn it into products.*
