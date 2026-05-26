# src

This is the maintainable frontend source for `komari-liu`.

- `src/assets/js/config.js`: runtime config defaults.
- `src/assets/js/core/`: shared browser helpers.
- `src/assets/js/modules/`: feature modules.
- `src/assets/css/`: source CSS modules.

`theme/public/` is generated output. Do not treat `theme/public/assets` as the primary source; run:

```bash
python3 tools/build.py
```

The build copies `src/assets` into `theme/public/assets` and generates `theme/public/index.html` from the offline baseline.
