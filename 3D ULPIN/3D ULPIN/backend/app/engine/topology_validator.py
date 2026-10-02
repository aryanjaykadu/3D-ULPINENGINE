"""
3D Topology & Consistency Validation Engine.
Detects vertical, horizontal, volumetric, monotonicity, and sensor discrepancies in 3D spatial units.
"""

from typing import List, Dict, Any, Tuple, Optional
from shapely.geometry import shape, Polygon
from app.models.spatial_unit import SpatialUnit, TopologyValidationReport, TopologyValidationError


def validate_3d_topology(units: List[SpatialUnit], claimed_height_map: Optional[Dict[str, float]] = None) -> TopologyValidationReport:
    """
    Performs comprehensive 3D spatial topology and consistency checks:
    1. Z-Range Integrity (z_min < z_max)
    2. Horizontal Footprint Overlap among sibling units on the same floor
    3. True 3D Volumetric Overlap (2D Footprint Intersection AND Z-range overlap)
    4. Floor Height Monotonicity across building levels
    5. Cross-Sensor Discrepancy (LiDAR / DSM height vs. claimed CAD height)
    """
    errors: List[TopologyValidationError] = []
    
    # Convert GeoJSON footprints to Shapely Polygons for fast geometry math
    shapely_units = []
    for u in units:
        try:
            poly = shape(u.footprint.model_dump())
            shapely_units.append((u, poly))
        except Exception as e:
            errors.append(TopologyValidationError(
                error_code="INVALID_GEOMETRY",
                severity="CRITICAL",
                target_unit_id=u.id,
                message=f"Invalid GeoJSON footprint polygon: {str(e)}"
            ))

    # Check 1: Z-Range Integrity (z_min < z_max)
    for u, poly in shapely_units:
        if u.z_min >= u.z_max:
            errors.append(TopologyValidationError(
                error_code="Z_INVALID",
                severity="CRITICAL",
                target_unit_id=u.id,
                message=f"Invalid Z-span: z_min ({u.z_min}m) >= z_max ({u.z_max}m)."
            ))
            
    # Group units by building_id and floor_number for sibling checks
    building_groups: Dict[str, Dict[int, List[Tuple[SpatialUnit, Polygon]]]] = {}
    for u, poly in shapely_units:
        b_id = u.building_id
        f_num = u.floor_number
        if b_id not in building_groups:
            building_groups[b_id] = {}
        if f_num not in building_groups[b_id]:
            building_groups[b_id][f_num] = []
        building_groups[b_id][f_num].append((u, poly))

    # Check 2: Horizontal Footprint Overlaps between sibling units (same floor)
    for b_id, floors in building_groups.items():
        for f_num, sibling_list in floors.items():
            for i in range(len(sibling_list)):
                for j in range(i + 1, len(sibling_list)):
                    u1, poly1 = sibling_list[i]
                    u2, poly2 = sibling_list[j]
                    
                    if poly1.intersects(poly2):
                        inter_area = poly1.intersection(poly2).area
                        if inter_area > 0.01:  # ignore sub-centimeter floating noise
                            errors.append(TopologyValidationError(
                                error_code="SIBLING_OVERLAP",
                                severity="CRITICAL",
                                target_unit_id=u1.id,
                                conflicting_unit_id=u2.id,
                                message=(
                                    f"Horizontal overlap detected between sibling units on floor {f_num} "
                                    f"({u1.id} and {u2.id}). Overlap area: {round(inter_area, 2)} sq.m"
                                )
                            ))

    # Check 3: True 3D Volumetric Overlaps across ALL units (e.g. underground metro vs basement)
    for i in range(len(shapely_units)):
        for j in range(i + 1, len(shapely_units)):
            u1, poly1 = shapely_units[i]
            u2, poly2 = shapely_units[j]
            
            # Skip if sibling check already flagged them on same floor
            if u1.building_id == u2.building_id and u1.floor_number == u2.floor_number:
                continue

            # Check Z-range intersection
            z_overlap_min = max(u1.z_min, u2.z_min)
            z_overlap_max = min(u1.z_max, u2.z_max)
            
            if z_overlap_min < z_overlap_max:  # Vertical span overlaps
                if poly1.intersects(poly2):     # 2D footprint overlaps
                    inter_poly = poly1.intersection(poly2)
                    inter_area = inter_poly.area
                    if inter_area > 0.01:
                        overlap_vol = inter_area * (z_overlap_max - z_overlap_min)
                        errors.append(TopologyValidationError(
                            error_code="VOLUMETRIC_CLIPPING",
                            severity="CRITICAL",
                            target_unit_id=u1.id,
                            conflicting_unit_id=u2.id,
                            message=(
                                f"3D Volumetric Overlap detected! Unit '{u1.name}' ({u1.id}) clips into "
                                f"Unit '{u2.name}' ({u2.id}). Overlap volume: {round(overlap_vol, 2)} m³."
                            ),
                            overlap_volume_m3=round(overlap_vol, 2)
                        ))

    # Check 4: Floor Height Monotonicity across a building
    for b_id, floors in building_groups.items():
        sorted_floors = sorted(floors.keys())
        for idx in range(len(sorted_floors) - 1):
            f_lower = sorted_floors[idx]
            f_upper = sorted_floors[idx + 1]
            
            max_z_lower = max(u.z_max for u, _ in floors[f_lower])
            min_z_upper = min(u.z_min for u, _ in floors[f_upper])
            
            if min_z_upper < max_z_lower - 0.05:  # Upper floor starts below lower floor top
                unit_lower = floors[f_lower][0][0]
                unit_upper = floors[f_upper][0][0]
                errors.append(TopologyValidationError(
                    error_code="MONOTONICITY_VIOLATION",
                    severity="WARNING",
                    target_unit_id=unit_upper.id,
                    conflicting_unit_id=unit_lower.id,
                    message=(
                        f"Floor monotonicity error in Building {b_id}: Floor {f_upper} z_min ({min_z_upper}m) "
                        f"is lower than Floor {f_lower} z_max ({max_z_lower}m)."
                    )
                ))

    # Check 5: Cross-Sensor Discrepancies (LiDAR DSM vs claimed CAD height)
    if claimed_height_map:
        for u, _ in shapely_units:
            if u.id in claimed_height_map:
                claimed = claimed_height_map[u.id]
                measured = u.height_meters
                discrepancy = abs(measured - claimed)
                if discrepancy > 0.5:  # > 50 cm discrepancy
                    errors.append(TopologyValidationError(
                        error_code="SENSOR_DISCREPANCY",
                        severity="WARNING",
                        target_unit_id=u.id,
                        message=(
                            f"Sensor height discrepancy for {u.id}: LiDAR measured height ({round(measured, 2)}m) "
                            f"differs from claimed floor plan height ({round(claimed, 2)}m) by {round(discrepancy, 2)}m."
                        )
                    ))

    critical_count = sum(1 for e in errors if e.severity == "CRITICAL")
    warning_count = sum(1 for e in errors if e.severity == "WARNING")
    
    return TopologyValidationReport(
        total_units_checked=len(units),
        is_valid=(critical_count == 0),
        critical_errors=critical_count,
        warnings=warning_count,
        errors=errors
    )
