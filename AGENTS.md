# SandForge

Browser-based code editor and sandbox environment.

## Tech Stack
- Frontend: React, TypeScript, Vite
- Styling: Tailwind CSS v4 (using explicit pixel-based spacing constants, configured via `@theme` in `index.css`)
- State Management: Zustand (`src/store/sandboxStore.ts`)

## Core Architecture
- **UI Components**: `Header`, `Toolbar`, `FileExplorer`, `Terminal`
- **Sandbox Engine**: 
  - Bundler: File resolution and bundling algorithms.
  - Executor: iframe orchestration, lifecycle management, and async log reporting.
- **Branding**: Centralized configuration in `constants.ts` (Name: "SandForge").

## Project-Specific Guidelines
- **Styling**: Maintain visual integrity matching original designs; avoid fluid rem-based spacing for structural layouts in favor of explicit pixel values.
- **Testing**: Prioritize accessible ARIA roles over CSS classes for RTL selectors. Integration tests must exercise real user flows against the unmocked Zustand store.
