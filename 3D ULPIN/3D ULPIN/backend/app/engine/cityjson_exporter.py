"""
OGC CityJSON 1.1 Exporter aligned with ISO 19152 LADM (Land Administration Domain Model).
Converts 3D ULPIN SpatialUnits into interoperable CityJSON 3D City Models.
"""

from typing import List, Dict, Any
from app.models.spatial_unit import SpatialUnit, SpatialUnitType


def export_units_to_cityjson(units: List[SpatialUnit], title: str = "3D ULPIN Cadastre Export") -> Dict[str, Any]:
    """
    Exports a list of 3D ULPIN spatial units into an OGC CityJSON 1.1 structure.
    """
    city_objects: Dict[str, Any] = {}
    vertices: List[List[float]] = []
    vertex_map: Dict[str, int] = {}
    
    def get_vertex_index(x: float, y: float, z: float) -> int:
        key = f"{x:.6f}_{y:.6f}_{z:.2f}"
        if key not in vertex_map:
            vertex_map[key] = len(vertices)
            vertices.append([round(x, 6), round(y, 6), round(z, 2)])
        return vertex_map[key]

    for unit in units:
        coords = unit.footprint.coordinates[0]  # Ring of [lng, lat]
        z_min = unit.z_min
        z_max = unit.z_max
        
        # Build 3D Solid geometry faces
        num_pts = len(coords) - 1  # Last pt is duplicate of first
        
        # Bottom ring vertex indices
        bottom_indices = [get_vertex_index(coords[k][0], coords[k][1], z_min) for k in range(num_pts)]
        # Top ring vertex indices
        top_indices = [get_vertex_index(coords[k][0], coords[k][1], z_max) for k in range(num_pts)]
        
        boundaries = []
        
        # 1. Bottom Face (clockwise)
        boundaries.append([list(reversed(bottom_indices))])
        # 2. Top Face (counter-clockwise)
        boundaries.append([top_indices])
        
        # 3. Side Faces (quads)
        for k in range(num_pts):
            next_k = (k + 1) % num_pts
            b1 = bottom_indices[k]
            b2 = bottom_indices[next_k]
            t2 = top_indices[next_k]
            t1 = top_indices[k]
            boundaries.append([[b1, b2, t2, t1]])

        city_obj_type = "BuildingPart"
        if unit.unit_type in [SpatialUnitType.UTILITY_CORRIDOR, SpatialUnitType.TRANSIT_CORRIDOR]:
            city_obj_type = "GenericCityObject"
        elif unit.unit_type == SpatialUnitType.AIR_RIGHTS:
            city_obj_type = "Building"

        city_objects[unit.id] = {
            "type": city_obj_type,
            "attributes": {
                "3D_ULPIN": unit.id,
                "Parent_2D_ULPIN": unit.parent_2d_ulpin,
                "Building_ID": unit.building_id,
                "Floor_Number": unit.floor_number,
                "Unit_Number": unit.unit_number,
                "Unit_Type": unit.unit_type,
                "Z_Min_MSL": z_min,
                "Z_Max_MSL": z_max,
                "Owner_Name": unit.ownership.owner_name,
                "Property_Tax_ID": unit.ownership.property_tax_id,
                "Title_Deed_Number": unit.ownership.title_deed_number,
                "ISO19152_LADM_Class": "LA_SpatialUnit3D",
                "ISO19152_LegalSpaceType": "LA_LegalSpaceBuildingUnit",
                "Confidence_Score": unit.confidence_score,
                "Disclaimer": unit.disclaimer
            },
            "geometry": [{
                "type": "Solid",
                "lod": "2.0",
                "boundaries": [boundaries]
            }]
        }

    return {
        "type": "CityJSON",
        "version": "1.1",
        "metadata": {
            "title": title,
            "referenceSystem": "urn:ogc:def:crs:EPSG::4326",
            "extent": [73.85, 18.51, 480.0, 73.86, 18.53, 540.0],
            "iso_19152_ladm_compliant": True,
            "governance_note": "Candidate 3D Land Cadastre Units for SIH 2026 Problem SIH26011"
        },
        "CityObjects": city_objects,
        "vertices": vertices
    }
