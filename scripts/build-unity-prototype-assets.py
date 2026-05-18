#!/usr/bin/env python3
"""Build Unity prototype composite assets from the approved draft PNGs.

This is intentionally a prototype importer, not the production art pipeline.
It crops representative sprites from the approved sheets so Unity can test
composition, road projection, spawning, and animation with real art direction.
"""

from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw


DEFAULT_FILES = {
    "bridge": "ChatGPT Image 2026年5月16日 下午09_46_43 (8).png",
    "weather": "ChatGPT Image 2026年5月16日 下午09_46_43 (7).png",
    "far": "ChatGPT Image 2026年5月16日 下午09_46_42 (6).png",
    "sky": "ChatGPT Image 2026年5月16日 下午09_46_42 (5).png",
    "roadside_alt": "ChatGPT Image 2026年5月16日 下午09_46_40 (3).png",
    "car": "ChatGPT Image 2026年5月16日 下午09_46_40 (2).png",
    "road": "ChatGPT Image 2026年5月16日 下午09_46_40 (1).png",
    "roadside": "ChatGPT Image 2026年5月16日 下午09_46_40 (3).png",
    "sign": "ChatGPT Image 2026年5月16日 下午09_46_41 (4).png",
}


def open_rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def color_distance(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def flood_transparent(image: Image.Image, tolerance: int = 54) -> Image.Image:
    """Remove only border-connected background pixels.

    The sheets use a warm cream/gray page background. A flood fill from the
    canvas edge keeps similarly colored highlights inside sprites intact.
    """

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


def trim_alpha(image: Image.Image, padding: int = 8) -> Image.Image:
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        return image

    left, top, right, bottom = bounds
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def remove_small_alpha_components(image: Image.Image, min_pixels: int = 36) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    seen: set[tuple[int, int]] = set()

    for y in range(height):
        for x in range(width):
            if (x, y) in seen or pixels[x, y][3] == 0:
                continue

            queue: deque[tuple[int, int]] = deque([(x, y)])
            component: list[tuple[int, int]] = []
            seen.add((x, y))

            while queue:
                cx, cy = queue.popleft()
                component.append((cx, cy))

                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if nx < 0 or nx >= width or ny < 0 or ny >= height:
                        continue
                    if (nx, ny) in seen or pixels[nx, ny][3] == 0:
                        continue
                    seen.add((nx, ny))
                    queue.append((nx, ny))

            if len(component) < min_pixels:
                for px, py in component:
                    r, g, b, _ = pixels[px, py]
                    pixels[px, py] = (r, g, b, 0)

    return image


def keep_largest_alpha_component(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    seen: set[tuple[int, int]] = set()
    components: list[list[tuple[int, int]]] = []

    for y in range(height):
        for x in range(width):
            if (x, y) in seen or pixels[x, y][3] == 0:
                continue

            queue: deque[tuple[int, int]] = deque([(x, y)])
            component: list[tuple[int, int]] = []
            seen.add((x, y))

            while queue:
                cx, cy = queue.popleft()
                component.append((cx, cy))

                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if nx < 0 or nx >= width or ny < 0 or ny >= height:
                        continue
                    if (nx, ny) in seen or pixels[nx, ny][3] == 0:
                        continue
                    seen.add((nx, ny))
                    queue.append((nx, ny))

            components.append(component)

    if not components:
        return image

    keep = set(max(components, key=len))

    for y in range(height):
        for x in range(width):
            if pixels[x, y][3] > 0 and (x, y) not in keep:
                r, g, b, _ = pixels[x, y]
                pixels[x, y] = (r, g, b, 0)

    return image


def crop_save(
    image: Image.Image,
    box: tuple[int, int, int, int],
    out_path: Path,
    transparent: bool = False,
    trim: bool = False,
    lane_alpha: bool = False,
    keep_largest: bool = False,
) -> None:
    sprite = image.crop(box)
    if transparent:
        sprite = flood_transparent(sprite)
    if lane_alpha:
        sprite = keep_only_lane_pixels(sprite)
    sprite = remove_small_alpha_components(sprite)
    if keep_largest:
        sprite = keep_largest_alpha_component(sprite)
    if trim:
        sprite = trim_alpha(sprite)
    sprite.save(out_path)


def keep_only_lane_pixels(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()

    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            yellow = r > 150 and g > 90 and b < 80
            white = r > 185 and g > 170 and b > 140
            if not yellow and not white:
                pixels[x, y] = (r, g, b, 0)
            else:
                pixels[x, y] = (r, g, b, min(255, max(a, 220)))

    return trim_alpha(image, padding=2)


def save_manifest(out_dir: Path, files: dict[str, str]) -> None:
    manifest = {
        "usage": "Unity prototype composite assets only; not final production slicing.",
        "source_dir": "local draft sheet folder omitted from repo manifest",
        "layers": {
            "sky_layer": "sky_sunset.png",
            "far_background_layer": "far_coast_cutout.png",
            "bridge_midground_layer": "bridge_midground_cutout.png",
            "road_texture": "road_asphalt_tile.png",
            "lane_marking_strip": "lane_center_yellow_strip.png",
            "car_rear_sprite": "car_rear_player.png",
            "roadside_sprite_sheet_extracts": [
                "roadside_bush_flowers.png",
                "roadside_rock.png",
                "roadside_cliff_edge.png",
                "roadside_pine.png",
                "roadside_guardrail.png",
            ],
            "sign_sprite_sheet_extracts": [
                "sign_california_1.png",
                "sign_big_sur_15.png",
                "sign_scenic_overlook.png",
                "sign_rest_stop.png",
                "sign_wood_arrow.png",
            ],
            "weather_overlay": [
                "weather_haze_clouds.png",
                "weather_rain_streaks.png",
                "weather_sun_glow.png",
            ],
        },
        "source_files": files,
    }
    (out_dir / "prototype_asset_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def build_contact_sheet(out_dir: Path, asset_names: Iterable[str]) -> None:
    thumbs: list[tuple[str, Image.Image]] = []

    for name in asset_names:
        path = out_dir / name
        if not path.exists():
            continue
        image = Image.open(path).convert("RGBA")
        image.thumbnail((180, 140), Image.Resampling.NEAREST)
        thumbs.append((name, image.copy()))

    columns = 4
    cell_w = 240
    cell_h = 190
    rows = (len(thumbs) + columns - 1) // columns
    sheet = Image.new("RGBA", (cell_w * columns, cell_h * rows), (246, 238, 226, 255))
    draw = ImageDraw.Draw(sheet)

    for index, (name, image) in enumerate(thumbs):
        col = index % columns
        row = index // columns
        x = col * cell_w + (cell_w - image.width) // 2
        y = row * cell_h + 28
        sheet.alpha_composite(image, (x, y))
        draw.text((col * cell_w + 12, row * cell_h + 8), name, fill=(42, 38, 34, 255))

    sheet.save(out_dir.parent / "prototype_asset_contact_sheet.png")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", default=str(Path.home() / "Downloads"))
    parser.add_argument(
        "--out-dir",
        default="apps/unity-client/Assets/NewTrip/Art/PrototypeComposite/Resources/PrototypeComposite",
    )
    args = parser.parse_args()

    source_dir = Path(args.source_dir).expanduser()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    paths = {key: source_dir / filename for key, filename in DEFAULT_FILES.items()}
    missing = [str(path) for path in paths.values() if not path.exists()]
    if missing:
        raise FileNotFoundError("Missing source image(s):\n" + "\n".join(missing))

    sky = open_rgba(paths["sky"])
    sky.save(out_dir / "sky_sunset.png")

    far = flood_transparent(open_rgba(paths["far"]))
    trim_alpha(far, padding=0).save(out_dir / "far_coast_cutout.png")

    bridge = flood_transparent(open_rgba(paths["bridge"]))
    trim_alpha(bridge, padding=0).save(out_dir / "bridge_midground_cutout.png")

    road = open_rgba(paths["road"])
    crop_save(road, (24, 72, 584, 795), out_dir / "road_asphalt_tile.png")
    crop_save(road, (615, 72, 744, 1178), out_dir / "lane_center_yellow_strip.png", lane_alpha=True)

    weather = flood_transparent(open_rgba(paths["weather"]), tolerance=42)
    crop_save(weather, (24, 38, 640, 420), out_dir / "weather_haze_clouds.png", trim=True)
    crop_save(weather, (34, 525, 625, 800), out_dir / "weather_rain_streaks.png", trim=True)
    crop_save(weather, (58, 884, 310, 1136), out_dir / "weather_sun_glow.png", trim=True)

    car = flood_transparent(open_rgba(paths["car"]))
    crop_save(car, (420, 205, 815, 548), out_dir / "car_rear_player.png", trim=True)

    roadside = flood_transparent(open_rgba(paths["roadside"]))
    crop_save(roadside, (42, 34, 165, 136), out_dir / "roadside_bush_flowers.png", trim=True)
    crop_save(roadside, (497, 250, 630, 360), out_dir / "roadside_rock.png", trim=True, keep_largest=True)
    crop_save(roadside, (45, 388, 223, 532), out_dir / "roadside_cliff_edge.png", trim=True)
    crop_save(roadside, (772, 632, 858, 922), out_dir / "roadside_pine.png", trim=True, keep_largest=True)
    crop_save(roadside, (36, 550, 400, 660), out_dir / "roadside_guardrail.png", trim=True)

    sign = flood_transparent(open_rgba(paths["sign"]))
    crop_save(sign, (28, 54, 216, 360), out_dir / "sign_california_1.png", trim=True)
    crop_save(sign, (456, 50, 634, 350), out_dir / "sign_big_sur_15.png", trim=True)
    crop_save(sign, (834, 54, 1190, 346), out_dir / "sign_scenic_overlook.png", trim=True)
    crop_save(sign, (824, 430, 1005, 670), out_dir / "sign_rest_stop.png", trim=True)
    crop_save(sign, (660, 748, 834, 930), out_dir / "sign_wood_arrow.png", trim=True)

    save_manifest(out_dir, DEFAULT_FILES)
    build_contact_sheet(
        out_dir,
        [
            "sky_sunset.png",
            "far_coast_cutout.png",
            "bridge_midground_cutout.png",
            "road_asphalt_tile.png",
            "lane_center_yellow_strip.png",
            "car_rear_player.png",
            "roadside_bush_flowers.png",
            "roadside_rock.png",
            "roadside_cliff_edge.png",
            "roadside_pine.png",
            "roadside_guardrail.png",
            "sign_california_1.png",
            "sign_big_sur_15.png",
            "sign_scenic_overlook.png",
            "sign_rest_stop.png",
            "sign_wood_arrow.png",
            "weather_haze_clouds.png",
            "weather_rain_streaks.png",
            "weather_sun_glow.png",
        ],
    )

    print(f"Wrote Unity prototype assets to {out_dir}")


if __name__ == "__main__":
    main()
