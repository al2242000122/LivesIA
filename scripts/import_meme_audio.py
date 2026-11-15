"""Import two pinned, short command clips as local data; never execute downloads."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import struct
import tempfile
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
MAX_BYTES = 1024 * 1024
MAX_SECONDS = 4
SOURCES = {
    "meme_67": {
        "url": "https://cdn.freesound.org/previews/832/832306_71257-lq.ogg",
        "page": "https://freesound.org/people/qubodup/sounds/832306/",
        "file": "meme_67.ogg", "format": "ogg", "size": 25047,
        "sha256": "7a512f8966d222f3afe581b49d3b849d0c3563b3033d76f944647c354638e245",
        "duration": 2.9721458333333333,
        "creator": "qubodup", "license": "CC0-1.0", "licenseVerified": True,
    },
    "meme_siuuu": {
        "url": "https://www.myinstants.com/media/sounds/suii_5nzN9PW.mp3",
        "page": "https://www.myinstants.com/en/instant/suii-24732/",
        "file": "meme_siuuu.mp3", "format": "mp3", "size": 29568,
        "sha256": "f1e71196f06be7f9dfb0927e2102e1c17d095ec6b692e994fabc662c8fe1a12d",
        "duration": 1.848,
        "creator": "SUII! uploaded by noface1; page identifies Cristiano Ronaldo",
        "license": "Unverified; public community clip, not asserted royalty-free",
        "licenseVerified": False,
    },
}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise urllib.error.HTTPError(request.full_url, code, "Redirects disabled", headers, response)


def source(name):
    if name not in SOURCES:
        raise ValueError("Only the two pinned command clips are allowed")
    return SOURCES[name]


def fetch(name):
    entry = source(name)
    request = urllib.request.Request(entry["url"], headers={
        "User-Agent": "Mozilla/5.0", "Referer": entry["page"],
    })
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=20) as response:
        if response.status != 200 or response.geturl() != entry["url"]:
            raise ValueError("Unexpected command audio response")
        body = response.read(MAX_BYTES + 1)
    validate_audio(name, body)
    return body


def ogg_duration(data):
    """Read complete Vorbis Ogg pages, with a finite ending sample position."""
    position = 0
    last_granule = 0
    packets = bytearray()
    while position < len(data):
        if len(data) - position < 27 or data[position:position + 5] != b"OggS\x00":
            raise ValueError("Invalid Ogg page")
        segments = data[position + 26]
        table_end = position + 27 + segments
        if table_end > len(data):
            raise ValueError("Truncated Ogg segment table")
        end = table_end + sum(data[position + 27:table_end])
        if end > len(data):
            raise ValueError("Truncated Ogg payload")
        if len(packets) < 128:
            packets.extend(data[table_end:min(end, table_end + 128 - len(packets))])
        granule = struct.unpack_from("<Q", data, position + 6)[0]
        if granule != (1 << 64) - 1:
            last_granule = granule
        position = end
    if packets[:7] != b"\x01vorbis" or len(packets) < 16:
        raise ValueError("Expected a Vorbis identification packet")
    sample_rate = struct.unpack_from("<I", packets, 12)[0]
    if sample_rate not in (22050, 44100, 48000):
        raise ValueError("Unsupported Vorbis sample rate")
    return last_granule / sample_rate


def mp3_duration(data):
    """Accept complete MPEG-1 Layer III frames, matching the pinned vocal clip."""
    position = 0
    duration = 0
    while position < len(data):
        if len(data) - position < 4:
            raise ValueError("Truncated MP3 frame")
        header = int.from_bytes(data[position:position + 4], "big")
        if header >> 21 != 0x7ff or (header >> 19) & 3 != 3 or (header >> 17) & 3 != 1:
            raise ValueError("Expected MPEG-1 Layer III audio")
        bitrate_index, rate_index = (header >> 12) & 15, (header >> 10) & 3
        if bitrate_index in (0, 15) or rate_index == 3:
            raise ValueError("Unsupported MP3 rate")
        bitrate = (0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320)[bitrate_index] * 1000
        rate = (44100, 48000, 32000)[rate_index]
        frame_size = 144 * bitrate // rate + ((header >> 9) & 1)
        position += frame_size
        if position > len(data):
            raise ValueError("Truncated MP3 payload")
        duration += 1152 / rate
    return duration


def validate_audio(name, data):
    entry = source(name)
    if not isinstance(data, bytes) or not 32 <= len(data) <= MAX_BYTES or len(data) != entry["size"]:
        raise ValueError("Command audio size mismatch")
    if hashlib.sha256(data).hexdigest() != entry["sha256"]:
        raise ValueError("Command audio SHA256 mismatch")
    duration = ogg_duration(data) if entry["format"] == "ogg" else mp3_duration(data)
    if not 0 < duration <= MAX_SECONDS or abs(duration - entry["duration"]) > .025:
        raise ValueError("Command audio duration mismatch")
    return duration


def install(destination=ROOT / "assets-local" / "minecraft-sounds"):
    destination = Path(destination)
    if destination.is_symlink():
        raise ValueError("Audio directory cannot be a symlink")
    destination.mkdir(parents=True, exist_ok=True)
    targets = [destination / entry["file"] for entry in SOURCES.values()]
    manifest = destination / "meme-audio-provenance.json"
    for path in [*targets, manifest]:
        if path.is_symlink():
            raise ValueError("Command audio path cannot be a symlink")
    if any(path.exists() for path in [*targets, manifest]):
        provenance = json.loads(manifest.read_text(encoding="utf-8"))
        if provenance != SOURCES:
            raise ValueError("Command audio provenance mismatch")
        for name, entry in SOURCES.items():
            validate_audio(name, (destination / entry["file"]).read_bytes())
        return provenance
    # Fetch and verify both clips before writing either final filename. Other
    # Minecraft sounds and their provenance remain untouched in this directory.
    bodies = {name: fetch(name) for name in SOURCES}
    for name, body in bodies.items():
        validate_audio(name, body)
    installed = []
    with tempfile.TemporaryDirectory(prefix=".meme-audio-", dir=destination) as staging:
        staging = Path(staging)
        try:
            for name, entry in SOURCES.items():
                temporary = staging / entry["file"]
                temporary.write_bytes(bodies[name])
                target = destination / entry["file"]
                temporary.replace(target)
                installed.append(target)
            temporary = staging / manifest.name
            temporary.write_text(json.dumps(SOURCES, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            temporary.replace(manifest)
        except Exception:
            for target in installed:
                target.unlink(missing_ok=True)
            raise
    return SOURCES


if __name__ == "__main__":
    installed = install()
    print(json.dumps({"clips": len(installed), "files": [v["file"] for v in installed.values()]}))
