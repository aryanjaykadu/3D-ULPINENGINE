#!/usr/bin/env python3
"""
Synthetic test-data generator v2 for SIH26011 (3D ULPIN / vertical property mapping).

v2 reproduces the schema of the user-modified dataset (synthetic_3d_cadastre.zip):
  * Pune origin, ~500 m terrain, building IDs B01..B04 (+ B99 for underground objects)
  * 3D-ULPIN-style unit IDs:  <base2D><NN>-<bld>-<floor>-<unit>-Z<hash4>
  * spatial_units.json with ownership / provenance / disclaimer blocks
and fixes problems found in that dataset:
  * ground_truth.json now uses the CURRENT unit IDs (it used pre-rename IDs that no
    longer existed in units.csv) and keeps legacy IDs as a cross-reference
  * legacy_code is now also a column in units.csv
  * timestamps are deterministic (same --seed => byte-identical output)
  * sensor_model matches the provenance source (was always a DJI LiDAR, even for CAD data)
  * parcels/buildings carry "synthetic": true
  * files are written with LF line endings on every OS (CRLF can leave a stray \\r in the
    last CSV column when loaded with PostgreSQL COPY on Linux)

ALL DATA IS SYNTHETIC. The IDs merely imitate a 3D ULPIN layout; they are NOT an official
DoLR / Survey of India format and the '14MH...' base numbers are invented.

Requires: numpy   (optional: laspy, only with --las)

    python generate_synthetic_data_v2.py                      # -> ./synthetic_3d_cadastre
    python generate_synthetic_data_v2.py --out data --seed 7 --las
"""
import argparse
import hashlib
import json
import math
import os
from datetime import datetime, timedelta, timezone

import numpy as np

# ---------------------------------------------------------------- geo config
LAT0, LON0 = 18.5204, 73.8567           # local frame origin (Pune area) - all invented
BASE_ELEV = 500.0                        # terrain reference, m above MSL
M_LAT = 111_320.0
M_LON = 111_320.0 * math.cos(math.radians(LAT0))
EXTENT = (-20.0, -20.0, 160.0, 150.0)    # local metric extent (ground / DEM)
FLOOR_H = 3.0
BASEMENT_DEPTH = 3.5
B_LIDAR_EXTRA = 1.8                      # building B02: LiDAR roof is 1.8 m above floor-plan claim
PENTHOUSE_RECT = (100, 100, 115, 110)    # unsanctioned rooftop structure on B04
BASE_TS = datetime(2026, 9, 28, 0, 0, 0, tzinfo=timezone.utc)

SOURCES = {  # provenance source -> sensor model
    "LiDAR / Drone Mesh": "DJI Zenmuse L1",
    "BIM / CAD Floor Plan": "N/A (vector BIM/CAD)",
    "Cadastral Survey / GNSS": "GNSS/CORS rover",
    "Mobile Mapping LiDAR": "Mobile mapping LiDAR",
}
PARCELS = {"P-A": (0, 0, 60, 50), "P-B": (80, 0, 140, 50), "P-C": (0, 80, 60, 130),
           "P-D": (80, 80, 140, 130), "P-ROAD": (0, 52, 140, 78)}
PARCEL_ULPIN = {k: f"14MH2704{2910 + i}" for i, k in enumerate(PARCELS)}   # 14MH27042910 ...
BUILDINGS = [
    dict(id="B01", legacy="A", name="Shree Ram Heights", parcel="P-A", rect=(10, 10, 50, 40), floors=12, basement=True),
    dict(id="B02", legacy="B", name="Cyber Tech Hub", parcel="P-B", rect=(90, 10, 130, 40), floors=8, basement=True),
    dict(id="B03", legacy="C", name="Green Valley Towers", parcel="P-C", rect=(10, 90, 50, 120), floors=5, basement=False),
    dict(id="B04", legacy="D", name="Imperial Residency", parcel="P-D", rect=(90, 90, 130, 120), floors=3, basement=True),
]
BLD = {b["id"]: b for b in BUILDINGS}


# ---------------------------------------------------------------- helpers
def to_lonlat(x, y):
    return [round(LON0 + x / M_LON, 8), round(LAT0 + y / M_LAT, 8)]


def ring_ll(r):
    x0, y0, x1, y1 = r
    return [to_lonlat(x, y) for x, y in [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]]


def wkt_ll(r):
    return "POLYGON((" + ", ".join(f"{lo} {la}" for lo, la in ring_ll(r)) + "))"


