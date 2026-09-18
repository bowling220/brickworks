# BRICKWORKS Home - Project Guide

## Overview
BRICKWORKS Home is an interactive 3D web application and game launcher menu built with Next.js 16 (App Router), Vinext, React 19, Tailwind CSS v4, and Three.js (via React Three Fiber & Drei).

## Tech Stack
- **Framework:** Next.js 16 (App Router) powered by Vinext / Vite
- **UI & Styling:** React 19, Tailwind CSS v4, Lucide React icons, Radix UI primitives
- **3D Graphics:** Three.js, `@react-three/fiber`, `@react-three/drei`
- **Database & Backend (Optional):** Drizzle ORM, Cloudflare D1 / Workers runtime

## Directory Structure
- `app/` - Next.js App Router root
  - `page.tsx` - Main menu landing page (Play button, Settings dialog, Account, 3D views)
  - `layout.tsx` - HTML document shell and metadata
  - `globals.css` - Tailwind CSS imports, animations, glassmorphism UI styles
- `components/brickworks/` - 3D scenes and brand components
  - `BrickworksLogo3D.tsx` - 3D extruded BRICKWORKS logo with LEGO-style studs and lighting
  - `SkyScene.tsx` - Dynamic animated sky background with clouds and lighting
- `components/ui/` - Reusable UI component library (dialog, switch, buttons, etc.)
- `scripts/` - Framework execution and runtime scripts

## Development Workflows
- **Start Dev Server:** `npm run dev` (starts Vinext on `http://localhost:5173`)
- **Build Project:** `npm run build`
- **Lint Code:** `npm run lint`

## Guidelines for Antigravity Agents
1. When modifying 3D components (`BrickworksLogo3D.tsx`, `SkyScene.tsx`), ensure proper resource disposal (`geometry.dispose()`, `material.dispose()`) to prevent WebGL memory leaks.
2. Maintain accessibility: keep screen-reader text (`sr-only`) and fallbacks for environments without WebGL support.
3. Keep Client Components marked with `"use client"` when using React hooks or window/document APIs.
