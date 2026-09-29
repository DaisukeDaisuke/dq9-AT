# Deployment checkpoint
## Public deployment succeeded
2026-09-29T10:37Z: commitd9ee0b52b1b3500bef70b224ec327d1b54ee40f4, Actionsrun36556131763 SUCCESS (Ubuntu26.04,configure-pages@v5). Owner enabledPages. Public URL https://daisukedaisuke.github.io/dq9-AT/ returnedHTTP200,text/html. Publicwasm fetched and successfully instantiated as WebAssembly.Module, exportsmemory/obg_decode/tiles_decode/blit/__heap_base. Browser UI interaction was not performed, per protocol.
A subsequent combinedmap+ATWASM build succeeded inCodespace (2384bytes); not yet the deployed version at this checkpoint.

## Verified Actions result
2026-09-29T10:23Z: run36554505620, commit900f6e9f21594eacad1677156073de79b7bcb2bc. Build job109360307614 SUCCEEDED including clang/lld build and upload-pages-artifact (artifact11025832681). Deploy job109360470529 FAILED404, log explicitly says ensure GitHub Pages is enabled. This is not a WASM build failure. Site not yet published.

## Build
Codespace potential-fishstick-jjwvw95499j2p665, /workspaces/dq9-AT. clang18.1.3 + lld18. scripts/build.sh successfully built real standalone WebAssembly (1606bytes). Same binary copied back and executed on the user's actual ROM;418images/283composites succeeded.
## GitHub Actions
.github/workflows/pages.yml builds wasm/map_render.c and uploads only web/ via official Pages actions. No ROM/state/extracted-image artifacts are included. No tests/sanitizers/browser automation are part of this workflow.
## Initial Pages setting (currently blocked)
2026-09-29T10:08Z: Codespace login shell can read/push repository using existing credentials. GET Pages returned404. POST /repos/DaisukeDaisuke/dq9-AT/pages with build_type=workflow returned403 Resource not accessible by integration. Current Codespace integration lacks permission for initial Pages site settings. Repository itself remains PRIVATE; never change repo visibility as a workaround.
GitHub's create-site endpoint requires Pages write AND Administration write for fine-grained credentials. Therefore one-time owner action in repository Settings > Pages > Build and deployment > Source: GitHub Actions may be required. This is a concrete returned authorization error, not an invented safety approval step.
Pending: final source push, Actions build result, and live site HTTP/WASM retrieval. Do not claim GitHub Pages is already deployed.
