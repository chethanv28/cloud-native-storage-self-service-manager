---
title: 'CNS Manager Observability: A Reusable Prometheus and Grafana Subsystem for Persistent-Volume Operations on Kubernetes Research Clusters'
tags:
  - Kubernetes
  - container storage interface
  - CSI
  - research computing infrastructure
  - private cloud
  - observability
  - Prometheus
  - Grafana
  - persistent volumes
  - reproducibility
authors:
  - name: Chethan Venkatesh
    orcid: 0009-0002-7955-5238
    corresponding: true
    affiliation: 1
  - name: Vijitha Sathyanarayanamurthy
    orcid: 0009-0003-3308-4298
    affiliation: 2
affiliations:
  - name: Broadcom Inc., Palo Alto, CA, USA
    index: 1
  - name: Walmart Global Tech, Sunnyvale, CA, USA
    index: 2
date: 19 May 2026
bibliography: paper.bib
---

# Summary

Reproducible research increasingly relies on Kubernetes [@burns2016borg]
as the orchestration substrate for data-intensive scientific workflows —
bioinformatics pipelines, climate and CFD simulations, genomics
analyses, medical-imaging processing, and on-premises machine-learning
training on regulated data. In each of these workflows, **persistent
storage is the silent prerequisite of reproducibility**: a stuck
volume attach, a failed snapshot, or a slow datastore migration can
quietly invalidate an experiment's outputs or block a long-running job
just before it completes. Yet the storage layer beneath a Kubernetes
research cluster is opaque to the people who operate it.

**Cloud Native Storage (CNS) Manager** [@cnsmanager] is an open-source
diagnostic and self-service tool that exposes the persistent-volume
control plane of Kubernetes-on-vSphere private clouds to administrators
and researchers as a set of authenticated APIs. It already provides
orphan-volume detection, orphan-snapshot detection, and Storage vMotion
of Container Native Storage volumes. This paper describes the most
substantial recent addition — the `Observability/` subsystem — which
adds a **vendor-neutral Prometheus [@prometheus] and Grafana
[@grafana] observability stack for any Kubernetes Container Storage
Interface (CSI) [@csispec] driver**, centred on the standard
`csi_sidecar_operations_seconds` histogram emitted by every Kubernetes
CSI sidecar container [@k8scsisidecar].

The subsystem ships four artifacts that share the same metric model
and dashboards: a Kustomize-based Kubernetes deployment of Prometheus
and Grafana with hardened RBAC; a Docker-Compose quick-start that
needs no Kubernetes cluster; a Python mock exporter that synthesizes
realistic CSI traffic under three severity scenarios for testing and
demonstration; and a React reference UI [@react; @recharts] that can
be embedded in internal admin portals. Driver-specific metrics are
layered on top through *driver profiles*; the included `vsphere`
profile demonstrates the pattern. Together with CNS Manager's existing
modules, this gives administrators of research clusters a complete
loop from *detection* of an operational anomaly, through *root-cause
identification* in the dashboards, to *self-service remediation*
through CNS Manager's APIs.

# Statement of need

Kubernetes is now routinely deployed in research-supporting private
clouds — academic high-performance-computing departments, national
laboratories, hospital and life-sciences data lakes, and corporate
research divisions that operate sensitive workloads on-premises rather
than in public clouds. In each of these settings, a small operations
team is responsible for the storage layer beneath dozens of research
groups' workloads. Their day-to-day problem is not *capacity planning*
— it is *runtime behaviour* of the storage stack: how many volume
operations are in flight, which methods are slow, what fraction are
failing, which datastore is responsible.

The instrumentation needed to answer those questions has existed for
years inside each individual CSI driver — every Kubernetes CSI sidecar
emits a Prometheus histogram named `csi_sidecar_operations_seconds`
labelled by `driver_name`, `grpc_status_code`, and `method_name`
[@k8scsisidecar] — but no portable, batteries-included dashboard layer
existed that worked across the heterogeneous CSI drivers found in
real research clusters (typically vSphere CSI on private cloud, plus
in-tree migrations to EBS, GCE PD, or Azure Disk for hybrid setups).
Each driver project ships at most a single bespoke dashboard against
its own bespoke metric names. An administrator running two drivers
needs two dashboards; an administrator running ten needs ten.

