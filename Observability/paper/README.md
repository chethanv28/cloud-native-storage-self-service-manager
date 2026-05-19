# JOSS paper — CNS Manager Observability

This directory contains the JOSS (Journal of Open Source Software)
submission manuscript and bibliography for the **Observability**
subsystem of Cloud Native Storage (CNS) Manager.

## Contents

| File         | Purpose                                                       |
|--------------|---------------------------------------------------------------|
| `paper.md`   | JOSS-format Markdown manuscript                               |
| `paper.bib`  | BibTeX bibliography                                           |
| `README.md`  | Build instructions and pre-submission checklist (this file)   |

## Building a local preview

JOSS renders submissions with the `openjournals/inara` Docker image —
the same toolchain used in production. Run it locally to verify the
paper builds cleanly:

```bash
cd Observability/paper
docker run --rm \
  --volume "$PWD":/data \
  --user "$(id -u):$(id -g)" \
  --env JOURNAL=joss \
  openjournals/inara
```

The output PDF lands at `paper.pdf` in this directory.

## AI usage disclosure

The use of generative AI is permitted by JOSS provided it is disclosed.
This paper and the accompanying Observability subsystem code used the
following tools, all under direct human review:

- **Anthropic Claude (Opus 4.7)** — copy-editing the manuscript,
  drafting Kubernetes manifests under `Observability/deploy/`,
  scaffolding the mock exporter and React UI, generating SVG
  illustrations.
- **GitHub Copilot (October 2025 release)** — auto-completion
  suggestions while editing React UI components in `Observability/ui/src/`.

All architectural decisions — centring the subsystem on
`csi_sidecar_operations_seconds`, the driver-profile mechanism, the
three severity scenarios, dashboard panel selection, and RBAC
tightening — were made by the human authors. The pre-existing CNS
Manager modules (orphan detection, svMotion, registration APIs) predate
the use of AI tools.

## Conflict-of-interest disclosure

- **Chethan Venkatesh** is employed by Broadcom Inc., which owns VMware
  and ships the vSphere CSI Driver — one of several drivers exemplified
  by the included `Observability/driver-profiles/vsphere/` profile. The
  Observability work described here is vendor-neutral. Chethan is a
  contributor to the upstream
  `vmware-samples/cloud-native-storage-self-service-manager` project
  from which this repository is forked.
- **Vijitha Sathyanarayanamurthy** is employed by Walmart Global Tech
  and has contributed to the broader open-source CSI ecosystem in a
  personal capacity. Walmart Global Tech has no commercial interest in
  the work.

Both authors contribute under the project's Apache 2.0 license.

## Pre-submission checklist

