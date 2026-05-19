---
title: 'Cloud Native Storage Manager — Observability: A Prometheus and Grafana Subsystem for Kubernetes Persistent-Volume Operations on Private Cloud'
tags:
  - Kubernetes
  - container storage interface
  - CSI
  - vSphere
  - private cloud
  - observability
  - Prometheus
  - Grafana
  - persistent volumes
  - storage diagnostics
  - Go
  - Python
  - JavaScript
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
date: 18 May 2026
bibliography: paper.bib
---

# Summary

**Cloud Native Storage (CNS) Manager** [@cnsmanager] is an open-source
diagnostic and self-service tool that helps Virtual Infrastructure (VI)
and storage administrators detect and auto-remediate operational issues
in the persistent-volume control plane of Kubernetes [@burns2016borg]
clusters running on VMware vSphere private clouds. Existing
functionalities include orphan-volume detection and deletion, orphan-
snapshot detection and deletion, and storage vMotion (svMotion) of
Container Native Storage (CNS) volumes between datastores.

This paper describes a new subsystem of CNS Manager — the
**`Observability/` module** — that introduces a vendor-neutral
**Prometheus and Grafana observability stack for any Kubernetes
Container Storage Interface (CSI) [@csispec] driver**. The subsystem
is built around the standard `csi_sidecar_operations_seconds` histogram
metric [@k8scsisidecar] emitted by the official Kubernetes CSI sidecar
containers (`external-provisioner`, `external-attacher`,
`external-resizer`, `external-snapshotter`), so it works out-of-the-box
with every Kubernetes-compliant CSI driver — vSphere CSI [@vspherecsidriver],
EBS, GCE PD, Azure Disk, Ceph, OpenStack Cinder, and bespoke drivers.
Driver-specific metrics are layered on top as opt-in *driver profiles*;
the included `vsphere` profile demonstrates the pattern by scraping the
additional CNS- and vCenter-level metrics emitted by the vSphere CSI
driver on ports 2112 (controller) and 2113 (syncer).

The module bundles four artifacts: a Kustomize-based Kubernetes
deployment of Prometheus and Grafana with hardened RBAC and
production-ready dashboards; a Docker-Compose quick-start stack that
requires no Kubernetes cluster; a Python-based mock exporter that
synthesizes realistic CSI traffic in three severity scenarios for
testing and demonstration; and a React + Recharts [@react; @recharts]
reference UI that can be embedded into internal admin portals as an
alternative to Grafana. All four artifacts share the same metric model
and dashboards, so observations made during local prototyping reproduce
unchanged in production.

# Statement of need

Kubernetes is increasingly the workload platform of choice for
research-supporting computing on private infrastructure — academic
high-performance computing clusters, national-laboratory analysis
pipelines, hospital and life-sciences data lakes, climate and CFD
simulation, and large-scale AI/ML training on regulated on-premises
hardware. In each of these environments, the persistent-volume layer is
a CSI driver bridging Kubernetes [@k8scsi] to the underlying storage
fabric. When a researcher's PersistentVolumeClaim hangs in `Pending`,
when a snapshot job silently leaves orphaned objects behind, or when a
large fan-out of pods fails to attach to its data volume in time, the VI
administrator is the person asked to diagnose it. Yet the tools they
have today are fragmented:

- **Vendor consoles** (vCenter, vRealize Operations) see the storage
  backend but not the Kubernetes objects above it.
- **`kubectl describe`** sees the Kubernetes object state but not the
  underlying driver-to-storage call latencies or fault distributions.
- **Each CSI driver's own dashboards**, where they exist, use bespoke
  metric names and label schemes. An admin operating two different
  storage backends in the same cluster needs two different dashboards.

CNS Manager's existing modules already address two pieces of this
fragmentation: they detect orphaned objects and offer cross-cluster
self-service operations against vCenter. The new Observability subsystem
closes the last gap — *runtime visibility into volume operations as
they happen* — by treating the standard CSI-sidecar histogram (emitted
identically by every CSI driver in the Kubernetes ecosystem) as the
lowest common denominator. Operators get a single deployment, a single
dashboard layout, and a single set of PromQL recording rules that work
across every CSI driver they run, with driver-specific augmentations as
composable add-ons. Together with CNS Manager's diagnostic and
auto-remediation features, this gives administrators a complete loop
from *detection* of an operational anomaly through *root-cause
identification* to *self-service remediation*.

# Software description

## Existing CNS Manager modules (briefly, for context)

- **Orphan-volume detection and deletion** — identifies CNS volumes
  in vCenter that no longer correspond to any Kubernetes PV across a
  set of registered clusters, and offers an authenticated API to
  delete them safely.
- **Orphan-snapshot detection and deletion** — analogous to orphan
  volumes, applied to vSphere snapshots managed by the CSI driver.
- **Storage vMotion** — exposes an authenticated API to migrate CNS
  volumes between datastores, complementing native CNS lifecycle
  operations.

These modules are documented in the repository's top-level README and
are not the focus of this paper.

## The `Observability/` subsystem

The new subsystem is rooted at `Observability/` in the repository and
contains the following components:

