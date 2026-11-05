#!/usr/bin/env python3
"""Strip metadata tags from image, audio and video files, in place, without re-encoding.

    python3 tools/strip_metadata.py <files...>     # strip these files
    python3 tools/strip_metadata.py --repo         # every tracked media file
    python3 tools/strip_metadata.py --check ...    # only list what would change

What goes: PNG text/EXIF/time chunks, JPEG EXIF/XMP/IPTC/comment segments, WebP EXIF/XMP chunks,
GIF comment and non-looping application blocks, SVG editor metadata (Inkscape, Sodipodi, RDF),
the Ogg Vorbis/Opus comment header (vendor string and every tag; the audio packets are copied
byte for byte) and MP4 metadata plus the encoder's H.264 SEI note (ffmpeg stream copy). Pixels, colour profiles and audio data
are untouched, so nothing looks or sounds different. site/test/unit/anonymity.test.js checks it.
"""
import re
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEDIA = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".ogg", ".oga", ".opus", ".mp4", ".m4a", ".mov"}


def strip_png(d: bytes) -> bytes:
    out, p = [d[:8]], 8
    while p + 8 <= len(d):
        length = struct.unpack(">I", d[p:p + 4])[0]
        kind = d[p + 4:p + 8]
        if kind not in (b"tEXt", b"zTXt", b"iTXt", b"eXIf", b"tIME"):
            out.append(d[p:p + 12 + length])
        p += 12 + length
        if kind == b"IEND":
            break
    return b"".join(out)


def strip_jpeg(d: bytes) -> bytes:
    out, p = [d[:2]], 2
    while p + 4 <= len(d):
        marker = d[p + 1]
        if marker in (0xDA, 0xD9):  # image data: copy the rest as is
            out.append(d[p:])
            break
        length = struct.unpack(">H", d[p + 2:p + 4])[0]
        keep = not (marker == 0xFE or (0xE0 <= marker <= 0xEF and marker not in (0xE0, 0xE2, 0xEE)))
        if keep:
            out.append(d[p:p + 2 + length])
        p += 2 + length
    return b"".join(out)


def strip_webp(d: bytes) -> bytes:
    if d[:4] != b"RIFF" or d[8:12] != b"WEBP":
        return d
    chunks, p, end = [], 12, 8 + struct.unpack("<I", d[4:8])[0]
    while p + 8 <= end:
        size = struct.unpack("<I", d[p + 4:p + 8])[0]
        chunk = d[p:p + 8 + size + (size & 1)]
        if chunk[:4] == b"VP8X":  # clear the EXIF (0x08) and XMP (0x04) flags
            chunk = chunk[:8] + bytes([chunk[8] & ~0x0C]) + chunk[9:]
        if chunk[:4] not in (b"EXIF", b"XMP "):
            chunks.append(chunk)
        p += 8 + size + (size & 1)
    body = b"WEBP" + b"".join(chunks)
    return b"RIFF" + struct.pack("<I", len(body)) + body


def strip_gif(d: bytes) -> bytes:
    p = 13
    if d[10] & 0x80:
        p += 3 << ((d[10] & 7) + 1)
    out = [d[:p]]

    def sub_end(q: int) -> int:
        while d[q] != 0:
            q += d[q] + 1
        return q + 1

    while p < len(d):
        b = d[p]
        if b == 0x3B:
            out.append(d[p:])
            break
        if b == 0x21:
            end = sub_end(p + 2)
            label = d[p + 1]
            drop = label == 0xFE or (label == 0xFF and d[p + 3:p + 14] not in (b"NETSCAPE2.0", b"ANIMEXTS1.0"))
            if not drop:
                out.append(d[p:end])
            p = end
        elif b == 0x2C:
            q = p + 10
            if d[p + 9] & 0x80:
                q += 3 << ((d[p + 9] & 7) + 1)
            end = sub_end(q + 1)
            out.append(d[p:end])
            p = end
        else:
            out.append(d[p:])
            break
    return b"".join(out)


def strip_svg(d: bytes) -> bytes:
    s = d.decode("utf-8")
    s = re.sub(r"\s*<metadata\b.*?</metadata>", "", s, flags=re.S)
    s = re.sub(r"\s*<sodipodi:namedview\b.*?(/>|</sodipodi:namedview>)", "", s, flags=re.S)
    s = re.sub(r'\s+(sodipodi|inkscape):[\w.-]+="[^"]*"', "", s)
    s = re.sub(r'\s+xmlns:(sodipodi|inkscape|rdf|dc|cc)="[^"]*"', "", s)
    return s.encode("utf-8")


# --- Ogg: rebuild the header pages with an empty comment header, copy the audio pages ---

def _crc_table() -> list:
    table = []
    for i in range(256):
        r = i << 24
        for _ in range(8):
            r = ((r << 1) ^ 0x04C11DB7) if r & 0x80000000 else (r << 1)
        table.append(r & 0xFFFFFFFF)
    return table


CRC = _crc_table()