def dem(x, y):
    return BASE_ELEV + 0.010 * x + 0.005 * y + 0.6 * math.sin(x / 25.0) * math.cos(y / 30.0)


def inset(r, d):
    return (r[0] + d, r[1] + d, r[2] - d, r[3] - d)


def floor_label(f):
    return f"FB{-f}" if f < 0 else f"F{f:02d}"


def open_w(path):
    return open(path, "w", newline="\n", encoding="utf-8")


def write_json(path, obj):
    with open_w(path) as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)


def feature(rect, props):
    return {"type": "Feature", "properties": props,
            "geometry": {"type": "Polygon", "coordinates": [ring_ll(rect)]}}


def fc(features):
    return {"type": "FeatureCollection", "features": features}


# ---------------------------------------------------------------- units
def build_units(rng):
    raw = []

    def add(legacy, utype, bid, parcel, floor, unit_number, rect, zmin, zmax):
        src = str(rng.choice(list(SOURCES)))
        raw.append(dict(legacy_code=legacy, type=utype, building_id=bid, parcel_id=parcel,
                        floor=floor, unit_number=unit_number, rect=rect,
                        z_min=round(zmin, 3), z_max=round(zmax, 3),
                        source=src, confidence=round(float(rng.uniform(0.70, 0.99)), 3)))

    for b in BUILDINGS:
        x0, y0, x1, y1 = b["rect"]
        base = dem((x0 + x1) / 2, (y0 + y1) / 2)
        b["base_z"] = round(base, 3)
        xm, ym = (x0 + x1) / 2, (y0 + y1) / 2
        cells = {1: (x0, y0, xm, ym), 2: (xm, y0, x1, ym), 3: (x0, ym, xm, y1), 4: (xm, ym, x1, y1)}
        L = b["legacy"]
        if b["basement"]:
            add(f"{L}-B01", "basement", b["id"], b["parcel"], -1, "B01", b["rect"], base - BASEMENT_DEPTH, base)
        for f in range(1, b["floors"] + 1):
            z0, z1 = base + (f - 1) * FLOOR_H, base + f * FLOOR_H
            for u, cr in cells.items():
                zmin, zmax = z0, z1
                if b["id"] == "B01" and f == 7 and u == 2:          # ISSUE 1: z_min > z_max
                    zmin, zmax = z1, z0
                if b["id"] == "B03" and f == 3:                     # ISSUE 3: floors out of order
                    zmin, zmax = base + 2.0, base + 5.0
                add(f"{L}-F{f:02d}-U{u:02d}", "apartment", b["id"], b["parcel"], f, f"U{u:02d}", cr, zmin, zmax)
                if b["id"] == "B01" and f == 5 and u == 3:          # ISSUE 2: same flat twice
                    add("A-F05-U03-DUP", "apartment", b["id"], b["parcel"], f, "U03DUP", inset(cr, 1.0), zmin, zmax)
        if b["id"] == "B04":                                        # ISSUE 5: unsanctioned rooftop unit
            add("D-F04-PH", "apartment", b["id"], b["parcel"], 4, "PH01", PENTHOUSE_RECT,
                base + 3 * FLOOR_H, base + 4 * FLOOR_H)

    baseA, baseB = BLD["B01"]["base_z"], BLD["B02"]["base_z"]
    # ISSUE 4: metro segment 2 rises into B02's basement
    add("T-01-SEG1", "transit_corridor", "B99", "P-A", -2, "METRO1", (-10, 22, 75, 28), baseA - 14.0, baseA - 8.0)
    add("T-01-SEG2", "transit_corridor", "B99", "P-B", -2, "METRO2", (75, 22, 150, 28), baseB - 8.0, baseB - 2.5)
    baseR = dem(70, 65)
    add("U-01", "utility_corridor", "B99", "P-ROAD", -2, "UTIL1", (0, 64, 140, 66), baseR - 2.5, baseR - 1.5)

    units, seen = [], set()
    for i, u in enumerate(raw):
        base2d = PARCEL_ULPIN[u["parcel_id"]]
        zh = hashlib.sha1(
            f"{base2d}|{u['building_id']}|{u['floor']}|{u['unit_number']}|{u['z_min']:.3f}|{u['z_max']:.3f}".encode()
        ).hexdigest()[:4].upper()
        un = u["unit_number"]
        part = un if un.startswith("U") else "U" + un       # U01, UB01, UPH01, UMETRO1, UTIL1
        uid = f"{base2d}00-{u['building_id']}-{floor_label(u['floor'])}-{part}-Z{zh}"
        assert uid not in seen, f"duplicate ID {uid}"
        seen.add(uid)
        u.update(unit_id=uid, parent_ulpin=base2d, z_hash=zh,
                 height_meters=round(abs(u["z_max"] - u["z_min"]), 3),
                 timestamp=(BASE_TS + timedelta(seconds=i)).isoformat())
        units.append(u)
    return units


