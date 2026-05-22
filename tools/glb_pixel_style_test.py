#!/usr/bin/env python3
"""Bake quick pixel-style orthographic previews from a simple GLB.

This is a review utility, not the production art pipeline. It intentionally
handles the current one-mesh GLB shape so we can evaluate whether a 3D source
model can be reduced into NewTrip's 2D pixel-car style.
"""

from __future__ import annotations

import argparse
import io
import json
import math
import struct
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


COMPONENT_DTYPES = {
    5121: np.uint8,
    5123: np.uint16,
    5125: np.uint32,
    5126: np.float32,
}

TYPE_COMPONENTS = {
    "SCALAR": 1,
    "VEC2": 2,
    "VEC3": 3,
    "VEC4": 4,
}


@dataclass(frozen=True)
class GlbData:
    json_doc: dict
    bin_chunk: bytes


def read_glb(path: Path) -> GlbData:
    data = path.read_bytes()
    if data[:4] != b"glTF":
        raise ValueError(f"Not a GLB file: {path}")

    version = struct.unpack_from("<I", data, 4)[0]
    if version != 2:
        raise ValueError(f"Expected GLB v2, got {version}")

    offset = 12
    json_doc = None
    bin_chunk = None

    while offset < len(data):
        chunk_length, chunk_type = struct.unpack_from("<I4s", data, offset)
        offset += 8
        chunk = data[offset : offset + chunk_length]
        offset += chunk_length

        if chunk_type == b"JSON":
            json_doc = json.loads(chunk.decode("utf-8"))
        elif chunk_type == b"BIN\x00":
            bin_chunk = bytes(chunk)

    if json_doc is None or bin_chunk is None:
        raise ValueError("GLB missing JSON or BIN chunk")

    return GlbData(json_doc=json_doc, bin_chunk=bin_chunk)


def accessor_array(glb: GlbData, accessor_index: int) -> np.ndarray:
    doc = glb.json_doc
    accessor = doc["accessors"][accessor_index]
    view = doc["bufferViews"][accessor["bufferView"]]

    dtype = np.dtype(COMPONENT_DTYPES[accessor["componentType"]]).newbyteorder("<")
    components = TYPE_COMPONENTS[accessor["type"]]
    count = accessor["count"]
    byte_offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    byte_stride = view.get("byteStride")

    if byte_stride:
        rows = []
        for i in range(count):
            start = byte_offset + i * byte_stride
            rows.append(np.frombuffer(glb.bin_chunk, dtype=dtype, count=components, offset=start))
        array = np.vstack(rows)
    else:
        array = np.frombuffer(glb.bin_chunk, dtype=dtype, count=count * components, offset=byte_offset)
        array = array.reshape((count, components))

    if accessor["type"] == "SCALAR":
        return array.reshape((count,))
    return array


def image_from_buffer_view(glb: GlbData, image_index: int) -> Image.Image:
    doc = glb.json_doc
    image = doc["images"][image_index]
    view = doc["bufferViews"][image["bufferView"]]
    offset = view.get("byteOffset", 0)
    blob = glb.bin_chunk[offset : offset + view["byteLength"]]
    return Image.open(io.BytesIO(blob)).convert("RGBA")


def material_base_texture_index(doc: dict) -> int | None:
    material = doc.get("materials", [{}])[0]
    pbr = material.get("pbrMetallicRoughness", {})
    texture_info = pbr.get("baseColorTexture")
    if not texture_info:
        return None
    texture = doc["textures"][texture_info["index"]]
    return texture.get("source")


def normalize_model(vertices: np.ndarray) -> np.ndarray:
    center = (vertices.min(axis=0) + vertices.max(axis=0)) * 0.5
    normalized = vertices - center
    extent = np.max(np.linalg.norm(normalized[:, :3], axis=1))
    if extent > 0:
        normalized = normalized / extent
    return normalized


def rotation_matrix(yaw_deg: float, pitch_deg: float = 0.0) -> np.ndarray:
    yaw = math.radians(yaw_deg)
    pitch = math.radians(pitch_deg)

    cy, sy = math.cos(yaw), math.sin(yaw)
    cp, sp = math.cos(pitch), math.sin(pitch)

    # Vehicle GLBs commonly use Z as height and Y as vehicle length. Rotate
    # around Z for turntable previews, then pitch around X for a tiny rear-view
    # camera tilt.
    rz = np.array(
        [
            [cy, -sy, 0.0],
            [sy, cy, 0.0],
            [0.0, 0.0, 1.0],
        ],
        dtype=np.float32,
    )
    rx = np.array(
        [
            [1.0, 0.0, 0.0],
            [0.0, cp, -sp],
            [0.0, sp, cp],
        ],
        dtype=np.float32,
    )
    return rx @ rz


