"""Download two pinned Minecraft mod textures as data, never executable mods."""
from __future__ import annotations

import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
PACK_URL = "https://minecraught.com/static/nuke/nuke-pack.zip"
PACK_HASH = "cb53b79fa51bad88530979b81d793b13dbc7e6e5060a2fb196b14a187c55b8e4"
HBM_COMMIT = "d4708ef9c32418b8fdc4758d5d427ae9d99bd97a"
ROCKET_URL = ("https://raw.githubusercontent.com/HbmMods/Hbm-s-Nuclear-Tech-GIT/"
              + HBM_COMMIT + "/src/main/resources/assets/hbm/textures/items/ammo_arty_nuke.png")
PINS = {
    "nuke_like": "3530ae91ccb42de14b5150b22492a187e1d5b413c885738f92c47981afedea0d",
    "nuke_subscriber": "f4702a181930cefeac16bbadcdbe91fc3b972428e6841811f82ec30f3722f902",
}
LIMIT = 4 * 1024 * 1024


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Resource redirects are not allowed")


def download(url):
    if url not in (PACK_URL, ROCKET_URL):
        raise ValueError("Only pinned resource URLs are allowed")
    request = urllib.request.Request(url, headers={"User-Agent": "LivesIA-local-resource-import"})
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=20) as response:
        data = response.read(LIMIT + 1)
    if len(data) > LIMIT:
        raise ValueError("Resource exceeds the size limit")
    return data


def validate_image(name, data):
    if name not in PINS or hashlib.sha256(data).hexdigest() != PINS[name]:
        raise ValueError("Texture SHA256 does not match the pinned original")
    spec = importlib.util.spec_from_file_location("minecraft_png_validator", Path(__file__).with_name("import_minecraft.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if module.validate_png(data) != (16, 16):
        raise ValueError("Nuclear textures must be exactly 16x16")


def decode_resources(pack, rocket):
    if len(pack) > LIMIT or hashlib.sha256(pack).hexdigest() != PACK_HASH:
        raise ValueError("Resource-pack SHA256 does not match the pinned download")
    member = "assets/nuke/textures/block/nuke_side.png"
    with zipfile.ZipFile(io.BytesIO(pack)) as archive:
        matches = [entry for entry in archive.infolist() if entry.filename == member]
        if len(matches) != 1 or matches[0].file_size > 65536 or matches[0].flag_bits & 1:
            raise ValueError("Invalid nuclear texture entry")
        # No extractall: no archive paths, audio or code are ever installed.
        like = archive.read(matches[0])
    assets = {"nuke_like": like, "nuke_subscriber": rocket}
    for name, data in assets.items():
        validate_image(name, data)
    return assets


def install(destination, fetch=download):
    destination = Path(destination)
    if destination.is_symlink():
        raise ValueError("Resource destination must not be a symbolic link")
    if destination.exists():
        for name in PINS:
            validate_image(name, (destination / (name + ".png")).read_bytes())
        return {"status": "local-checksums-verified", "textures": list(PINS)}
    assets = decode_resources(fetch(PACK_URL), fetch(ROCKET_URL))
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".nukes-", dir=destination.parent) as work:
        stage = Path(work) / "textures"
        stage.mkdir()
        for name, data in assets.items():
            (stage / (name + ".png")).write_bytes(data)
        provenance = {
            "packUrl": PACK_URL, "packSha256": PACK_HASH, "hbmCommit": HBM_COMMIT,
            "textures": {
                "nuke_like": {"url": PACK_URL, "archivePath": "assets/nuke/textures/block/nuke_side.png", "license": "MIT (upstream project declaration)"},
                "nuke_subscriber": {"url": ROCKET_URL, "license": "LGPL-3.0 (upstream README; LICENSE and LICENSE.LESSER)"},
            },
        }
        for name in PINS:
            provenance["textures"][name].update(sha256=PINS[name], width=16, height=16)
        (stage / "provenance.json").write_text(json.dumps(provenance, indent=2), encoding="utf-8")
        (stage / "NOTICE.txt").write_text(
            "Unmodified local resource copies. Not official vanilla Minecraft nukes.\n"
            "LIKE: Minecraught Nuke resource pack, declared MIT at https://modrinth.com/mod/minecraught-nuke\n"
            "SUB: HbmMods/Hbm-s-Nuclear-Tech-GIT, LGPL-3.0 per README.\n"
            "Copyright remains with the upstream authors. Full source and licenses:\n"
            "https://github.com/HbmMods/Hbm-s-Nuclear-Tech-GIT/tree/" + HBM_COMMIT + "\n"
            "https://github.com/HbmMods/Hbm-s-Nuclear-Tech-GIT/blob/" + HBM_COMMIT + "/LICENSE\n"
            "https://github.com/HbmMods/Hbm-s-Nuclear-Tech-GIT/blob/" + HBM_COMMIT + "/LICENSE.LESSER\n"
            "No texture modifications; render transforms are performed by the application.\n", encoding="utf-8")
        os.replace(stage, destination)
    return {"status": "installed", "textures": list(PINS)}


if __name__ == "__main__":
    print(json.dumps(install(ROOT / "assets-local" / "nukes")))
