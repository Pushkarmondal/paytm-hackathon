# Claim Sach

An evidence-backed, interactive health-insurance coverage simulator. Signature feature: **Coverage Twin**.

> Know what your policy might leave you paying before admission.

Claim Sach turns the terms of one health-insurance policy into structured rules, applies them to an itemised hospital estimate, and shows the potential deductions covered by the simulation, item by item, with the source clause beside every number and an explicit list of what could not be determined. It is not a chatbot, not a policy explainer, and not a guarantee of any insurer's decision.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. The demo scenario loads immediately; no upload, account or API key is needed. The app runs fully offline.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Documents

- `docs/PRD.md`: product requirements, decisions and the planned demo fixture.
- `docs/ARCHITECTURE.md`, `docs/DEMO_SCRIPT.md`, `docs/EVALUATION.md`: added as the build progresses.

The demo policy is **synthetic**: it is not issued by any insurer. See `docs/PRD.md` §8.