def quantize_image(image: Image.Image, colors: int) -> Image.Image:
    alpha = image.getchannel("A")
    rgb = image.convert("RGB")
    quantized = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT).convert("RGBA")
    quantized.putalpha(alpha)
    return quantized


def sample_texture(texture: Image.Image, uv: np.ndarray) -> np.ndarray:
    width, height = texture.size
    u = np.clip(uv[..., 0] % 1.0, 0.0, 0.999999)
    v = np.clip(uv[..., 1] % 1.0, 0.0, 0.999999)
    x = (u * (width - 1)).astype(np.int32)
    y = ((1.0 - v) * (height - 1)).astype(np.int32)
    return np.asarray(texture, dtype=np.float32)[y, x] / 255.0


def rasterize(
    vertices: np.ndarray,
    uvs: np.ndarray,
    indices: np.ndarray,
    texture: Image.Image,
    yaw: float,
    pitch: float,
    size: int,
    colors: int,
    light: np.ndarray,
) -> Image.Image:
    rot = rotation_matrix(yaw, pitch)
    rotated = vertices @ rot.T

    xy = rotated[:, [0, 2]]
    z = rotated[:, 1]
    margin = 0.88
    max_extent = np.max(np.abs(xy))
    scale = (size * margin * 0.5) / max_extent
    screen = np.empty((len(vertices), 3), dtype=np.float32)
    screen[:, 0] = xy[:, 0] * scale + size * 0.5
    screen[:, 1] = size * 0.5 + xy[:, 1] * scale
    screen[:, 2] = z

    color_buffer = np.zeros((size, size, 4), dtype=np.float32)
    depth_buffer = np.full((size, size), -np.inf, dtype=np.float32)
    triangle_indices = indices.reshape((-1, 3))

    # Painter stability: draw farther triangles first, but still use z-buffer.
    order = np.argsort(screen[triangle_indices, 2].mean(axis=1))

    for tri_i in order:
        tri = triangle_indices[tri_i]
        p = screen[tri]
        uv = uvs[tri]

        min_x = max(int(math.floor(p[:, 0].min())), 0)
        max_x = min(int(math.ceil(p[:, 0].max())), size - 1)
        min_y = max(int(math.floor(p[:, 1].min())), 0)
        max_y = min(int(math.ceil(p[:, 1].max())), size - 1)
        if max_x < min_x or max_y < min_y:
            continue

        x0, y0 = p[0, 0], p[0, 1]
        x1, y1 = p[1, 0], p[1, 1]
        x2, y2 = p[2, 0], p[2, 1]
        denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(denom) < 1e-6:
            continue

        xs, ys = np.meshgrid(
            np.arange(min_x, max_x + 1, dtype=np.float32) + 0.5,
            np.arange(min_y, max_y + 1, dtype=np.float32) + 0.5,
        )

        w0 = ((y1 - y2) * (xs - x2) + (x2 - x1) * (ys - y2)) / denom
        w1 = ((y2 - y0) * (xs - x2) + (x0 - x2) * (ys - y2)) / denom
        w2 = 1.0 - w0 - w1
        mask = (w0 >= -1e-4) & (w1 >= -1e-4) & (w2 >= -1e-4)
        if not np.any(mask):
            continue

        tri_depth = w0 * p[0, 2] + w1 * p[1, 2] + w2 * p[2, 2]
        target_depth = depth_buffer[min_y : max_y + 1, min_x : max_x + 1]
        depth_mask = mask & (tri_depth > target_depth)
        if not np.any(depth_mask):
            continue

        interp_uv = (
            uv[0] * w0[..., None]
            + uv[1] * w1[..., None]
            + uv[2] * w2[..., None]
        )
        texel = sample_texture(texture, interp_uv)

        world_normal = np.cross(rotated[tri[1]] - rotated[tri[0]], rotated[tri[2]] - rotated[tri[0]])
        norm = np.linalg.norm(world_normal)
        shade = 0.78
        if norm > 1e-6:
            world_normal = world_normal / norm
            shade = float(np.clip(np.dot(world_normal, light), 0.0, 1.0))
            shade = 0.54 + 0.46 * round(shade * 3.0) / 3.0

        warm = np.array([1.12, 0.92, 0.74, 1.0], dtype=np.float32)
        rgba = np.clip(texel * shade * warm, 0.0, 1.0)
        rgba[..., 3] = texel[..., 3]

        patch = color_buffer[min_y : max_y + 1, min_x : max_x + 1]
        patch[depth_mask] = rgba[depth_mask]
        target_depth[depth_mask] = tri_depth[depth_mask]

    image = Image.fromarray(np.clip(color_buffer * 255.0, 0, 255).astype(np.uint8), "RGBA")

    alpha = image.getchannel("A")
    outline = alpha.filter(Image.Filter.FIND_EDGES) if hasattr(Image, "Filter") else alpha
    image = quantize_image(image, colors)

    # Simple crisp dark outline from alpha expansion.
    outline_mask = Image.new("L", image.size, 0)
    draw = ImageDraw.Draw(outline_mask)
    bbox = alpha.getbbox()
    if bbox:
        grown = alpha.filter(ImageFilterMax(3))
        edge = Image.fromarray(np.maximum(np.asarray(grown) - np.asarray(alpha), 0).astype(np.uint8))
        outline_layer = Image.new("RGBA", image.size, (15, 13, 14, 255))
        image = Image.alpha_composite(Image.composite(outline_layer, Image.new("RGBA", image.size, (0, 0, 0, 0)), edge), image)

    return image