def overlaps_3d(units):
    boxes = [(u["unit_id"], u["rect"], *sorted((u["z_min"], u["z_max"]))) for u in units]
    hits = []
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            (a, ra, alo, ahi), (b, rb, blo, bhi) = boxes[i], boxes[j]
            if (min(ra[2], rb[2]) - max(ra[0], rb[0]) > 1e-9 and min(ra[3], rb[3]) - max(ra[1], rb[1]) > 1e-9
                    and min(ahi, bhi) - max(alo, blo) > 1e-9):
                hits.append((a, b))
    return hits


# ---------------------------------------------------------------- point cloud
def in_rect(x, y, r):
    return (x >= r[0]) & (x <= r[2]) & (y >= r[1]) & (y <= r[3])


def sample_rect(rng, r, n):
    return rng.uniform(r[0], r[2], n), rng.uniform(r[1], r[3], n)


def build_pointcloud(rng, density):
    X, Y, Z, C, K = [], [], [], [], []

    def push(x, y, z, cls, kind):
        X.append(x); Y.append(y); Z.append(z); C.append(np.full(len(x), cls)); K.append(np.full(len(x), kind))

    area = (EXTENT[2] - EXTENT[0]) * (EXTENT[3] - EXTENT[1])
    gx, gy = sample_rect(rng, EXTENT, int(area * 1.0))
    keep = np.ones(len(gx), bool)
    for b in BUILDINGS:
        keep &= ~in_rect(gx, gy, b["rect"])
    gx, gy = gx[keep], gy[keep]
    push(gx, gy, np.array([dem(a, b) for a, b in zip(gx, gy)]) + rng.normal(0, 0.03, len(gx)), 2, "ground")

    placed = 0
    while placed < 40:
        cx, cy = rng.uniform(EXTENT[0], EXTENT[2]), rng.uniform(EXTENT[1], EXTENT[3])
        if any(in_rect(np.array([cx]), np.array([cy]),
                       (b["rect"][0] - 4, b["rect"][1] - 4, b["rect"][2] + 4, b["rect"][3] + 4))[0] for b in BUILDINGS):
            continue
        x = rng.normal(cx, 1.5, 150); y = rng.normal(cy, 1.5, 150)
        push(x, y, np.array([dem(a, b) for a, b in zip(x, y)]) + rng.uniform(2, 7, 150), 5, "vegetation")
        placed += 1

    for b in BUILDINGS:
        r, base, fl = b["rect"], b["base_z"], b["floors"]
        roof = base + fl * FLOOR_H + (B_LIDAR_EXTRA if b["id"] == "B02" else 0.0)
        area_b = (r[2] - r[0]) * (r[3] - r[1])
        rx, ry = sample_rect(rng, r, int(area_b * density))
        rz = np.full(len(rx), roof)
        if b["id"] == "B04":
            rz[in_rect(rx, ry, PENTHOUSE_RECT)] = base + 4 * FLOOR_H
            px, py = sample_rect(rng, PENTHOUSE_RECT, 150)
            push(px, py, np.full(150, base + 4 * FLOOR_H) + rng.normal(0, 0.03, 150), 6, "roof")
        push(rx, ry, rz + rng.normal(0, 0.03, len(rx)), 6, "roof")
        for (ax, ay), (bx, by) in [((r[0], r[1]), (r[2], r[1])), ((r[2], r[1]), (r[2], r[3])),
                                   ((r[2], r[3]), (r[0], r[3])), ((r[0], r[3]), (r[0], r[1]))]:
            n = int(math.hypot(bx - ax, by - ay) * (roof - base) * 2.0)
            t = rng.uniform(0, 1, n)
            push(ax + t * (bx - ax), ay + t * (by - ay), rng.uniform(base, roof, n), 6, "wall")
        for k in range(fl + 1):   # slabs at the REAL 3 m levels
            sx, sy = sample_rect(rng, inset(r, 0.3), int(area_b * 1.5))
            push(sx, sy, np.full(len(sx), base + k * FLOOR_H) + rng.normal(0, 0.03, len(sx)), 6, "slab")

    return (np.concatenate(X), np.concatenate(Y), np.concatenate(Z),
            np.concatenate(C).astype(np.uint8), np.concatenate(K))


