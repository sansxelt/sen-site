# Geography view

MapLibre GL JS 5.6.1, distributed locally under BSD-3-Clause (LICENSE.txt).
Vector roads, buildings, water and labels: OpenFreeMap, based on OpenStreetMap under ODbL. Attribution remains visible in the map.
Elevation: public Tilezen Terrarium tiles hosted in the AWS Open Data elevation-tiles-prod bucket. The attribution link identifies contributing USGS, SRTM and other datasets and their individual terms: https://github.com/tilezen/joerd/blob/master/docs/attribution.md.

This is a geographic reference view centered on Yosemite Valley. It is not satellite imagery or live tracking. Fictional North Ridge contacts are never placed on this map. Map requests go directly to these public providers only after the visitor selects Geography; no account, contact or mission data is transmitted. The homepage video remains a local prerecorded replay and loads no map engine or external map data.

2D and 3D use the same vector source and MapLibre renderer. 3D adds real elevation and building extrusions where available. No Waze or Google Maps data is used. External tile availability is required; the original simulation and fallback remain available offline. Rendering is event-driven rather than a continuous animated globe.
