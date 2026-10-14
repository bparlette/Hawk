// probe boot (course design only; not shipped)
function resizeP() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); RT.setSize(w, h); POST.uniforms.uRes.value.set(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
applyQuality(true); resizeP();
HF.build();
window.__probe = { HF, LANDMARKS, PIERS, BASIN, WB, BLD, LMHD: LMHD.list.map((L) => [L.id, L.cx, L.cz, L.r]), map: () => HF.debugCanvas().toDataURL('image/png'), camera, draw, THREE, scene, renderer };
camera.position.set(-40, 30, 10); camera.lookAt(20, 0, -20); draw();