def cityjson():
    verts, objs = [], {}
    for b in BUILDINGS:
        x0, y0, x1, y1 = b["rect"]
        zb, zt = b["base_z"], b["base_z"] + b["floors"] * FLOOR_H
        o = len(verts)
        verts += [[x0, y0, zb], [x1, y0, zb], [x1, y1, zb], [x0, y1, zb],
                  [x0, y0, zt], [x1, y0, zt], [x1, y1, zt], [x0, y1, zt]]
        faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]
        objs[f"Building-{b['id']}"] = {
            "type": "Building",
            "attributes": {"name": b["name"], "floors_declared": b["floors"],
                           "base_ulpin_2d": PARCEL_ULPIN[b["parcel"]]},
            "geometry": [{"type": "Solid", "lod": "1", "boundaries": [[[[o + i for i in f]] for f in faces]]}]}
    return {"type": "CityJSON", "version": "2.0",
            "metadata": {"title": "SYNTHETIC SIH26011 declared massing",
                         "comment": f"Local metric frame, origin lat={LAT0} lon={LON0}. Synthetic."},
            "CityObjects": objs, "vertices": verts}


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="synthetic_3d_cadastre")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--density", type=float, default=4.0, help="roof points per m^2")
    ap.add_argument("--las", action="store_true", help="also write pointcloud.las (needs laspy)")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    rng = np.random.default_rng(a.seed)
    P = lambda n: os.path.join(a.out, n)

    units = build_units(rng)
    by_legacy = {u["legacy_code"]: u["unit_id"] for u in units}

    write_json(P("parcels.geojson"), fc([feature(r, {
        "parcel_id": k, "base_ulpin_2d": PARCEL_ULPIN[k], "synthetic": True}) for k, r in PARCELS.items()]))
    write_json(P("buildings.geojson"), fc([feature(b["rect"], {
        "building_id": b["id"], "building_name": b["name"], "parcel_id": b["parcel"],
        "base_ulpin_2d": PARCEL_ULPIN[b["parcel"]], "floors_declared": b["floors"],
        "has_basement": b["basement"], "ground_elev_m": b["base_z"],
        "sanctioned_z_max": round(b["base_z"] + b["floors"] * FLOOR_H, 3), "synthetic": True})
        for b in BUILDINGS]))

    write_json(P("units.geojson"), fc([feature(u["rect"], {
        "unit_id": u["unit_id"], "legacy_code": u["legacy_code"], "type": u["type"],
        "building_id": u["building_id"], "parcel_id": u["parcel_id"], "parent_ulpin": u["parent_ulpin"],
        "floor": u["floor"], "unit_number": u["unit_number"], "z_min": u["z_min"], "z_max": u["z_max"],
        "height_meters": u["height_meters"], "provenance": u["source"], "confidence": u["confidence"],
        "z_hash": u["z_hash"]}) for u in units]))

    cols = ["unit_id", "legacy_code", "type", "building_id", "parcel_id", "parent_ulpin", "floor",
            "z_min", "z_max", "provenance", "confidence"]
    keymap = {"provenance": "source"}
    with open_w(P("units.csv")) as f:
        f.write(",".join(cols + ["footprint_wkt"]) + "\n")
        for u in units:
            f.write(",".join(str(u[keymap.get(c, c)]) for c in cols) + f',"{wkt_ll(u["rect"])}"\n')

    spatial = []
    for u in units:
        fl = floor_label(u["floor"])
        spatial.append({
            "id": u["unit_id"], "parent_2d_ulpin": u["parent_ulpin"], "building_id": u["building_id"],
            "floor_number": u["floor"], "unit_number": u["unit_number"], "unit_type": u["type"],
            "name": f"Unit {u['building_id']}-{fl}-{u['unit_number']}",
            "footprint": {"type": "Polygon", "coordinates": [ring_ll(u["rect"])]},
            "z_min": u["z_min"], "z_max": u["z_max"], "height_meters": u["height_meters"],
            "ownership": {"owner_name": f"Owner of {u['unit_id']}",
                          "property_tax_id": f"TAX-MH-{u['building_id']}-{u['floor']}-{u['unit_number']}",
                          "title_deed_number": f"DEED-2026-{u['z_hash']}",
                          "encumbrance_status": "Clear", "occupancy_type": "Freehold"},
            "provenance": {"source_type": u["source"], "sensor_model": SOURCES[u["source"]],
                           "capture_timestamp": u["timestamp"],
                           "processing_agent": "3D-ULPIN-Synthetic-Data-Generator",
                           "verification_status": "CANDIDATE_UNVERIFIED"},
            "confidence_score": u["confidence"],
            "disclaimer": "Prototype 3D ULPIN \u2014 proposed format, candidate spatial unit requiring human "
                          "verification before becoming authoritative (Not an official DoLR/Survey of India standard)."})
    write_json(P("spatial_units.json"), spatial)

    x, y, z, c, k = build_pointcloud(rng, a.density)
    with open_w(P("pointcloud.csv")) as f:
        f.write("x,y,z,classification,kind\n")
        for i in range(len(x)):
            f.write(f"{x[i]:.3f},{y[i]:.3f},{z[i]:.3f},{c[i]},{k[i]}\n")
    if a.las:
        try:
            import laspy
            h = laspy.LasHeader(point_format=3, version="1.2")
            h.scales = np.array([0.001] * 3)
            h.offsets = np.array([0.0, 0.0, BASE_ELEV])
            las = laspy.LasData(h)
            las.x, las.y, las.z, las.classification = x, y, z, c
            las.write(P("pointcloud.las"))
        except ImportError:
            print("laspy not installed -> skipped .las (pip install laspy)")

    cell = 2.0
    xs = np.arange(EXTENT[0], EXTENT[2] + cell, cell)
    ys = np.arange(EXTENT[1], EXTENT[3] + cell, cell)
    with open_w(P("dem.asc")) as f:
        f.write(f"ncols {len(xs)}\nnrows {len(ys)}\nxllcorner {EXTENT[0]}\nyllcorner {EXTENT[1]}\n"
                f"cellsize {cell}\nNODATA_value -9999\n")
        for yy in ys[::-1]:
            f.write(" ".join(f"{dem(xx, yy):.2f}" for xx in xs) + "\n")

    write_json(P("floorplan_claims.json"), {b["id"]: {
        "building_name": b["name"], "floors": b["floors"], "floor_height_m": FLOOR_H,
        "claimed_total_height_m": b["floors"] * FLOOR_H} for b in BUILDINGS})
    write_json(P("buildings.city.json"), cityjson())

    # ground truth (current IDs + legacy cross-reference)
    def ids(*legacy):
        return [by_legacy[l] for l in legacy]

    def issue(i, typ, legacy, detail):
        return {"id": i, "type": typ, "units": ids(*legacy), "legacy_units": list(legacy), "detail": detail}

    b02_units = [u["unit_id"] for u in units if u["building_id"] == "B02"]
    hits = overlaps_3d(units)
    expected = 10
    truth = {
        "note": "Synthetic. Problems deliberately planted in the data. 'units' are current IDs; "
                "'legacy_units' are the original A-F05-U03 style codes (column legacy_code).",
        "issues": [
            issue(1, "invalid_z_range", ["A-F07-U02"], "z_min > z_max"),
            issue(2, "duplicate_volume_overlap", ["A-F05-U03", "A-F05-U03-DUP"],
                  "same flat registered twice (3D overlap)"),
            issue(3, "floor_height_non_monotonic", [f"C-F03-U0{i}" for i in range(1, 5)],
                  "floor 3 recorded 2.0-5.0 m above base, overlapping floors 1 and 2; LiDAR slabs show normal 3 m spacing"),
            issue(4, "true_3d_clash", ["T-01-SEG2", "B-B01"],
                  "metro tunnel intrudes ~1 m into building B02 basement (footprints overlap in 2D too)"),
            issue(5, "unsanctioned_extension", ["D-F04-PH"],
                  "unit above B04 sanctioned height (3 floors); LiDAR confirms a structure there"),
            {"id": 6, "type": "cross_sensor_discrepancy", "building": "B02", "units": b02_units,
             "legacy_units": [u["legacy_code"] for u in units if u["building_id"] == "B02"],
             "detail": f"floor plans claim 24.0 m; LiDAR roof is {B_LIDAR_EXTRA} m higher"}],
        "clean_negatives": ids("U-01", "T-01-SEG1") + [
            "T-01-SEG1 / T-01-SEG2 touch at x=75 but do not overlap"],
        "expected_3d_overlap_pairs": expected,
        "expected_overlap_pairs_ids": [list(h) for h in hits],
    }
    write_json(P("ground_truth.json"), truth)

    print(f"units: {len(units)} | points: {len(x):,} | out: {os.path.abspath(a.out)}")
    print(f"self-check: {len(hits)} 3D-overlapping pairs, expected {expected} ->",
          "OK" if len(hits) == expected else "MISMATCH")


if __name__ == "__main__":
    main()