Before filling out the
[JOSS submission form](https://joss.theoj.org/papers/new), verify:

### Software-side

- [x] **Open source** — Apache License 2.0 (root `LICENSE` file).
- [x] **Public hosting with browsable source, issues, and PRs** —
      `https://github.com/chethanv28/cloud-native-storage-self-service-manager`.
- [x] **>6 months of public development history** — the upstream
      project has been public since August 2022. **The fork inherits
      this history.** JOSS automated checks examine the commit DAG;
      because forks share commit hashes with their upstream, the
      multi-year history is preserved.
- [x] **Sustained iterative development** — 36+ commits over 2.5+
      years in the inherited history.
- [x] **CONTRIBUTING file** — `CONTRIBUTING_CLA.md` at repo root.
- [x] **CODE_OF_CONDUCT** — `CODE_OF_CONDUCT.md` at repo root.
- [x] **NOTICE / LICENSE** — both present at repo root.
- [ ] **Tagged releases** — the upstream had `r0.3.0`. Before
      submitting, tag a fresh release on this fork that includes the
      Observability subsystem, e.g. `v0.4.0-observability` or
      `v1.0.0-cns-mgr-obs`.
- [ ] **Tests / CI for the new subsystem** — add a GitHub Actions
      workflow that builds the mock-exporter Docker image, validates
      the Kustomize manifests with `kubectl kustomize Observability/`,
      and parses the dashboard JSON files. The existing modules
      already have validation.
- [ ] **Demonstrated research adoption** — gather concrete evidence
      that CNS Manager (existing modules) and / or the new
      Observability subsystem are in use by researchers, academic HPC
      teams, or research-supporting groups. Cite the strongest
      examples inline in `paper.md`.

### Paper-side

- [x] `paper.md` exists with YAML front matter and all required sections.
- [x] `paper.bib` exists with all cited keys.
- [x] AI usage disclosure included in the manuscript.
- [ ] Verify both ORCID URLs resolve before submission.
- [ ] Have a colleague unfamiliar with CNS Manager run the
      `cd Observability/mock && docker compose up --build` quick start
      and at least one of the existing CNS Manager flows. JOSS
      specifically asks for this kind of unfamiliar-user validation.

### Co-publication

There are no related publications currently in review for this
specific Observability subsystem. If a separate IEEE paper on
orphan-volume detection (existing CNS Manager functionality) is in
preparation, declare it on the JOSS submission form under
"Co-publication."

## Risks worth knowing about

JOSS pre-review screening has four gates. Compared to the original
`csi-driver-observability` standalone repo, this CNS-Manager-based
submission is significantly stronger but is **not** guaranteed to pass.
Honest assessment:

### Strengths (vs. a brand-new repo)

- ✅ **Public history gate (≥6 months)** — passed by inheritance from
  upstream (August 2022 → present).
- ✅ **Iterative development gate** — 36 commits spread over multiple
  releases up through `r0.3.0`.
- ✅ **Good open-source practices** — CONTRIBUTING, CODE_OF_CONDUCT,
  Apache 2.0, public issues and PRs all present.

### Open risks

1. **Reviewer scrutiny of "what is the submission for"**. The paper
   describes a *subsystem* (Observability/) of a larger project.
   Reviewers may ask why the JOSS submission is not for the whole CNS
   Manager project. Two acceptable answers:
   (a) the existing modules are already documented and reviewed in the
   upstream vmware-samples project;
   (b) this submission is for the *combined* CNS Manager + Observability
   software, with the paper focused on the most substantial recent
   addition. If you prefer answer (b), revise `paper.md` to give the
   pre-existing modules equal weight rather than mentioning them only
   briefly.

2. **Fork vs. upstream**. JOSS accepts forks, but reviewers may ask
   why the paper is not being submitted from the canonical
   `vmware-samples/cloud-native-storage-self-service-manager`. If you
   are a major contributor to upstream and the Observability work
   could be merged there, that would be an even stronger submission.
   Consider opening a PR to upstream first; if accepted, retarget the
   JOSS submission to the upstream URL.

3. **"Major contributor" rule** (JOSS authorship requirement). JOSS
   requires submitting authors to be major contributors to the
   software. Verify that the combined commit history shows substantial
   author contributions from both Chethan and Vijitha (either to the
   upstream prior to the fork, to the fork's added Observability
   subsystem, or both).

4. **Demonstrated research impact** (JOSS gate #2). Still the hardest
   gate. Aspirational statements about research use will not pass.
   Gather concrete evidence: academic / national-lab / hospital
   deployments, papers that cite CNS Manager or use it operationally,
   downstream integrations.

### Recommended path

1. Push this repository's main branch with the new `Observability/`
   folder and `paper/` directory. Verify the build with the
   `openjournals/inara` Docker image (instructions above).
2. Open issues for the unchecked items in the checklist above
   (CI workflow, version tag, demonstrated adoption evidence).
3. Decide whether to submit as-is or invest in points 1-4 from
   "Open risks" first. Submitting as-is is reasonable; the worst case
   is a desk-rejection that says specifically what is missing, after
   which you resubmit.