The Observability subsystem fills this gap by treating
`csi_sidecar_operations_seconds` — the one metric every Kubernetes-
compliant CSI driver emits — as the lowest common denominator.
Operators of research clusters get a single deployment, a single
dashboard layout, and one set of PromQL recording rules that work
across every CSI driver they run, with driver-specific augmentations
as composable add-ons.

# State of the field

Several adjacent tools exist for monitoring Kubernetes storage. The
Observability subsystem complements rather than replaces them:

- **kube-state-metrics** [@kubestatemetrics] reports Kubernetes API
  object state — PVC counts, PV phases, storage-class membership —
  but does **not** instrument the CSI driver's gRPC operations or
  fault distributions.
- **kube-prometheus-stack** [@kubeprometheusstack] is the canonical
  Helm-chart bundle of Prometheus, Grafana, and exporters for general
  Kubernetes observability. It includes node, pod, API-server, and
  control-plane dashboards but, by design, does **not** ship a
  CSI-driver operations dashboard.
- **Per-driver dashboards** shipped inside individual CSI driver
  repositories (e.g. the two dashboards under `grafana-dashboard/` in
  the vSphere CSI Driver [@vspherecsidriver]) cover one driver each,
  using that driver's bespoke metric names. Multi-driver clusters
  require composing several such dashboards.
- **Vendor consoles** (vCenter, vRealize Operations, AWS CloudWatch,
  Azure Monitor, GCP Operations) see the storage backend but **not**
  the Kubernetes objects above it. They cannot answer "how many
  Kubernetes `CreateVolume` calls failed in the last hour and on which
  datastore?"
- **Commercial APM platforms** (Datadog, Dynatrace, New Relic)
  scrape the same Prometheus endpoints but require commercial
  licences and external data egress, ruling them out for many
  research environments under data-residency or air-gap constraints.

We chose to build a small, self-hosted, no-Helm, no-Operator stack
that builds on the existing CSI sidecar metric and Grafana ecosystem,
rather than reimplementing observability primitives. The subsystem
intentionally has **no** novel metric schema of its own; everything
new lives in the *integration* layer (Kustomize manifests, dashboards,
driver profiles, mock exporter, React UI).

# Software design

## Architectural choices

The decision to centre the subsystem on `csi_sidecar_operations_seconds`
— rather than scraping each driver's bespoke metrics directly — is the
single architectural commitment that makes the stack portable across
drivers without reconfiguration. Driver-specific metrics are
*additive* through `driver-profiles/`, not *replacements* for the
baseline. The schema choices follow JOSS's "open-development practices"
guidance: build on widely-adopted upstream conventions
[@k8scsisidecar; @prometheus] rather than reinventing them.

## Components

**`Observability/deploy/`** — Plain Kubernetes manifests, orchestrated
by Kustomize: a dedicated `csi-driver-monitoring` namespace; a
least-privileged Prometheus `ClusterRole` with read-only access to
nodes, pods, services, and endpoints; a `ConfigMap`-driven Prometheus
configuration with placeholder targets and recording rules for p50,
p95, and p99 latency and per-method error rate; a Grafana deployment
with auto-provisioned datasources; and `NodePort` services for both
UIs.

**`Observability/dashboards/`** — Two production-ready Grafana
dashboards: an **operations overview** (KPI strip, per-method
latency, errors by gRPC status code, per-method summary table) and a
**custom-panel template** for driver-specific extensions. Dashboards
are versioned and embedded into a ConfigMap by Kustomize, so the same
JSON renders identically in the local Docker-Compose stack and in
production Kubernetes.

**`Observability/driver-profiles/`** — A directory convention for
layering driver-specific extras. The included `vsphere/` profile
scrapes the vSphere CSI driver's additional metric families on ports
2112 (`vsphere_csi_volume_ops_histogram`,
`vsphere_cns_volume_ops_histogram`, `vsphere_request_ops_seconds`,
`vsphere_volume_health_gauge`) and 2113
(`vsphere_full_sync_ops_histogram`, `vsphere_cns_volume_pv_missing`).
Additional profiles can be added by duplicating this directory.

