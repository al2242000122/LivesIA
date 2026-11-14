"""Download only allowlisted official sound data; never execute a Minecraft client."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import urllib.error
import urllib.request
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
PINNED = {
    "version": "26.3",
    "manifestUrl": "https://piston-meta.mojang.com/v1/packages/9f67e10ed013deeaad20ac3c800652765d493408/26.3.json",
    "manifestSha1": "9f67e10ed013deeaad20ac3c800652765d493408",
    "assetIndexUrl": "https://piston-meta.mojang.com/v1/packages/e99f9973047785b5a9d52eaf72020b97545053c9/34.json",
    "assetIndexSha1": "e99f9973047785b5a9d52eaf72020b97545053c9",
    "assetIndexSize": 597235,
}
SOUNDS = {
    "mine": "dig/stone1", "mine2": "dig/stone2", "mine3": "dig/stone3",
    "fuse": "random/fuse", "explode": "random/explode1", "explode2": "random/explode2",
    "explode3": "random/explode3", "thunder": "ambient/weather/thunder1",
    "rain": "ambient/weather/rain1", "fire": "fire/fire", "splash": "liquid/splash",
    "bow": "random/bow", "bowhit": "random/bowhit1", "levelup": "random/levelup",
    "orb": "random/orb", "anvil": "random/anvil_land", "portal": "portal/trigger",
    "dragon": "mob/enderdragon/growl1", "elytra": "item/elytra/elytra_loop",
    "riptide": "item/trident/riptide1", "creeper": "mob/creeper/say1",
    "break": "random/break",
}
SOUNDS = {key: "minecraft/sounds/" + path + ".ogg" for key, path in SOUNDS.items()}
CONFIG = {**PINNED, "sounds": SOUNDS}
MAX_JSON = 2 * 1024 * 1024
MAX_SOUND = 2 * 1024 * 1024


def validate_config(config):
    if config != CONFIG:
        raise ValueError("Sound configuration must match the pinned official source and allowlist")
    return config


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise urllib.error.HTTPError(request.full_url, code, "Redirects disabled", headers, response)


def fetch(url, sha1, limit, size=None):
    official = url in (PINNED["manifestUrl"], PINNED["assetIndexUrl"])
    resource = re.fullmatch(r"https://resources\.download\.minecraft\.net/([a-f0-9]{2})/([a-f0-9]{40})", url)
    if not official and not (resource and resource[1] == sha1[:2] and resource[2] == sha1):
        raise ValueError("Only exact pinned metadata and hash-addressed official sound objects are allowed")
    opener = urllib.request.build_opener(NoRedirect())
    request = urllib.request.Request(url, headers={"User-Agent": "LivesIA-local-sounds/1.0"})
    with opener.open(request, timeout=30) as response:
        if response.status != 200 or response.geturl() != url:
            raise ValueError("Unexpected sound response")
        body = response.read(limit + 1)
    if len(body) > limit or size is not None and len(body) != size or hashlib.sha1(body).hexdigest() != sha1:
        raise ValueError("Resource size or SHA1 mismatch")
    return body


def validate_sound(data, sha1, size):
    if not isinstance(data, bytes) or not 20 <= len(data) <= MAX_SOUND or len(data) != size:
        raise ValueError("Invalid sound size")
    if not data.startswith(b"OggS") or b"vorbis" not in data[:128]:
        raise ValueError("Expected an Ogg Vorbis sound")
    if hashlib.sha1(data).hexdigest() != sha1:
        raise ValueError("Sound SHA1 mismatch")


def verify_installed(destination, config):
    validate_config(config)
    destination = Path(destination)
    if destination.is_symlink():
        raise ValueError("Sound directory cannot be a symlink")
    provenance = json.loads((destination / "provenance.json").read_text(encoding="utf-8"))
    if any(provenance.get(key) != value for key, value in PINNED.items()) or set(provenance.get("sounds", {})) != set(SOUNDS):
        raise ValueError("Installed sound inventory mismatch")
    for key, source in SOUNDS.items():
        entry = provenance["sounds"][key]
        target = destination / (key + ".ogg")
        if target.is_symlink() or entry.get("source") != source or entry.get("file") != target.name or not target.is_file() or target.stat().st_size > MAX_SOUND:
            raise ValueError("Installed sound path mismatch")
        validate_sound(target.read_bytes(), entry["sha1"], entry["size"])
    return provenance


def install(destination):
    destination = Path(destination)
    if destination.exists() or destination.is_symlink():
        return verify_installed(destination, CONFIG)
    manifest = json.loads(fetch(PINNED["manifestUrl"], PINNED["manifestSha1"], MAX_JSON))
    index = manifest.get("assetIndex", {})
    if (index.get("url"), index.get("sha1"), index.get("size")) != (PINNED["assetIndexUrl"], PINNED["assetIndexSha1"], PINNED["assetIndexSize"]):
        raise ValueError("Asset index does not match pinned metadata")
    objects = json.loads(fetch(index["url"], index["sha1"], MAX_JSON, index["size"]))["objects"]
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".minecraft-sounds-", dir=destination.parent) as scratch:
        stage = Path(scratch) / "sounds"
        stage.mkdir()
        inventory = {}
        for key, source in SOUNDS.items():
            entry = objects[source]
            sha1, size = entry["hash"], entry["size"]
            if not isinstance(sha1, str) or not re.fullmatch("[a-f0-9]{40}", sha1) or not isinstance(size, int) or not 20 <= size <= MAX_SOUND:
                raise ValueError("Invalid sound object metadata")
            data = fetch(f"https://resources.download.minecraft.net/{sha1[:2]}/{sha1}", sha1, MAX_SOUND, size)
            validate_sound(data, sha1, size)
            filename = key + ".ogg"
            (stage / filename).write_bytes(data)
            inventory[key] = {"source": source, "file": filename, "sha1": sha1, "size": size}
        provenance = {**PINNED, "sounds": inventory, "importedAt": datetime.now(timezone.utc).isoformat()}
        (stage / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
        if destination.exists() or destination.is_symlink():
            raise FileExistsError("Destination appeared; no existing files replaced")
        os.rename(stage, destination)
    return provenance


if __name__ == "__main__":
    validate_config(json.loads((ROOT / "configs/minecraft-sounds.json").read_text(encoding="utf-8")))
    result = install(ROOT / "assets-local/minecraft-sounds")
    print(json.dumps({"status": "verified-local-sounds", "version": result["version"], "count": len(result["sounds"])}))
