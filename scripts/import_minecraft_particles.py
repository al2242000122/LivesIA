"""Import unmodified Minecraft explosion/smoke PNGs from the pinned client as data."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("minecraft_particle_source", Path(__file__).with_name("import_minecraft.py"))
MC = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(MC)
TEXTURES = {f"particle_explosion_{i}": f"assets/minecraft/textures/particle/explosion_{i}.png" for i in range(16)}
# smoke.json, large_smoke.json and poof.json all use generic_7..generic_0.
TEXTURES.update({f"particle_smoke_{i}": f"assets/minecraft/textures/particle/generic_{7-i}.png" for i in range(8)})
DIMENSIONS = {name: (32, 32) if "explosion" in name else (8, 8) for name in TEXTURES}
MC.SPRITE_DIMENSIONS.update(DIMENSIONS)


def verify_local(destination):
    destination = Path(destination)
    if destination.is_symlink():
        raise ValueError("Particle destination cannot be a symbolic link")
    provenance = json.loads((destination / "provenance.json").read_text(encoding="utf-8"))
    if provenance.get("clientSha1") != MC.PINNED["clientSha1"] or set(provenance.get("textures", {})) != set(TEXTURES):
        raise ValueError("Particle provenance does not match the pinned source and whitelist")
    for name in TEXTURES:
        data = (destination / (name + ".png")).read_bytes()
        entry = provenance["textures"][name]
        if entry.get("archivePath") != TEXTURES[name] or entry.get("sha256") != hashlib.sha256(data).hexdigest():
            raise ValueError("Particle texture checksum does not match")
        if MC.validate_png(data, name) != DIMENSIONS[name]:
            raise ValueError("Particle dimensions do not match the original layout")
    return {"status": "local-checksums-verified", "textures": len(TEXTURES)}


def install_archive(archive_path, destination):
    destination = Path(destination)
    if destination.exists() or destination.is_symlink():
        return verify_local(destination)
    MC.verify_file(archive_path, MC.PINNED["clientSha1"], MC.PINNED["clientSize"])
    images = {}
    with zipfile.ZipFile(archive_path) as archive:
        for name, path in TEXTURES.items():
            entries = [entry for entry in archive.infolist() if entry.filename == path]
            if len(entries) != 1 or entries[0].file_size > 65536 or entries[0].flag_bits & 1:
                raise ValueError("Invalid particle archive entry")
            data = archive.read(entries[0])
            if MC.validate_png(data, name) != DIMENSIONS[name]:
                raise ValueError("Invalid particle dimensions")
            images[name] = data
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".particles-", dir=destination.parent) as scratch:
        stage = Path(scratch) / "ready"
        stage.mkdir()
        provenance = {"version": MC.PINNED["version"], "clientUrl": MC.PINNED["clientUrl"],
                      "clientSha1": MC.PINNED["clientSha1"], "textures": {}}
        for name, data in images.items():
            (stage / (name + ".png")).write_bytes(data)
            provenance["textures"][name] = {"archivePath": TEXTURES[name], "sha256": hashlib.sha256(data).hexdigest(),
                                            "width": DIMENSIONS[name][0], "height": DIMENSIONS[name][1]}
        (stage / "provenance.json").write_text(json.dumps(provenance, indent=2), encoding="utf-8")
        os.replace(stage, destination)
    return {"status": "installed", "textures": len(TEXTURES)}


def main():
    local = ROOT / "assets-local"
    if local.is_symlink() or local.resolve().parent != ROOT:
        raise ValueError("Local assets must remain inside the repository")
    destination = local / "minecraft-particles"
    if destination.exists() or destination.is_symlink():
        return verify_local(destination)
    local.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".particle-download-", dir=local) as scratch:
        client = Path(scratch) / "client.jar"
        MC.download_file(MC.PINNED["clientUrl"], client, MC.PINNED["clientSha1"], MC.PINNED["clientSize"])
        return install_archive(client, destination)


if __name__ == "__main__":
    print(json.dumps(main()))
