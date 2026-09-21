# Offline globe data / 地图数据来源

The globe renderer, selection and monitoring logic are independently written for komari-ds. The following generic geographic databases retain their own licenses. No third-party Komari theme source is included.

- `land.json`: simplified coastline coordinates and sampled land points derived from [World Atlas 2](https://github.com/topojson/world-atlas) `land-110m.json`, based on [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) public-domain geography. World Atlas conversion/distribution license: ISC; full text in `ISC-world-atlas.txt`. Conversion samples the land shape for the globe's dot rendering; it does not contain node data.
- `region-centers.json`: ISO alpha-2 identifiers and approximate latitude/longitude extracted from the [mledoze/countries](https://github.com/mledoze/countries) database, retrieved 2026-09-20. This derived database is made available under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/), full text in `ODbL-country-centers.txt`. The standalone JSON is included alongside this notice in the theme's `dist/geodata/` and the source package, without additional restrictions on that database.

The packaged data is used offline. Locations are approximate region centers and do not identify data centers or exact server locations. Region labels use the browser's locale data. Flags are from flag-icons; see THIRD_PARTY_NOTICES.md.
