# UN Crisis Monitor - Project Overview & Goals

## Project Description
The UN Crisis Monitor is a web-based visualization tool designed to help the United Nations and associated humanitarian organizations analyze, compare, and revise budget allocations for global crises. It aggregates data from multiple sources (INFORM severity index, FTS overall funding, and CBPF cluster allocations) to provide a comprehensive view of humanitarian needs versus funding realities.

## Core Objectives
1. **Data Aggregation & Unification**: Combine disparate datasets (severity, overall funding, specific cluster allocations) into a unified model that allows for cross-referencing and deeper insights.
2. **Visualizing the Funding Gap**: Highlight discrepancies between required funding and actual funding, especially in regions with high severity indices.
3. **Interactive Globe Visualization**: Provide a 3D globe interface that visually represents crisis severity (via epicenter-esque glows) and funding allocations (via spikes), allowing users to intuitively grasp the global humanitarian landscape.
4. **Actionable Insights for Budget Revising**: Present data in a way that makes sense for budget reallocation, such as comparing cost per person targeted vs. reached, and identifying underfunded but highly severe crises.

## Architecture & Historical Data Readiness
The application is designed with an architecture that supports historical data analysis. The core data types (`InformSeverity`, `OverallFunding`, `CrisisAllocation`, `UnifiedCountryData`, `GlobalStats`) have been extended to support historical records (e.g., via `year` fields and `historicalData` maps). This allows future implementations to load past datasets (like historical INFORM or FTS) and visualize trends over time, enabling users to see if funding gaps are widening or narrowing, and if severity is increasing or decreasing.

## Key Features
- **3D Globe**: Built with Three.js/React Three Fiber. Features epicenter-style severity glows and budget spikes.
- **Sidebar Analytics**: Displays aggregated statistics, crisis details, and country-specific data.
- **Recharts Integration**: Includes charts for comparing CBPF funding vs. people reached/targeted, and funding gaps by country.
- **Responsive Design**: Built with Tailwind CSS and shadcn/ui components for a modern, accessible interface.

## Future Roadmap
- Implement a timeline slider to scrub through historical data.
- Add predictive modeling based on historical trends.
- Integrate real-time data feeds from UN APIs.
