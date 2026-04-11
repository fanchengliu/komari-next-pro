# Komari Next Pro Theme

This directory contains the frontend theme module for Komari Next Pro.

## Overview

The theme focuses on improving the default Komari visual experience with a more dashboard-oriented layout, richer node presentation, and a better instance detail page structure.

## Highlights

- Modern homepage layout
- redesigned dashboard cards and node cards
- improved instance detail experience
- richer IP information display
- network quality presentation improvements
- compatibility with Komari theme-managed configuration
- optional integration with the `unlock-probe` backend

## Build

```bash
cd theme
npm install
npm run build
```

After building, deploy the generated theme assets together with `komari-theme.json` into your Komari theme directory.

## Notes

- This module can run independently without the backend.
- If `unlock-probe` is not deployed, stream unlock and some advanced card configuration features will not be available.
- Review `komari-theme.json` before release if you want to adjust theme name, short name, description, or managed settings.