def ogg_crc(page: bytes) -> int:
    c = 0
    for b in page:
        c = ((c << 8) ^ CRC[((c >> 24) & 0xFF) ^ b]) & 0xFFFFFFFF
    return c


def ogg_page(header_type: int, granule: int, serial: int, seq: int, segments: list, body: bytes) -> bytes:
    page = b"OggS" + struct.pack("<BBqIII", 0, header_type, granule, serial, seq, 0) + bytes([len(segments)]) + bytes(segments) + body
    return page[:22] + struct.pack("<I", ogg_crc(page)) + page[26:]


def read_pages(d: bytes) -> list:
    pages, p = [], 0
    while p < len(d):
        if d[p:p + 4] != b"OggS":
            raise ValueError("not an Ogg page")
        _, htype, granule, serial, seq, _ = struct.unpack("<BBqIII", d[p + 4:p + 26])
        n = d[p + 26]
        segs = list(d[p + 27:p + 27 + n])
        body = d[p + 27 + n:p + 27 + n + sum(segs)]
        pages.append({"type": htype, "granule": granule, "serial": serial, "segs": segs, "body": body})
        p += 27 + n + sum(segs)
    return pages


def strip_ogg(d: bytes) -> bytes:
    pages = read_pages(d)
    if len({pg["serial"] for pg in pages}) != 1:
        raise ValueError("only single-stream Ogg files are handled")
    # Collect the three header packets (identification, comment, setup); note where audio starts.
    packets, cur, first_audio = [], b"", None
    for i, pg in enumerate(pages):
        off = 0
        for s in pg["segs"]:
            cur += pg["body"][off:off + s]
            off += s
            if s < 255:
                packets.append(cur)
                cur = b""
        if len(packets) >= 3 and cur == b"":
            first_audio = i + 1
            break
    if first_audio is None or len(packets) != 3:
        raise ValueError("unexpected Ogg header layout")
    ident, comment, setup = packets
    if comment.startswith(b"\x03vorbis"):
        comment = b"\x03vorbis" + struct.pack("<II", 0, 0) + b"\x01"
    elif comment.startswith(b"OpusTags"):
        comment = b"OpusTags" + struct.pack("<II", 0, 0)
    else:
        raise ValueError("not Vorbis or Opus")
    serial = pages[0]["serial"]
    out, seq = [], 0

    def lace(pkt: bytes) -> list:
        return [255] * (len(pkt) // 255) + [len(pkt) % 255]

    out.append(ogg_page(0x02, 0, serial, seq, lace(ident), ident))
    seq += 1
    # comment + setup share pages of at most 255 segments; the last page ends with the setup packet
    segs = lace(comment) + lace(setup)
    data = comment + setup
    cont = False
    while segs:
        take, segs = segs[:255], segs[255:]
        size = sum(take)
        out.append(ogg_page(0x01 if cont else 0x00, 0, serial, seq, take, data[:size]))
        data = data[size:]
        cont = take[-1] == 255
        seq += 1
    for pg in pages[first_audio:]:
        out.append(ogg_page(pg["type"], pg["granule"], serial, seq, pg["segs"], pg["body"]))
        seq += 1
    return b"".join(out)


def strip_mp4(path: Path) -> bytes:
    with tempfile.TemporaryDirectory() as tmp:
        dst = Path(tmp) / ("out" + path.suffix)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(path), "-map", "0", "-c", "copy",
                        # drop the H.264 SEI units too (x264 writes its name and settings there)
                        "-bsf:v", "filter_units=remove_types=6",
                        "-map_metadata", "-1", "-map_chapters", "-1", "-fflags", "+bitexact",
                        "-flags:v", "+bitexact", "-flags:a", "+bitexact", "-movflags", "+faststart", str(dst)], check=True)
        return dst.read_bytes()


STRIP = {".png": strip_png, ".jpg": strip_jpeg, ".jpeg": strip_jpeg, ".webp": strip_webp, ".gif": strip_gif,
         ".svg": strip_svg, ".ogg": strip_ogg, ".oga": strip_ogg, ".opus": strip_ogg}


def stripped(path: Path) -> bytes:
    ext = path.suffix.lower()
    if ext in (".mp4", ".m4a", ".mov"):
        return strip_mp4(path)
    return STRIP[ext](path.read_bytes())


def main(argv: list) -> int:
    check = "--check" in argv
    args = [a for a in argv if not a.startswith("--")]
    if "--repo" in argv:
        tracked = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split()
        args = [str(ROOT / f) for f in tracked if Path(f).suffix.lower() in MEDIA]
    changed = 0
    for a in args:
        path = Path(a)
        if path.suffix.lower() in (".mp4", ".m4a", ".mov") and check:
            continue  # ffmpeg always rewrites the file; the test reads MP4 boxes instead
        old, new = path.read_bytes(), stripped(path)
        if new != old:
            changed += 1
            print(("would strip " if check else "stripped ") + str(path.relative_to(ROOT) if path.is_relative_to(ROOT) else path))
            if not check:
                path.write_bytes(new)
    print(f"{changed} file(s) {'need stripping' if check else 'stripped'}")
    return 1 if check and changed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
