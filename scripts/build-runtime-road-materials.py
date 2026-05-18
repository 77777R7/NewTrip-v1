#!/usr/bin/env python3
"""Build runtime road materials from user-approved source images.

This is a deterministic normalization pass, not new art generation. It keeps
the user's warm dark asphalt / worn yellow paint style while producing assets
that are safer for pseudo-3D motion: seamless, lower shimmer, and repeatable.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
RESOURCE_DIR = ROOT / "apps/unity-client/Assets/NewTrip/Art/PrototypeComposite/Resources/PrototypeComposite"

ASPHALT_SOURCE = RESOURCE_DIR / "user_road_asphalt_source.png"
LANE_WEAR_SOURCE = RESOURCE_DIR / "user_lane_worn_detail_source.png"

ASPHALT_OUT = RESOURCE_DIR / "road_asphalt_runtime_tile_512.png"
LANE_SINGLE_OUT = RESOURCE_DIR / "lane_yellow_single_runtime_strip.png"


def smoothstep(edge0: float, edge1: float, value: np.ndarray) -> np.ndarray:
    x = np.clip((value - edge0) / max(0.0001, edge1 - edge0), 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def center_crop_square(image: Image.Image, size: int) -> Image.Image:
    width, height = image.size
    crop_size = min(width, height, size)
    left = (width - crop_size) // 2
    top = (height - crop_size) // 2
    cropped = image.crop((left, top, left + crop_size, top + crop_size))

    if crop_size != size:
        cropped = cropped.resize((size, size), Image.Resampling.LANCZOS)

    return cropped


def periodic_component(rgb: np.ndarray) -> np.ndarray:
    """Return the periodic component of an RGB image using FFT decomposition."""
    height, width, channels = rgb.shape
    boundary = np.zeros_like(rgb, dtype=np.float32)

    horizontal_edge = rgb[0, :, :] - rgb[-1, :, :]
    boundary[0, :, :] += horizontal_edge
    boundary[-1, :, :] -= horizontal_edge

    vertical_edge = rgb[:, 0, :] - rgb[:, -1, :]
    boundary[:, 0, :] += vertical_edge
    boundary[:, -1, :] -= vertical_edge

    y = np.arange(height, dtype=np.float32)[:, None]
    x = np.arange(width, dtype=np.float32)[None, :]
    denom = (
        2.0 * np.cos(2.0 * np.pi * x / width)
        + 2.0 * np.cos(2.0 * np.pi * y / height)
        - 4.0
    )
    denom[0, 0] = 1.0

    result = np.empty_like(rgb, dtype=np.float32)

    for channel in range(channels):
        smooth = np.real(np.fft.ifft2(np.fft.fft2(boundary[:, :, channel]) / denom))
        result[:, :, channel] = rgb[:, :, channel] - smooth

    return np.clip(result, 0.0, 1.0)


def reduce_single_pixel_sparkle(rgb: np.ndarray) -> np.ndarray:
    image = Image.fromarray(np.uint8(np.clip(rgb, 0.0, 1.0) * 255.0))
    median = np.asarray(image.filter(ImageFilter.MedianFilter(size=3))).astype(np.float32) / 255.0
    soft = np.asarray(image.filter(ImageFilter.GaussianBlur(radius=0.45))).astype(np.float32) / 255.0

    luminance = rgb[:, :, 0] * 0.299 + rgb[:, :, 1] * 0.587 + rgb[:, :, 2] * 0.114
    median_luminance = median[:, :, 0] * 0.299 + median[:, :, 1] * 0.587 + median[:, :, 2] * 0.114
    sparkle = (luminance - median_luminance) > 0.055

    reduced = np.where(sparkle[:, :, None], median * 0.68 + rgb * 0.32, rgb)
    reduced = reduced * 0.78 + soft * 0.22

    mean = np.mean(reduced, axis=(0, 1), keepdims=True)
    reduced = mean + (reduced - mean) * 0.78

    # Keep the approved warm asphalt family, but pull extreme orange speckles
    # back down so motion reads as asphalt grain instead of glitter.
    reduced[:, :, 0] = np.clip(reduced[:, :, 0] * 0.97, 0.0, 1.0)
    reduced[:, :, 1] = np.clip(reduced[:, :, 1] * 0.96, 0.0, 1.0)
    reduced[:, :, 2] = np.clip(reduced[:, :, 2] * 1.03, 0.0, 1.0)
    return reduced


def flatten_tile_scale_variation(rgb: np.ndarray) -> np.ndarray:
    image = Image.fromarray(np.uint8(np.clip(rgb, 0.0, 1.0) * 255.0))
    low_frequency = np.asarray(image.filter(ImageFilter.GaussianBlur(radius=34))).astype(np.float32) / 255.0
    mean = np.mean(rgb, axis=(0, 1), keepdims=True)
    flattened = mean + (rgb - low_frequency) * 0.82 + (low_frequency - mean) * 0.08
    return np.clip(flattened, 0.0, 1.0)


def build_asphalt_tile() -> None:
    source = Image.open(ASPHALT_SOURCE).convert("RGB")
    crop = center_crop_square(source, 512)
    rgb = np.asarray(crop).astype(np.float32) / 255.0
    rgb = flatten_tile_scale_variation(rgb)
    rgb = reduce_single_pixel_sparkle(rgb)
    rgb = periodic_component(rgb)
    rgb = flatten_tile_scale_variation(rgb)
    rgb = reduce_single_pixel_sparkle(rgb)

    output = Image.fromarray(np.uint8(np.clip(rgb, 0.0, 1.0) * 255.0))
    output.save(ASPHALT_OUT)


def build_single_yellow_strip() -> None:
    source = Image.open(LANE_WEAR_SOURCE).convert("RGB")
    # The left worn stripe is the cleanest source stripe in the user's sample.
    crop = source.crop((58, 0, 94, source.height))
    crop = crop.resize((64, 512), Image.Resampling.LANCZOS)
    rgb = np.asarray(crop).astype(np.float32) / 255.0

    red = rgb[:, :, 0]
    green = rgb[:, :, 1]
    blue = rgb[:, :, 2]
    brightness = np.maximum(red, green)
    yellowness = red * 0.7 + green * 0.55 - blue * 0.55
    alpha = smoothstep(0.28, 0.62, yellowness) * smoothstep(0.22, 0.58, brightness)

    # Make the vertical repeat safe without turning the paint into a perfect
    # procedural stripe. The middle remains source-driven.
    blend = 56
    for y in range(blend):
        t = smoothstep(0.0, 1.0, np.array(y / (blend - 1), dtype=np.float32))
        top = alpha[y, :].copy()
        bottom = alpha[-blend + y, :].copy()
        alpha[y, :] = bottom * (1.0 - t) + top * t
        alpha[-blend + y, :] = bottom * (1.0 - t) + top * t

    x = np.linspace(-1.0, 1.0, 64, dtype=np.float32)[None, :]
    edge_mask = smoothstep(-1.0, -0.68, x) * (1.0 - smoothstep(0.68, 1.0, x))
    alpha = edge_mask * np.clip(0.58 + alpha * 0.42, 0.0, 0.96)

    paint_variation = np.clip((red * 0.6 + green * 0.4), 0.0, 1.0)
    out = np.zeros((512, 64, 4), dtype=np.float32)
    out[:, :, 0] = 1.0
    out[:, :, 1] = 0.55 + paint_variation * 0.22
    out[:, :, 2] = 0.06 + paint_variation * 0.08
    out[:, :, 3] = alpha

    output = Image.fromarray(np.uint8(np.clip(out, 0.0, 1.0) * 255.0))
    output.save(LANE_SINGLE_OUT)


def main() -> None:
    build_asphalt_tile()
    build_single_yellow_strip()
    print(f"Wrote {ASPHALT_OUT}")
    print(f"Wrote {LANE_SINGLE_OUT}")


if __name__ == "__main__":
    main()
