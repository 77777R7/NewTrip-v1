#!/usr/bin/env python3
"""Extract a small Unity review asset set from source sheets using a manifest.

This is the cleaner successor to the prototype-only hard-coded crop script.
The manifest owns crop boxes, padding, pivot intent, output canvas, status, and
QA notes. Outputs are still review assets until the QA report and Unity
composite are approved.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import deque
from pathlib import Path
from typing import Any

from PIL import Image


DEFAULT_MANIFEST = "docs/art/bigsur-unity-asset-extraction-manifest-v1.json"


def open_rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def color_distance(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def flood_transparent(image: Image.Image, tolerance: int = 54) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    corner_colors = [
        pixels[0, 0],
        pixels[width - 1, 0],
        pixels[0, height - 1],
        pixels[width - 1, height - 1],
    ]

    def is_background(x: int, y: int) -> bool:
        color = pixels[x, y]
        return any(color_distance(color, base) <= tolerance for base in corner_colors)

    queue: deque[tuple[int, int]] = deque()
    seen: set[tuple[int, int]] = set()

    for x in range(width):
        for y in (0, height - 1):
            if is_background(x, y):
                queue.append((x, y))
                seen.add((x, y))

    for y in range(height):
        for x in (0, width - 1):
            if (x, y) not in seen and is_background(x, y):
                queue.append((x, y))
                seen.add((x, y))

    while queue:
        x, y = queue.popleft()
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)

        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or nx >= width or ny < 0 or ny >= height:
                continue
            if (nx, ny) in seen or not is_background(nx, ny):
                continue
            seen.add((nx, ny))
            queue.append((nx, ny))

    return image


def keep_only_lane_pixels(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()

    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            yellow = r > 150 and g > 90 and b < 90
            white = r > 185 and g > 170 and b > 140

            if yellow or white:
                pixels[x, y] = (r, g, b, max(a, 224))
            else:
                pixels[x, y] = (r, g, b, 0)

    return image


def trim_alpha(image: Image.Image, padding: int, bottom_padding: int | None = None) -> Image.Image:
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()

    if bounds is None:
        return image

    bottom_pad = padding if bottom_padding is None else bottom_padding
    left, top, right, bottom = bounds
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + bottom_pad)
    return image.crop((left, top, right, bottom))


def fit_to_canvas(image: Image.Image, canvas_size: list[int] | None, pivot: list[float]) -> Image.Image:
    if not canvas_size:
        return image

    canvas_width, canvas_height = canvas_size
    canvas = Image.new("RGBA", (canvas_width, canvas_height), (0, 0, 0, 0))
    paste_x = round(canvas_width * pivot[0] - image.width * pivot[0])

    if pivot[1] == 0:
        paste_y = canvas_height - image.height
    elif pivot[1] == 1:
        paste_y = 0
    else:
        paste_y = round(canvas_height * (1 - pivot[1]) - image.height * (1 - pivot[1]))

    paste_x = max(0, min(canvas_width - image.width, paste_x))
    paste_y = max(0, min(canvas_height - image.height, paste_y))
    canvas.alpha_composite(image, (paste_x, paste_y))
    return canvas


def edge_alpha_pixels(image: Image.Image) -> int:
    pixels = image.load()
    width, height = image.size
    count = 0

    for x in range(width):
        count += 1 if pixels[x, 0][3] > 0 else 0
        count += 1 if pixels[x, height - 1][3] > 0 else 0

    for y in range(height):
        count += 1 if pixels[0, y][3] > 0 else 0
        count += 1 if pixels[width - 1, y][3] > 0 else 0

    return count


def deterministic_guid(asset_id: str) -> str:
    return hashlib.md5(f"newtrip-unity-extract:{asset_id}".encode("utf-8")).hexdigest()


def write_texture_meta(image_path: Path, asset: dict[str, Any]) -> None:
    pivot = asset.get("pivot", [0.5, 0.5])
    alpha_transparency = 0 if asset.get("alpha_method") == "none" else 1
    guid = deterministic_guid(asset["id"])
    image_path.with_suffix(image_path.suffix + ".meta").write_text(
        f"""fileFormatVersion: 2
