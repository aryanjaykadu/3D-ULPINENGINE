"""
Deterministic 3D ULPIN Generation & Parsing Engine.
Extends 14-digit 2D Bhu-Aadhaar ULPIN with structured vertical segments.

Format Specification:
<Base-2D-ULPIN>-B<BuildingID>-F<FloorSegment>-U<UnitSegment>-Z<ZHash>
Example: 14MH27042910-B01-F03-U02-Z0412
"""

import hashlib
import re
from typing import Dict, Any, Tuple
from shapely.geometry import shape, Polygon


DISCLAIMER_TEXT = (
    "Prototype 3D ULPIN — proposed format, candidate spatial unit "
    "requiring human verification before becoming authoritative (Not an official DoLR/Survey of India standard)."
)


def generate_z_hash(parent_2d_ulpin: str, footprint_coords: list, z_min: float, z_max: float) -> str:
    """
    Computes a 4-character deterministic hex hash from parent 2D ULPIN, footprint geometry, and elevation bounds.
    """
    # Normalize coordinates to 6 decimal places to prevent floating point inaccuracies
    pts = footprint_coords
    if len(pts) > 0 and isinstance(pts[0], list) and len(pts[0]) > 0 and isinstance(pts[0][0], list):
        pts = pts[0]  # unwrap extra outer ring list if present
        
    normalized_coords = [
        [round(pt[0], 6), round(pt[1], 6)] for pt in pts
    ]
    spatial_signature = f"{parent_2d_ulpin}:{normalized_coords}:{round(z_min, 2)}:{round(z_max, 2)}"
    sha = hashlib.sha256(spatial_signature.encode('utf-8')).hexdigest()
    return sha[:4].upper()


def format_floor_segment(floor_number: int) -> str:
    """Formats floor number into structured F segment (e.g. F00, F03, FB1 for Basement 1, FAIR for Air Rights)."""
    if floor_number < 0:
        return f"FB{abs(floor_number)}"
    elif floor_number == 99:
        return "FAIR"
    else:
        return f"F{floor_number:02d}"


def generate_3d_ulpin(
    parent_2d_ulpin: str,
    building_id: str,
    floor_number: int,
    unit_number: str,
    footprint_coords: list,
    z_min: float,
    z_max: float
) -> Tuple[str, str]:
    """
    Generates a deterministic 3D ULPIN string.
    Returns (3d_ulpin_id, z_hash).
    """
    # Clean parent ULPIN
    base_ulpin = parent_2d_ulpin.strip().upper()
    if len(base_ulpin) < 14:
        # Pad to 14 chars if shorter for prototype safety
        base_ulpin = base_ulpin.ljust(14, '0')
    
    # Format segments
    b_seg = building_id.upper() if building_id.upper().startswith('B') else f"B{building_id.zfill(2)}"
    f_seg = format_floor_segment(floor_number)
    u_seg = unit_number.upper() if unit_number.upper().startswith('U') else f"U{unit_number.zfill(2)}"
    
    z_hash = generate_z_hash(base_ulpin, footprint_coords, z_min, z_max)
    
    ulpin_3d = f"{base_ulpin}-{b_seg}-{f_seg}-{u_seg}-Z{z_hash}"
    return ulpin_3d, z_hash


def parse_3d_ulpin(ulpin_3d: str) -> Dict[str, Any]:
    """
    Parses a 3D ULPIN into its constituent components.
    """
    pattern = r"^([A-Z0-9]{14})-(B\d+)-(F[B\d]{1,3}|FAIR)-(U[A-Z0-9]+)-Z([A-F0-9]{4})$"
    match = re.match(pattern, ulpin_3d.strip().upper())
    
    if not match:
        return {
            "is_valid_format": False,
            "raw_id": ulpin_3d,
            "disclaimer": DISCLAIMER_TEXT
        }
    
    base_ulpin, b_seg, f_seg, u_seg, z_hash = match.groups()
    
    # Parse floor number
    if f_seg.startswith("FB"):
        floor_num = -int(f_seg[2:])
    elif f_seg == "FAIR":
        floor_num = 99
    else:
        floor_num = int(f_seg[1:])
        
    return {
        "is_valid_format": True,
        "raw_id": ulpin_3d,
        "parent_2d_ulpin": base_ulpin,
        "building_id": b_seg,
        "floor_segment": f_seg,
        "floor_number": floor_num,
        "unit_segment": u_seg,
        "z_hash": z_hash,
        "disclaimer": DISCLAIMER_TEXT
    }
