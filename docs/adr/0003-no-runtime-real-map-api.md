# ADR 0003: No Runtime Real-Map API In V1

Status: accepted

Date: 2026-05-16

## Context

The source PDF frames V1 as a curated route-pack travel simulator. The core validation target is the backend loop: route start, online drive tick, forced stop, photo, offline Travel Report, claim, maintenance, route completion, and route unlock.

## Decision

V1 will not use Google Maps, real GPS navigation, real global map data, or a runtime real-map API. Routes are curated configuration: route definitions, route segments, landmarks, weather profiles, day-night profiles, background packs, rewards, and costs.

## Consequences

The client should render route progress and pixel-style backgrounds from backend route state, not from live map coordinates. The backend should validate route segment continuity and landmark distance within curated route configs. Any real-map integration is outside the 14-day playable spine.

