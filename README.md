# Varn Labs

**Camera-based sky observation research**  
*An independent research project. Results are published with their limits.*

[Website](https://tryvarn.com) · [Master Plan](docs/MASTER_PLAN.md)

---

## What this is

Varn Labs explores low-cost, camera-based sky observation: detecting drones and aircraft in recorded video, and checking what the camera sees against public flight data (ADS-B). That flight-data comparison is written but has not yet been run against a real feed.

Varn Labs is an independent research project and is not affiliated with any other company named Varn.

It is a research prototype. Results so far come from recorded video only, and nothing has run on physical hardware yet. It is detection-only: nothing here jams, intercepts or acts against anything it sees.

## What we're working on now

VARN is at an early research and prototype stage. Current work explores **camera-based observation and computer vision**, including experimental detection and tracking software for drones and aircraft, a dashboard, event logging, and a developing model-training and evaluation workflow.

The immediate technical priority is to make training understandable, repeatable, and measurable—then use evaluation evidence to decide what to improve next.

### Current focus

1. Organize the existing training workflow into one clear main notebook.
2. Establish a reproducible baseline and evaluate it on held-out data.
3. Record metrics, failure cases, and known limitations.
4. Improve the model through controlled experiments.
5. Develop a controlled software demonstration and, when justified, explore safe hardware integration.

## Engineering principles

- **Product ownership:** Build proprietary capabilities and products, not only custom work for others.
- **Evidence over hype:** Claims should match what has actually been implemented, tested, and measured.
- **Difficult problems:** Pursue technically challenging work when it can create meaningful value.
- **Reliability:** Evaluate failure cases and limitations, not just successful examples.
- **Focused execution:** Make the next milestone narrow and measurable while keeping the long-term ambition broad.
- **Responsible engineering:** Treat safety, privacy, security, and appropriate oversight as real requirements.

## Roadmap

1. **Establish a baseline:** Make the current computer-vision workflow reproducible.
2. **Improve systematically:** Run controlled experiments and document results.
3. **Identify a product problem:** Research real needs and existing alternatives before committing to a product.
4. **Demonstrate a capability:** Build a controlled prototype with clear acceptance criteria.
5. **Build the company:** Seek informed feedback, develop a credible portfolio, and explore appropriate programs and funding.
6. **Expand through evidence:** Grow into more complete products and additional product areas when the results justify it.

The roadmap is a direction, not a claim that future capabilities already exist.

## Project status and research standards

VARN is an early-stage engineering initiative. Components must be described according to their actual implementation and testing status.

- **Implemented** does not automatically mean tested.
- **Tested** does not automatically mean broadly validated.
- **Training results** do not by themselves prove performance on unseen data or in the real world.
- **Planned hardware or features** are not completed products.

Experiments should document inputs, configurations, evaluation methods, results, failure cases, and limitations. The goal is reproducible progress and precise public claims.

## Long-term direction

Long term, and not a current plan: if the evidence supports it, the hope is that low-cost sky sensing like this could one day help protect airspace and infrastructure, including for defense uses.

## Explore

- **Website:** [tryvarn.com](https://tryvarn.com)
- **Strategy and long-term direction:** [VARN Master Plan](docs/MASTER_PLAN.md)

---

**VARN**  
*Think long-term. Engineer the next milestone. Prove the difference.*
