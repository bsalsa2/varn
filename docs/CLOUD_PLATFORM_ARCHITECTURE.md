# VARN Cloud Platform — Architecture v0.1

> **Status:** Proposed architecture; not yet implemented or deployed.
> **Purpose:** Establish a permanent, cloud-first software foundation for VARN. This is the beginning of VARN's product software platform, not a disposable experimentation dashboard.
> **Principles:** Cloud-first, provider-portable, secure by default, affordable to start, honest about current capability.

## 1. Product direction

VARN intends to build a persistent software platform that can connect VARN products, data sources, models, and user-facing applications over time. It takes inspiration from the broad architectural idea of a shared sensor/data/software platform, but VARN must develop its own product requirements and implementation.

The platform should grow with VARN. Early capabilities should be useful immediately while avoiding architectural decisions that force a complete rewrite later.

## 2. Non-negotiable constraints

- **Cloud-hosted by default:** The school laptop is a browser-based access device, not the host for VARN services or its primary development environment.
- **No assumed paid services:** Prefer free tiers and open-source components during the initial stage. Verify current limits and billing requirements before selecting providers. Never enable paid resources or billing without explicit approval.
- **Portability:** Keep core application logic independent of any one hosting provider where practical.
- **Data ownership:** Store model outputs, datasets, configuration, and records in documented, exportable formats. Keep backups and test restoration.
- **Security:** Never commit credentials, API keys, private datasets, or secrets to GitHub. Use managed secret storage or deployment environment variables. Apply least-privilege access and authentication.
- **Evidence:** Clearly distinguish proposed, implemented, deployed, tested, and validated components.
- **Responsible scope:** Initial work focuses on general computer vision, data management, evaluation, and safe sensor-data integration. Do not build autonomous weapon engagement or targeting capabilities.

## 3. Logical architecture

### A. Web application
A browser-accessible interface for sign-in, viewing system status, inspecting data, reviewing model outputs, and managing permitted workflows.

### B. Backend API
A versioned API that handles authentication/authorization, validation, metadata, and coordination between services. Keep business logic in the application rather than in provider-specific configuration.

### C. Data and artifact storage
Use object storage for larger files (datasets, model artifacts, and uploaded results) and a relational database for structured records and metadata. Keep file references, checksums, provenance, and schema versions with records. Avoid storing large binaries directly in relational tables.

### D. Model and processing integration
Kaggle remains the current model-training environment. Initially, VARN can ingest exported predictions, metrics, and model artifacts when licensing and storage constraints allow. Later, add a separately controlled processing/compute service if a real workload requires it; do not assume model training must move off Kaggle immediately.

### E. Observability and quality
Add structured application logs, error reporting without secrets or sensitive payloads, health checks, automated tests, and basic usage/cost visibility. Track the provenance of uploaded data and model versions.

## 4. Portability strategy

- Use Python for backend services unless a demonstrated requirement favors another language.
- Keep core business logic separate from hosting adapters.
- Define interfaces for object storage, background jobs, and external model integrations.
- Prefer standard HTTP APIs, portable database formats, and documented export paths.
- Containerize services with Docker when it becomes useful for deployment consistency.
- Define infrastructure declaratively when the platform becomes complex enough to justify it.
- Maintain a deployment guide and a recovery/migration checklist.
- Periodically export data and verify that it can be restored outside the original provider.

Portability reduces lock-in but does not make migration automatic. Managed identity, networking, queues, databases, and observability may need replacement or adaptation.

## 5. Initial build sequence

### Milestone 0 — Confirm constraints and provider options
- Confirm the repository and public/private boundaries.
- Compare hosting options for frontend, backend, database, and object storage.
- Check free-tier availability, card requirements, quotas, inactivity behavior, data location, and overage risks.
- Do not create billable resources until explicitly approved.

### Milestone 1 — Deploy the smallest real cloud application
- A minimal authenticated web application.
- A versioned backend health/status endpoint.
- Automated checks and a repeatable deployment path.
- Secrets kept out of source control.
- Browser access from the school laptop; no requirement to host services locally.

### Milestone 2 — Add persistent platform data
- Database schema for users, projects, datasets, model versions, and evaluation runs, with only the entities actually needed at first.
- Object storage for artifacts.
- Access control, upload validation, file size limits, and audit-relevant metadata.
- Export and restore procedure.

### Milestone 3 — Connect the current Kaggle workflow
- Define a small, versioned import format for model predictions and metrics.
- Upload one evaluation result and associate it with a dataset/model version.
- Display results and compare runs.
- Do not assume or claim that training is integrated until this path works end to end.

### Milestone 4 — Expand based on demonstrated need
- Add job queues or cloud compute only when a real workload requires them.
- Add additional data sources through explicit adapters.
- Consider receiver integration later; a USB receiver cannot directly connect to a remote cloud server and would need a separate gateway to forward data.

## 6. Initial data model (conceptual)

- **Project:** A VARN workstream or product.
- **Dataset:** Name, version, provenance, license/permissions, schema, and storage location.
- **ModelVersion:** Source/revision, model artifact reference, configuration, and training provenance.
- **EvaluationRun:** Dataset version, model version, evaluation code version, metrics, timestamp, and status.
- **Artifact:** Storage reference, checksum, size, content type, and access policy.

This is a starting vocabulary, not a requirement to implement every table immediately.

## 7. Provider-selection checklist

Score each candidate against:
- Can the project start without a credit card?
- Can unexpected charges be prevented, not merely noticed?
- Are free quotas adequate for a small prototype?
- Can the app, database, and files be exported or migrated?
- Is authentication available without custom security code?
- What happens after inactivity or quota exhaustion?
- Are logs, backups, and deletion controls adequate?
- Are terms and age/eligibility requirements compatible with the founder's situation?
- Can an adult help review legal, account, and billing commitments when required?

## 8. Definition of the first successful release

The first release is successful when:
1. The application is hosted remotely and accessible through a browser.
2. The backend is deployed and exposes a documented health/status endpoint.
3. Authentication and access controls protect private functions.
4. Secrets are not present in the repository or browser bundle.
5. A sample model-evaluation result can be uploaded and retrieved with its provenance intact.
6. Automated tests run on changes.
7. The project has a documented export/restore path and known cost limits.

A deployed landing page alone does not satisfy these criteria.

## 9. Decision log

- **2026-10-27:** Direction selected: cloud-first platform intended to remain cloud-hosted indefinitely if desired, with a practical path to migrate between providers or to self-managed infrastructure later.
- **2026-10-27:** School laptop is for browser access, not the primary host for VARN services.
- **2026-10-27:** Kaggle remains the current model-training environment until there is a specific reason to change it.
- **2026-10-27:** No cloud provider or billable service is selected yet. Provider choice requires a comparison of current terms, limits, portability, and billing safeguards.
