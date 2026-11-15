# Proposal — participant five-section content-first architecture (15.11.2026)

## Problem and owner decision

The participant's existing navigation is correctly grouped under **Развитие**, **Практика**, **Результаты**, **Сообщество**, **Дополнительно** (plus independent **Главная**), but the inner pages still differ in density, hierarchy and the number of equally prominent actions. The owner requests a mature Apple-like minimalist interface without sacrificing any currently available function, with meaningful subdivisions rather than an enormous flat navigation.

The owner also explicitly requested all accepted changes to be pushed to main rather than abandoned in draft pull requests. This change delivers a **design-only SDD directly to main**; UI implementation and deployment remain separate, tested scopes. PR #203 was already merged as main commit 024a732d, removing three redundant KPIs from the new participant home.

## Goal

Make the content of each of the five sections understandable at a glance (current state, one next action, relevant objects), keep important controls one or two deliberate actions away, and disclose details in local tabs / lists / inspectors, not dozens of prominent cards. Preserve all authorized routes, statuses, evidence, permissions, legacy deep links, optional trajectory behavior, independent review, and user work history.

## Existing authoritative contracts

- frontend/src/features/calm-navigation/model.ts: groups and server-filtered original route indexes.
- frontend/src/App.tsx: rendering via /workspace/:section, query parameters and role-aware surfaces.
- openspec/changes/impulse-apple-app-experience-20261114/docs/navigation-overlay-v4.md: navigation closed by default; overlay, not a permanent reserved desktop sidebar.
- openspec/changes/impulse-ecosystem/docs/visual-reference-catalog.md: R-PAR-01…12.
- Owner's visual reference screens and approved topbar control set override older illustrative Apple-like examples.

## Scope

Detailed content and interaction specification of the five participant groups, navigation/disclosure, 320–1920px responsive grids, white/navy/graphite appearance targets, empty/stale/permission states and E2E acceptance. No product runtime, backend, API, persistence, financial rules, or deployment changes in this specification commit.

## Dependencies and non-goals

This is additive to, and does not edit, the active impulse-apple-app-experience-20261114 change owned by a parallel claim. The precise screen-to-image pixel acceptance is a separate owner/reference review. Inspiration from Apple HIG means interaction and hierarchy patterns, not copying Apple proprietary code, fonts, visual assets or trademarks.

## Acceptance of specification

All five page blueprints have routes, subsection ordering, first fold, primary CTA, secondary controls, data/state dependencies, mobile handling and end-to-end scenarios. Independent reviewer must approve and actual browser tests must be green on the eventual implementation revision. Unverified mock functions are never represented as implemented.
