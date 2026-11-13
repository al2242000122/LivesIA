"""Import a pinned official client archive as data; never execute Java or JAR files."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import stat
import struct
import tempfile
from datetime import datetime, timezone
import urllib.error
import urllib.request
import zipfile
import zlib
from uuid import uuid4

ROOT = Path(__file__).resolve().parent.parent
PINNED = {
    "version": "26.3",
    "manifestUrl": "https://piston-meta.mojang.com/v1/packages/9f67e10ed013deeaad20ac3c800652765d493408/26.3.json",
    "manifestSha1": "9f67e10ed013deeaad20ac3c800652765d493408",
    "clientUrl": "https://piston-data.mojang.com/v1/objects/e877b6a07acd633fb3bb475002175cec036e7b87/client.jar",
    "clientSha1": "e877b6a07acd633fb3bb475002175cec036e7b87",
    "clientSize": 41483720,
}
BLOCKS = {
    "stone": "stone", "soil": "dirt", "coal": "coal_ore", "iron": "iron_ore",
    "gold": "gold_ore", "redstone": "redstone_ore", "lapis": "lapis_ore",
    "emerald": "emerald_ore", "diamond": "diamond_ore", "copper": "copper_ore",
    "granite": "granite", "diorite": "diorite", "andesite": "andesite",
    "moss": "mossy_cobblestone", "obsidian": "obsidian", "magma": "magma",
    "bedrock": "bedrock", "tnt": "tnt_side", "tnt_top": "tnt_top",
}
TOOLS = {
    "wood_pickaxe": "wooden_pickaxe", "stone_pickaxe": "stone_pickaxe",
    "gold_pickaxe": "golden_pickaxe", "diamond_pickaxe": "diamond_pickaxe",
    "netherite_pickaxe": "netherite_pickaxe",
}
TEXTURES = {key: f"assets/minecraft/textures/block/{name}.png" for key, name in BLOCKS.items()}
TEXTURES.update({key: f"assets/minecraft/textures/item/{name}.png" for key, name in TOOLS.items()})
LEGACY_TEXTURES = dict(TEXTURES)
TEXTURES.update({f"destroy_stage_{n}": f"assets/minecraft/textures/block/destroy_stage_{n}.png" for n in range(10)})
BASE_TEXTURES = dict(TEXTURES)
TEXTURES.update({
    "water": "assets/minecraft/textures/block/water_still.png",
    "ice": "assets/minecraft/textures/block/ice.png",
    "fire": "assets/minecraft/textures/block/fire_0.png",
    "arrow": "assets/minecraft/textures/item/arrow.png",
    "dispenser": "assets/minecraft/textures/block/dispenser_front.png",
    "creeper": "assets/minecraft/textures/entity/creeper/creeper.png",
    "rain": "assets/minecraft/textures/environment/rain.png",
})
SPRITE_DIMENSIONS = {"creeper": (64, 32), "rain": (64, 256)}
ASSET_LIMIT = 1024 * 1024
MANIFEST_LIMIT = 2 * 1024 * 1024
CHUNK_SIZE = 65536
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def validate_config(config):
    if not isinstance(config, dict) or set(config) != set(PINNED) | {"textures"}:
        raise ValueError("Configuration must contain only the pinned source and textures")
    if any(config[key] != value for key, value in PINNED.items()):
        raise ValueError("Source must match the official pinned Minecraft 26.3 metadata")
    if config["textures"] != TEXTURES:
        raise ValueError("Texture paths must match the exact 41-entry whitelist")
    return config


def file_hash(path, algorithm):
    digest = hashlib.new(algorithm)
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_file(path, expected_sha1, expected_size):
    path = Path(path)
    if path.is_symlink() or not path.is_file() or path.stat().st_size != expected_size:
        raise ValueError("Archive size or file type does not match")
    if file_hash(path, "sha1") != expected_sha1:
        raise ValueError("Archive SHA1 does not match")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise urllib.error.HTTPError(request.full_url, code, "Redirects are disabled", headers, response)


def download_file(url, destination, expected_sha1, expected_size=None):
    if url not in (PINNED["manifestUrl"], PINNED["clientUrl"]):
        raise ValueError("Only the two exact official pinned URLs are allowed")
    limit = PINNED["clientSize"] if url == PINNED["clientUrl"] else MANIFEST_LIMIT
    opener = urllib.request.build_opener(NoRedirect())
    request = urllib.request.Request(url, headers={"User-Agent": "LivesIA-local-assets/1.0"})
    digest, size = hashlib.sha1(), 0
    with opener.open(request, timeout=45) as response, Path(destination).open("xb") as output:
        if response.status != 200 or response.geturl() != url:
            raise ValueError("Unexpected response or source URL")
        length = response.headers.get("Content-Length")
        if length is not None and (not length.isdigit() or int(length) > limit or expected_size is not None and int(length) != expected_size):
            raise ValueError("Download Content-Length does not match")
        while True:
            chunk = response.read(CHUNK_SIZE)
            if not chunk:
                break
            size += len(chunk)
            if size > limit:
                raise ValueError("Download exceeds the size limit")
            output.write(chunk)
            digest.update(chunk)
    if digest.hexdigest() != expected_sha1 or expected_size is not None and size != expected_size:
        raise ValueError("Downloaded SHA1 or size does not match")


def validate_png(data, texture_name=None):
    if not isinstance(data, bytes) or len(data) > ASSET_LIMIT or not data.startswith(PNG_SIGNATURE):
        raise ValueError("Invalid PNG signature or size")
    offset, dimensions = len(PNG_SIGNATURE), None
    while offset < len(data):
        if len(data) - offset < 12:
            raise ValueError("Truncated PNG chunk")
        length = struct.unpack_from(">I", data, offset)[0]
        end = offset + 12 + length
        if end > len(data):
            raise ValueError("PNG chunk exceeds the file")
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + length]
        checksum = struct.unpack_from(">I", data, offset + 8 + length)[0]
        if zlib.crc32(kind + payload) & 0xffffffff != checksum:
            raise ValueError("PNG chunk CRC does not match")
        if dimensions is None:
            if kind != b"IHDR" or length != 13:
                raise ValueError("PNG must begin with IHDR")
            width, height = struct.unpack_from(">II", payload)
            fixed = SPRITE_DIMENSIONS.get(texture_name)
            if fixed is not None and (width, height) != fixed:
                raise ValueError("Sprite dimensions do not match its exact allowlisted layout")
            if fixed is None and (width != 16 or height < 16 or height > 1024 or height % 16):
                raise ValueError("PNG must be 16 pixels wide with 16..1024-pixel frame-strip height")
            dimensions = (width, height)
        if kind == b"IEND":
            if length or end != len(data):
                raise ValueError("Invalid PNG IEND or trailing data")
            return dimensions
        offset = end
    raise ValueError("PNG is missing IEND")


def install_archive(archive_path, config, destination):
    """Verify before opening ZIP; install into a new directory without replacing old data."""
    texture_paths = config["textures"]
    if texture_paths not in (TEXTURES, BASE_TEXTURES, LEGACY_TEXTURES):
        raise ValueError("Texture whitelist does not match")
    destination = Path(destination)
    if destination.exists() or destination.is_symlink():
        raise FileExistsError("Destination already exists; no files were replaced")
    verify_file(archive_path, config["clientSha1"], config["clientSize"])
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".minecraft-extract-", dir=destination.parent) as scratch:
        stage = Path(scratch) / "minecraft"
        stage.mkdir()
        inventory = {}
        with zipfile.ZipFile(archive_path) as archive:
            by_name = {}
            for info in archive.infolist():
                if info.filename in texture_paths.values():
                    if info.filename in by_name:
                        raise ValueError("Duplicate allowlisted ZIP entry")
                    by_name[info.filename] = info
            for key, archive_path in texture_paths.items():
                info = by_name.get(archive_path)
                if info is None or info.is_dir() or info.file_size > ASSET_LIMIT or info.flag_bits & 1:
                    raise ValueError("Missing, oversized or encrypted allowlisted ZIP entry")
                if stat.S_ISLNK(info.external_attr >> 16):
                    raise ValueError("ZIP symlinks are not allowed")
                # read() verifies the complete entry CRC; extract()/extractall() are never used.
                data = archive.read(info)
                width, height = validate_png(data, key)
                filename = key + ".png"
                (stage / filename).write_bytes(data)
                inventory[key] = {"archivePath": archive_path, "file": filename, "sha256": hashlib.sha256(data).hexdigest(),
                                  "size": len(data), "width": width, "height": height}
        provenance = {"schemaVersion": 1, **{key: config[key] for key in PINNED},
                      "importedAt": datetime.now(timezone.utc).isoformat(), "textures": inventory}
        (stage / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
        if destination.exists() or destination.is_symlink():
            raise FileExistsError("Destination appeared during import; no files were replaced")
        os.rename(stage, destination)
    return provenance


def verify_installed(destination, config, allow_legacy=False):
    destination = Path(destination)
    if destination.is_symlink() or not destination.is_dir():
        raise ValueError("Existing assets must be a local directory")
    provenance_path = destination / "provenance.json"
    if provenance_path.is_symlink() or provenance_path.stat().st_size > ASSET_LIMIT:
        raise ValueError("Invalid local provenance file")
    provenance = json.loads(provenance_path.read_text(encoding="utf-8"))
    if not isinstance(provenance, dict) or provenance.get("schemaVersion") != 1 or any(provenance.get(key) != config[key] for key in PINNED):
        raise ValueError("Existing provenance does not match the pinned source")
    inventory = provenance.get("textures")
    if not isinstance(inventory, dict):
        raise ValueError("Existing provenance inventory does not match")
    texture_paths = TEXTURES
    if allow_legacy:
        for previous in (LEGACY_TEXTURES, BASE_TEXTURES):
            if set(inventory) == set(previous):
                texture_paths = previous
    if set(inventory) != set(texture_paths):
        raise ValueError("Existing provenance inventory does not match")
    names = {key + ".png" for key in texture_paths} | {"provenance.json"}
    if {path.name for path in destination.iterdir()} != names:
        raise ValueError("Existing asset directory has missing or unexpected files")
    for key, archive_path in texture_paths.items():
        entry = inventory[key]
        path = destination / (key + ".png")
        if not isinstance(entry, dict) or path.is_symlink() or not path.is_file() or path.stat().st_size > ASSET_LIMIT:
            raise ValueError("Invalid local asset entry")
        data = path.read_bytes()
        width, height = validate_png(data, key)
        expected = {"archivePath": archive_path, "file": key + ".png", "sha256": hashlib.sha256(data).hexdigest(),
                    "size": len(data), "width": width, "height": height}
        if entry != expected:
            raise ValueError("Local asset checksum or provenance does not match")
    return provenance


def upgrade_archive(archive_path, config, destination):
    """Keep verified old assets until the complete replacement is ready; retain a backup."""
    destination = Path(destination)
    old = verify_installed(destination, config, allow_legacy=True)
    if set(old["textures"]) not in (set(LEGACY_TEXTURES), set(BASE_TEXTURES)) or config["textures"] != TEXTURES:
        raise ValueError("Upgrade requires the previous 24 or 34 assets and new 41-entry whitelist")
    parent = destination.parent.resolve()
    if destination.is_symlink() or destination.resolve().parent != parent:
        raise ValueError("Upgrade target must be a direct local directory")
    with tempfile.TemporaryDirectory(prefix=".minecraft-upgrade-", dir=parent) as scratch:
        replacement = Path(scratch) / "replacement"
        provenance = install_archive(archive_path, config, replacement)
        verify_installed(replacement, config)
        # Verify again after download/extraction, immediately before moving the old installation.
        if verify_installed(destination, config, allow_legacy=True) != old:
            raise ValueError("Previous installation changed during upgrade")
        backup = parent / ("minecraft-backup-" + uuid4().hex)
        if backup.parent != parent or backup.exists() or backup.is_symlink():
            raise ValueError("Invalid backup target")
        os.rename(destination, backup)
        try:
            os.rename(replacement, destination)
        except OSError as error:
            if destination.exists() or destination.is_symlink():
                raise OSError(f"Replacement blocked; previous files preserved in {backup.name}") from error
            try:
                os.rename(backup, destination)
            except OSError as restore_error:
                raise OSError(f"Restore blocked; previous files preserved in {backup.name}") from restore_error
            raise
    return provenance, backup


def import_assets(config, destination):
    """Called only after main validates the pinned configuration; injectable downloads in tests."""
    destination = Path(destination)
    upgrade = destination.exists() or destination.is_symlink()
    if upgrade:
        provenance = verify_installed(destination, config, allow_legacy=True)
        if set(provenance["textures"]) == set(TEXTURES):
            return provenance, "local-checksums-verified", None
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".minecraft-download-", dir=destination.parent) as scratch:
        manifest_path, client_path = Path(scratch) / "manifest.json", Path(scratch) / "client.jar"
        download_file(config["manifestUrl"], manifest_path, config["manifestSha1"])
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        client = manifest.get("downloads", {}).get("client", {})
        if manifest.get("id") != config["version"] or any(client.get(key) != config[field] for key, field in [("url", "clientUrl"), ("sha1", "clientSha1"), ("size", "clientSize")]):
            raise ValueError("Official version manifest does not match the pinned client")
        download_file(config["clientUrl"], client_path, config["clientSha1"], config["clientSize"])
        if upgrade:
            provenance, backup = upgrade_archive(client_path, config, destination)
            return provenance, "upgraded-and-verified", backup
        provenance = install_archive(client_path, config, destination)
        return provenance, "downloaded-and-verified", None


def main():
    config = validate_config(json.loads((ROOT / "configs/minecraft-assets.json").read_text(encoding="utf-8")))
    local_root = ROOT / "assets-local"
    if local_root.is_symlink() or local_root.resolve().parent != ROOT:
        raise ValueError("Local assets must remain inside the repository")
    local_root.mkdir(exist_ok=True)
    provenance, status, backup = import_assets(config, local_root / "minecraft")
    print(json.dumps({"version": provenance["version"], "files": len(provenance["textures"]), "clientSha1": provenance["clientSha1"],
                      "clientSize": provenance["clientSize"], "output": "assets-local/minecraft", "status": status,
                      "backup": backup.name if backup else None}))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, zipfile.BadZipFile, urllib.error.URLError) as error:
        raise SystemExit("Minecraft import failed: " + str(error)) from None