guid: {guid}
TextureImporter:
  internalIDToNameTable: []
  externalObjects: {{}}
  serializedVersion: 13
  mipmaps:
    mipMapMode: 0
    enableMipMap: 0
    sRGBTexture: 1
    linearTexture: 0
    fadeOut: 0
    borderMipMap: 0
    mipMapsPreserveCoverage: 0
    alphaTestReferenceValue: 0.5
    mipMapFadeDistanceStart: 1
    mipMapFadeDistanceEnd: 3
  bumpmap:
    convertToNormalMap: 0
    externalNormalMap: 0
    heightScale: 0.25
    normalMapFilter: 0
    flipGreenChannel: 0
  isReadable: 0
  streamingMipmaps: 0
  streamingMipmapsPriority: 0
  vTOnly: 0
  ignoreMipmapLimit: 0
  grayScaleToAlpha: 0
  generateCubemap: 6
  cubemapConvolution: 0
  seamlessCubemap: 0
  textureFormat: 1
  maxTextureSize: 2048
  textureSettings:
    serializedVersion: 2
    filterMode: 0
    aniso: 1
    mipBias: 0
    wrapU: 1
    wrapV: 1
    wrapW: 1
  nPOTScale: 0
  lightmap: 0
  compressionQuality: 50
  spriteMode: 1
  spriteExtrude: 1
  spriteMeshType: 1
  alignment: 9
  spritePivot: {{x: {pivot[0]}, y: {pivot[1]}}}
  spritePixelsToUnits: 100
  spriteBorder: {{x: 0, y: 0, z: 0, w: 0}}
  spriteGenerateFallbackPhysicsShape: 1
  alphaUsage: 1
  alphaIsTransparency: {alpha_transparency}
  spriteTessellationDetail: -1
  textureType: 8
  textureShape: 1
  singleChannelComponent: 0
  flipbookRows: 1
  flipbookColumns: 1
  maxTextureSizeSet: 0
  compressionQualitySet: 0
  textureFormatSet: 0
  ignorePngGamma: 0
  applyGammaDecoding: 0
  swizzle: 50462976
  cookieLightType: 0
  platformSettings:
  - serializedVersion: 4
    buildTarget: DefaultTexturePlatform
    maxTextureSize: 2048
    resizeAlgorithm: 0
    textureFormat: -1
    textureCompression: 1
    compressionQuality: 50
    crunchedCompression: 0
    allowsAlphaSplitting: 0
    overridden: 0
    ignorePlatformSupport: 0
    androidETC2FallbackOverride: 0
    forceMaximumCompressionQuality_BC6H_BC7: 0
  spriteSheet:
    serializedVersion: 2
    sprites: []
    outline: []
    customData:
    physicsShape: []
    bones: []
    spriteID:
    internalID: 0
    vertices: []
    indices:
    edges: []
    weights: []
    secondaryTextures: []
    spriteCustomMetadata:
      entries: []
    nameFileIdTable: {{}}
  mipmapLimitGroupName:
  pSDRemoveMatte: 0
  userData:
  assetBundleName:
  assetBundleVariant:
""",
        encoding="utf-8",
    )


def write_text_meta(text_path: Path, asset_id: str) -> None:
    text_path.with_suffix(text_path.suffix + ".meta").write_text(
        f"""fileFormatVersion: 2
guid: {deterministic_guid(asset_id)}
TextScriptImporter:
  externalObjects: {{}}
  userData:
  assetBundleName:
  assetBundleVariant:
""",
        encoding="utf-8",
    )


def extract_asset(source: Image.Image, asset: dict[str, Any]) -> tuple[Image.Image, dict[str, Any]]:
    crop = asset["crop"]
    image = source.crop(tuple(crop))
    alpha_method = asset.get("alpha_method", "none")

    if alpha_method == "flood":
        image = flood_transparent(image, tolerance=asset.get("background_tolerance", 54))
    elif alpha_method == "lane":
        image = keep_only_lane_pixels(image)
    elif alpha_method != "none":
        raise ValueError(f"Unsupported alpha_method {alpha_method!r} for {asset['id']}")

    if asset.get("trim", False):
        padding = int(asset.get("padding", 0))
        pivot = asset.get("pivot", [0.5, 0.5])
        default_bottom_padding = 0 if pivot[1] == 0 else padding
        image = trim_alpha(
            image,
            padding=padding,
            bottom_padding=int(asset.get("bottom_padding", default_bottom_padding)),
        )

    image = fit_to_canvas(image, asset.get("canvas_size"), asset.get("pivot", [0.5, 0.5]))
    alpha_bbox = image.getchannel("A").getbbox()
    qa = {
        "id": asset["id"],
        "output_file": asset["output_file"],
        "status": asset.get("status", "review"),
        "qa_result": asset.get("qa_result", "not_reviewed"),
        "size": list(image.size),
        "alpha_bbox": list(alpha_bbox) if alpha_bbox is not None else None,
        "has_transparency": image.getchannel("A").getextrema()[0] < 255,
        "edge_alpha_pixels": edge_alpha_pixels(image),
        "pivot": asset.get("pivot", [0.5, 0.5]),
    }
    return image, qa


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default=DEFAULT_MANIFEST)
    parser.add_argument("--source-dir", default=None)
    parser.add_argument("--out-dir", default=None)
    parser.add_argument("--qa-report", default=None)
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    source_dir = Path(args.source_dir or manifest["source_dir"]).expanduser()
    out_dir = Path(args.out_dir or manifest["output_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)

    source_cache: dict[str, Image.Image] = {}
    qa_results: list[dict[str, Any]] = []

    for asset in manifest["assets"]:
        source_key = asset["source_key"]

        if source_key not in source_cache:
            source_filename = manifest["source_files"][source_key]
            source_path = source_dir / source_filename

            if not source_path.exists():
                raise FileNotFoundError(f"Missing source for {source_key}: {source_path}")

            source_cache[source_key] = open_rgba(source_path)

        image, qa = extract_asset(source_cache[source_key], asset)
        output_path = out_dir / asset["output_file"]
        image.save(output_path)
        write_texture_meta(output_path, asset)
        qa_results.append(qa)

    report_path = Path(args.qa_report or (out_dir / "extraction_qa_report.json" if args.out_dir else manifest["qa_report"]))
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "manifest": str(manifest_path),
        "source_dir": str(source_dir),
        "output_dir": str(out_dir),
        "asset_count": len(qa_results),
        "assets": qa_results,
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_text_meta(report_path, "extraction_qa_report")
    print(f"Wrote {len(qa_results)} extracted assets to {out_dir}")
    print(f"Wrote QA report to {report_path}")


if __name__ == "__main__":
    main()
