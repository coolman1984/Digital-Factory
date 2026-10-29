# Industrial 3D and cinematic reference pack
Researched: 2026-10-29. Status: curated primary-source references, NOT installed integrations, downloaded assets, validated models, or a completed digital twin.

Read with [the owner vision](VISION_3D_AND_MOTION.md). Before relevant 3D, inspection, animation or editing work, select references from this pack and record how they inform the result. Strong industrial case studies are benchmarks, not evidence that our repository already has the same capabilities. These are selected leading references; no objective "best in the world" ranking is claimed.

## 1. Start here: real industrial benchmarks with pictures and demonstrations

| Source / owner | What to inspect | Application here | Access and reuse boundary |
| --- | --- | --- | --- |
| [BMW FactoryExplorer — NVIDIA case study](https://www.nvidia.com/en-eu/case-studies/bmw-group-develop/) — BMW / NVIDIA | Factory pictures, source-data composition diagram, equipment placement, area loading, measuring, navigation and collision tools | Digital Factory: hierarchy, area selection, guided navigation and engineering readability | Public case study; BMW's internal application, models and source code are NOT offered here for unrestricted reuse |
| [Siemens Digital Twin Composer](https://www.siemens.com/et-ee/company/digital-transformation/industrial-metaverse/introducing-digital-twin-composer/) — Siemens | Industrial facility examples and integration of engineering information with realistic environments | Reference for joining visual context to engineering/process information | Commercial product showcase. Search-index content was available; direct page fetch timed out during this research. Recheck access before choosing a specific image or clip |
| [Siemens / NVIDIA](https://www.siemens.com/en-us/partners/software/nvidia/) — Siemens | Engineering visualization and industrial collaboration examples | Additional primary-source industrial benchmark | Public presentation, not an open-source implementation or blanket media licence |
| [Charge film and gallery](https://studio.blender.org/projects/charge/) / [asset-library breakdown](https://studio.blender.org/blog/charge-asset-library/) — Blender Studio | Film, industrial set dressing, close-up materials, robot movement, shot/edit progression and making-of material | Animation: lighting, camera, pacing, industrial detail; Digital Factory: material reference | Some resources are free; many production files require a subscription. Verify each item's licence and attribution. Open production does not mean every download is free |

Study the actual images, clips and available breakdowns before calling a result comparable. For clips, record URL + time range + the exact technique being studied; a title or promotional claim is insufficient. Do not copy third-party media into our deliverables merely because it can be watched online.

**Digital twin distinction:** an attractive interactive factory is a 3D visualization. Claims about a specific real factory also need traceable engineering data, validated behavior and appropriate connection to real state. Our fictional Plant EG-01 remains simulated; never relabel it as a measured BMW/Siemens installation.

## FlexSim — requested industrial simulation benchmark

[FlexSim manufacturing examples](https://www.flexsim.com/manufacturing-simulation/), [official videos](https://www.flexsim.com/videos/), [software release archive](https://www.flexsim.com/newsroom/software-releases/) and [Autodesk release announcements](https://forums.autodesk.com/t5/flexsim-knowledge-base/tkb-p/flexsim-tkb-en/sort-string/topicPublishDate).

**Why it matters:** a particularly relevant benchmark for Digital Factory's process layer: production flow, queues, conveyors, resources, utilization, bottlenecks, repeated experiments and what-if comparisons. Its 3D view makes process behavior readable. It is also a useful Animation reference for explaining that behavior, but is not a replacement for a cinematic editing pipeline.

**2023 is not the endpoint:** the official archive records an Omniverse connector and USD support in FlexSim 2023 Update 2 (August 2023). Official resources also show later releases, including 2026 tutorials and 2027 release announcements listed in October 2026. Check the actual release notes, licence and supported connector/export path for the chosen version; an older connector announcement does not guarantee unchanged compatibility today.

FlexSim is commercial proprietary software with a trial, not a free open-source library we can copy into our site. It uses discrete-event simulation; consider it for process-modeling ideas and a future explicitly scoped evaluation, not an automatic engine integration. Study actual model assumptions, time distributions, repeated runs and output metrics before copying conclusions. For our project, define comparable throughput, waiting time and resource-utilization scenarios; separate simulation correctness from visual polish.

## 2. Public repositories and implementation references

| Repository / documentation | Learn or evaluate | Limits and compatibility |
| --- | --- | --- |
| [NVIDIA Omniverse Kit App Template](https://github.com/NVIDIA-Omniverse/kit-app-template) | Building custom OpenUSD applications, scene exploration and extensible tools | Desktop/cloud application framework, not a small browser library. Version, SDK distribution, RTX hardware and dependency licences must be checked before adoption |
| [NVIDIA Isaac Sim](https://github.com/isaac-sim/IsaacSim) / [digital-twin tutorials, version 5.1](https://docs.isaacsim.omniverse.nvidia.com/5.1.0/digital_twin/index.html) | Robot motion, sensors, conveyors, warehouse assembly and simulated workflows | Specialized robot simulation; GPU/platform and asset terms vary. The tutorial URL is versioned; verify against the chosen release |
| [NVIDIA Virtual Facility Integration](https://docs.omniverse.nvidia.com/vfi/latest/overview.html) | Bringing engineering assemblies into usable scenes: conversion, validation, optimization and hierarchy | Pipeline reference. Keep the detail necessary for the intended close-up/inspection; simplification must not erase the parts we need to explain |
| [OpenUSD — Pixar](https://github.com/PixarAnimationStudios/OpenUSD) | Large scene composition, hierarchy, variants and animation interchange | A scene framework, not a replacement browser renderer. Check current OpenUSD and third-party licences; downloadable sample assets can have different restrictions |
| [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) / [visual gallery](https://github.khronos.org/glTF-Assets/) | Material, animation and glTF import/export calibration using documented sample models | Model-specific licences and credits apply. Calibration assets do not prove factory-mechanics accuracy |
| [Three.js material documentation](https://threejs.org/docs/pages/Material.html) / [clipping example](https://threejs.org/examples/webgpu_clipping_stencil.html) | Ghosted materials, clipping and how section faces are presented | Current examples may use newer Three.js/WebGPU. Digital Factory's existing version must be checked before adapting code; clipping alone does not author real internal geometry |
| [Three GPU Pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer) | High-quality product lighting and still/controlled-camera presentation | Current upstream uses WebGPU and differs from the older WebGL integration recorded in this project. Do not blindly replace the pinned version or use progressive path tracing as the live whole-factory default |
| [glTF Transform](https://gltf-transform.dev/) | Inspecting and optimizing browser delivery assets | Preserve named parts, pivots, hierarchy, materials and animation; verify after every destructive optimization |

**Separate category: AI factories are data centers.** [NVIDIA's Omniverse DSX blueprint](https://github.com/NVIDIA-Omniverse-blueprints/omniverse-dsx-blueprint-for-ai-factories) is useful for facility visualization, UI and sample thermal/electrical workflows. It is a reference blueprint, not a turnkey electronics-production-line twin. It can require substantial RTX resources. Do not mistake server racks for TV assembly machinery or assume all dataset contents are freely redistributable.

## 3. Actual geometry, materials and reference pictures

| Source | Useful material | Accuracy / rights requirements |
| --- | --- | --- |
| [NVIDIA SimReady Central](https://github.com/NVIDIA-Omniverse/simready-central) / [catalog documentation](https://docs.omniverse.nvidia.com/simready/latest/simready-central.html) | Discoverable simulation-ready USD datasets, metadata and validation context | Index, not one universally licensed asset pack. Inspect the selected dataset, OEM, licence, revision and validation profile; some sources may restrict commercial use |
| [Bosch Rexroth MTpro](https://www.boschrexroth.com/en/AT/c/planning-software-mtpro/) / [CAD catalog](https://www.boschrexroth.com/en/th/downloads/cad-files/) | Assembly/conveyor layouts, manufacturer component geometry, part information and engineering presentation | Free tool access is not blanket redistribution permission. Capture exact part number, revision, units and source terms; manufacturer CAD can omit internals |
| [SMC CAD library](https://www.smcworld.com/cadlib/en-sg/) | Real pneumatic component forms, dimensions and product identifiers | Some downloads require registration. Verify selected model rights and simplification; external CAD does not establish hidden mechanisms |
| [Thor open robot arm](https://github.com/AngelLM/Thor) — AngelLM and contributors | Real editable assembly to study part hierarchy, joints and a defensible exploded-view workflow | Educational six-axis arm, not a production-certified plant robot. Repository states CC BY-SA 4.0; preserve attribution and applicable share-alike obligations when reusing/adapting |
| [Poly Haven](https://polyhaven.com/) / [licence](https://polyhaven.com/license) | HDR lighting, material textures and models for believable surfaces | Asset files are CC0, including commercial use. Website text, example/user renders and logos are not automatically CC0. These assets provide appearance, not machine engineering |

A photograph can guide shape and finish; it does not reveal hidden parts. For accurate cutaways and moving internals, obtain authorized assembly drawings/CAD, service manuals or manufacturer-approved sectional views. If unavailable, label invented mechanisms as illustrative and never imply measured accuracy.

## 4. Reference selection and evidence before implementation

1. Choose one bounded target machine or product. Record intended use: browser inspection, film, or both.
2. Select one industrial benchmark, one geometry source and one relevant technical example. For a film, also select one camera/edit/lighting reference that supports the existing house method.
3. Make a small reference sheet: assembled view, separated assemblies, section/interior, working motion and intended hero shot. Each entry needs a source and a note explaining which visual or engineering property matters. If no credible source exists for a view, record that gap.
4. Keep an evidence record for each imported asset: source URL, owner/creator, asset/part ID, revision or commit, download date, licence/terms URL, permitted use, required credit/share-alike, units, axis conventions, geometry simplifications, modeled vs inferred internals, destination and modifications. An unresolved reuse licence means reference-only, not permission to ship.
5. Author a canonical part hierarchy and assembled transforms. Prepare a high-detail source scene and an optimized glTF/GLB browser derivative where suitable. Test conversion: naming, scale, pivots, normals, materials and motion can change across formats; OpenUSD and glTF are not interchangeable by renaming a file.
6. Prove one sequence: assembled → controlled explosion → precise reassembly → ghosted shell → readable cutaway → plausible working motion. Use the same part identities for interactive controls and film shots where practical. Avoid competing simulation logic.
7. Review actual frames and interactive output against the selected references. Measure loading, memory and responsiveness on named target hardware. A cinematic render and a responsive browser view have different budgets.
8. Record what was demonstrated, what remains illustrative, and what is unverified. Repository existence, a passing test and an impressive marketing video are not proof of an installed or accurate integration.

## 5. Initial direction for the two repositories

**Digital Factory:** retain the current Three.js path pending measured evidence for a replacement. Apply industrial references to assets, part hierarchy, inspection controls and clarity. Omniverse is an optional pipeline/industrial-platform evaluation, not an automatic migration. Separate visual quality, interaction performance, engineering accuracy and simulation validation in acceptance criteria.

**Animation:** use the same credible source geometry for Blender cinematic shots, then the existing studio pipeline for editing, sound, captions and export. Verify Blender and the adapter locally before claiming readiness. Charge is a cinematography/production reference, not a substitute for the studio's established owner taste. Adding references does not upgrade experimental capabilities to proven.

**First implementation candidate, not executed here:** one authorized or appropriately licensed assembly, one short exploded/cutaway demonstration and one browser inspection prototype. The owner has requested the reference documentation in this scope, not installation, a rendered film or a runtime rewrite.

## Research and maintenance

Primary repositories, official documentation, manufacturer catalogs and official case studies were consulted. Some links describe changing products or version-specific examples; recheck before adoption and pin the exact revision once an asset or integration is selected. No third-party images, clips, models or code were copied into either project by this documentation update. Maintain credits in the destination project's asset records and film credits when actual reuse happens.


## Owner's concrete next experiment (2026-10-29)

[EXPERIMENT_FIRST_INDUSTRIAL_SCENE.md](EXPERIMENT_FIRST_INDUSTRIAL_SCENE.md) turns these references into a proposed single-assembly, 30-second inspection/cinematic test. Private learning, documented only; no scene execution or separate rights-review assignment requested in this scope.