def ImageFilterMax(size: int):
    from PIL import ImageFilter

    return ImageFilter.MaxFilter(size)


def make_contact_sheet(images: list[tuple[str, Image.Image]], out_path: Path, tile: int) -> None:
    label_h = 26
    columns = 3
    rows = math.ceil(len(images) / columns)
    sheet = Image.new("RGBA", (columns * tile, rows * (tile + label_h)), (18, 16, 20, 255))
    draw = ImageDraw.Draw(sheet)

    for i, (label, image) in enumerate(images):
        x = (i % columns) * tile
        y = (i // columns) * (tile + label_h)
        sheet.alpha_composite(image, (x, y))
        draw.text((x + 8, y + tile + 6), label, fill=(232, 218, 190, 255))

    sheet.save(out_path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--glb", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--size", default=256, type=int)
    parser.add_argument("--colors", default=24, type=int)
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    glb = read_glb(args.glb)
    doc = glb.json_doc

    primitive = doc["meshes"][0]["primitives"][0]
    vertices = normalize_model(accessor_array(glb, primitive["attributes"]["POSITION"]).astype(np.float32))
    uvs = accessor_array(glb, primitive["attributes"]["TEXCOORD_0"]).astype(np.float32)
    indices = accessor_array(glb, primitive["indices"]).astype(np.int32)

    base_image_index = material_base_texture_index(doc)
    if base_image_index is None:
        texture = Image.new("RGBA", (16, 16), (210, 180, 145, 255))
    else:
        texture = image_from_buffer_view(glb, base_image_index)
        texture = texture.resize((256, 256), Image.Resampling.NEAREST)
        texture = quantize_image(texture, args.colors)

    texture.save(args.out / "base_color_256_quantized.png")

    light = np.array([-0.35, 0.55, 0.75], dtype=np.float32)
    light = light / np.linalg.norm(light)

    views = [
        ("yaw_000", 0),
        ("yaw_060", 60),
        ("yaw_120", 120),
        ("yaw_180", 180),
        ("yaw_240", 240),
        ("yaw_300", 300),
    ]

    rendered: list[tuple[str, Image.Image]] = []
    for label, yaw in views:
        image = rasterize(vertices, uvs, indices, texture, yaw, pitch=-5, size=args.size, colors=args.colors, light=light)
        image.save(args.out / f"{label}_pixel_preview.png")
        rendered.append((label, image))

    make_contact_sheet(rendered, args.out / "glb_pixel_view_contact_sheet.png", args.size)

    report = {
        "source": str(args.glb),
        "out": str(args.out),
        "size": args.size,
        "colors": args.colors,
        "vertices": int(len(vertices)),
        "triangles": int(len(indices) // 3),
        "texture_source": base_image_index,
        "views": [label for label, _ in views],
        "note": "Software rasterized orthographic preview for style feasibility only; not a production asset bake.",
    }
    (args.out / "glb_pixel_style_test_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