**`Observability/deploy/`** — Kubernetes manifests, orchestrated by
[Kustomize](https://kustomize.io/): a dedicated
`csi-driver-monitoring` namespace, a least-privileged Prometheus
`ClusterRole` with read-only access to nodes / pods / services /
endpoints, a `ConfigMap`-driven Prometheus configuration with
placeholder targets and a library of recording rules (p50 / p95 / p99
latency, error rate by method, total operation rate), a Grafana
deployment with auto-provisioned datasources, and `NodePort` services
for both UIs.

**`Observability/dashboards/`** — Two production-ready Grafana
dashboards: an **operations overview** (KPI strip, per-method latency,
errors by gRPC status code, per-method summary table) and a
**custom-panel template** for driver-specific extensions. Dashboards
are versioned and embedded into a ConfigMap by Kustomize, so the same
JSON renders identically in the local Docker-Compose stack and in
production Kubernetes.

**`Observability/driver-profiles/`** — A directory pattern for layering
driver-specific extras on top of the standard sidecar baseline. The
included `vsphere/` profile adds scrape jobs for the vSphere CSI
driver's additional metric families on ports 2112 and 2113
(`vsphere_csi_volume_ops_histogram`, `vsphere_cns_volume_ops_histogram`,
`vsphere_request_ops_seconds`, `vsphere_volume_health_gauge`,
`vsphere_full_sync_ops_histogram`, `vsphere_cns_volume_pv_missing`).
Additional driver profiles can be added by duplicating this directory.

**`Observability/mock/`** — A `docker compose` stack composed of three
services: Prometheus, Grafana, and a Python mock exporter that emits
`csi_sidecar_operations_seconds` plus the vSphere driver's extra
metric families. Three severity scenarios — `normal`, `degraded`, and
`failing` — switch the exporter between healthy steady state
(~1.5 % error rate), an elevated-but-functional condition (~6 %), and
a storage outage (~30 %, latency stretched 10–100× baseline). This
makes demos, screenshots, and end-to-end dashboard validation
reproducible on a developer laptop in under a minute.

**`Observability/ui/`** — A React 18 + Vite + Recharts single-page
application that renders the same metric model as the Grafana
dashboards but with the control flow of an embeddable web component.
Supports the same three scenarios via interactive toggle pills.
Intended for integration into internal admin portals where running
Grafana is undesirable or where the dashboard must blend visually
with surrounding enterprise tooling.

## Architectural choices

The decision to centre the subsystem on `csi_sidecar_operations_seconds`
(rather than scraping each driver's bespoke metrics directly) is what
makes the stack portable across drivers without reconfiguration.
Driver-specific extras are *additive* through `driver-profiles/`, not
*replacements* for the baseline. The mock exporter and three-scenario
design double as a deterministic test fixture, so panel screenshots
remain reproducible across runs.

# Research applications

Persistent-volume reliability is the silent prerequisite of
reproducible research on Kubernetes-based platforms. With the
Observability subsystem deployed alongside CNS Manager's
auto-remediation features, investigators using private-cloud
Kubernetes can quantify operationally important properties of their
storage layer — distribution of volume-create latency under load,
attach-detach failure rates during pod rescheduling, snapshot-creation
overhead — and compare across driver implementations or hardware tiers
using identical PromQL queries [@bhimani2017docker]. The mock exporter
and three-scenario design also make the subsystem useful as a teaching
tool for graduate courses on cloud and distributed systems, offering a
self-contained, no-cluster-required target for storage-monitoring
exercises.

# State of development

CNS Manager is open-source under the Apache License 2.0 and has been
publicly developed since August 2022 with sustained contributions
visible in the commit history, tagged releases, public issue tracker,
and a documented PR workflow (`CONTRIBUTING_CLA.md`,
`CODE_OF_CONDUCT.md`). The Observability subsystem is the most recent
addition, but builds on top of CNS Manager's existing client SDK
(`client-sdk/go`), Kubernetes deployment manifests, and authentication
mechanisms (Basic Auth and OAuth2).

# AI usage disclosure

The authors used Anthropic's Claude (Opus 4.7) and GitHub Copilot
(October 2025 release) for assistance with copy-editing the manuscript
text, scaffolding the React reference UI in `Observability/ui/src/`,
drafting initial versions of the Kubernetes manifests under
`Observability/deploy/`, generating the mock-exporter's scenario-shaping
arithmetic, and producing SVG illustrations. All architectural
decisions — centring the subsystem on `csi_sidecar_operations_seconds`,
the structure of driver profiles, the three severity scenarios,
dashboard panel selection, RBAC tightening, and the four parallel
artifact tracks (Kubernetes, Compose, UI, mock) — were made by the
human authors. The existing CNS Manager modules (orphan detection,
svMotion, registration APIs) predate the use of AI tools. Every
AI-assisted output was reviewed, edited, and validated by the authors,
who accept responsibility for the manuscript and accompanying code.

# Acknowledgements

We thank the maintainers of the upstream
`vmware-samples/cloud-native-storage-self-service-manager` project from
which this work was forked, the maintainers of
`kubernetes-sigs/vsphere-csi-driver`, the Kubernetes CSI Special
Interest Group, and the operators of academic and research private
clouds whose operational questions motivated the Observability
subsystem. No external funding supported this work.

# References