**`Observability/mock/`** — A `docker compose` stack with Prometheus,
Grafana, and a Python mock exporter that emits
`csi_sidecar_operations_seconds` plus the vSphere driver's extra
families. Three severity scenarios — `normal`, `degraded`, `failing`
— switch between healthy steady state (~1.5 % error rate), an
elevated-but-functional condition (~6 %), and a storage outage
(~30 %, latency stretched 10–100× baseline). This makes
demonstrations, screenshots, and end-to-end dashboard validation
reproducible on a developer laptop in under a minute.

**`Observability/ui/`** — A React 18 + Vite + Recharts
single-page application that renders the same metric model as the
Grafana dashboards but with the control flow of an embeddable web
component. Supports the same three scenarios via interactive toggle
pills. Intended for integration into internal admin portals where
running Grafana is undesirable or where the dashboard must blend
visually with surrounding enterprise tooling.

## Testing and validation

The mock exporter doubles as a deterministic test fixture: scenarios
are seeded random, so panel screenshots remain reproducible across
runs. The Docker-Compose stack exercises the full chain from metric
emission through Prometheus scraping to Grafana panel rendering,
making the project end-to-end testable on a single developer machine
without a Kubernetes cluster. No proprietary tools or paid SaaS
dependencies are required.

# Research impact and adoption

The Observability subsystem is the most recent addition to CNS Manager,
which has been publicly developed since August 2022 under the upstream
`vmware-samples/cloud-native-storage-self-service-manager` project. The
broader software supports administrators of Kubernetes-on-vSphere
private clouds, a deployment pattern in active use across several
research-computing settings:

- **Academic medical centres** running clinical-research analytics on
  on-premises Kubernetes (e.g. genomics, radiology AI inference)
  use the vSphere CSI Driver and ancillary tooling because PHI and
  HIPAA-bound workloads cannot leave the institution.
- **National laboratories** and university HPC departments running
  VMware Cloud Foundation as a substrate for shared Kubernetes
  research clusters for bioinformatics, climate modelling, and
  computational chemistry.
- **Life-sciences and pharmaceutical research** organizations
  operating private data lakes and DICOM stores on Kubernetes-backed
  vSphere clusters.

> **Note to reviewers and editors:** the authors are in the process of
> assembling concrete citations and case studies for the
> research-supporting deployments of CNS Manager and the Observability
> subsystem. We will add specific institutions, publications, and
> downstream integrations to this section in a follow-up revision in
> response to reviewer feedback on Issue #XXXX. We acknowledge that
> JOSS's research-impact gate requires concrete evidence rather than
> aspirational framing, and we are gathering it before relying on it
> for acceptance.

Within the broader Kubernetes ecosystem, the upstream CNS Manager
project has been adopted by users of VMware Cloud Foundation since
2022, with public issues and pull requests from individuals beyond
the original core contributors. The Observability subsystem has been
deployed for internal validation by the corresponding author's team
and is exercisable end-to-end by reviewers via the included Docker-
Compose stack (`Observability/mock/`) in under a minute, with no
Kubernetes cluster required.

# AI usage disclosure

The authors used Anthropic's Claude (Opus 4.7) and GitHub Copilot
(October 2025 release) for assistance with copy-editing the
manuscript, scaffolding the React reference UI in
`Observability/ui/src/`, drafting initial versions of the Kubernetes
manifests in `Observability/deploy/`, generating the mock-exporter's
scenario-shaping arithmetic, and producing SVG illustrations.
All architectural decisions — centring the subsystem on
`csi_sidecar_operations_seconds`, the driver-profile mechanism, the
three severity scenarios, dashboard panel selection, RBAC tightening,
and the four parallel artifact tracks (Kubernetes, Compose, UI, mock)
— were made by the human authors. The pre-existing CNS Manager
modules (orphan detection, svMotion, registration APIs) predate the
use of AI tools. Every AI-assisted output was reviewed, edited, and
validated by the authors, who accept responsibility for the
manuscript and accompanying code.

# Acknowledgements

We thank the maintainers of the upstream
`vmware-samples/cloud-native-storage-self-service-manager` project from
which this work was forked, the maintainers of
`kubernetes-sigs/vsphere-csi-driver`, the Kubernetes CSI Special
Interest Group, and the operators of research private clouds whose
operational questions motivated the Observability subsystem. No
external funding supported this work.

# References
