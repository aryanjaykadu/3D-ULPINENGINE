"""
FastAPI Server for 3D ULPIN Engine & Vertical Property Mapping System.
Problem Statement SIH26011 (Smart India Hackathon 2026).
"""

from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.models.spatial_unit import (
    SpatialUnit,
    SpatialUnitType,
    TopologyValidationReport,
    OwnershipMetadata,
    ProvenanceMetadata,
    GeoJSONPolygon
)
from app.engine.ulpin_generator import generate_3d_ulpin, parse_3d_ulpin, DISCLAIMER_TEXT
from app.engine.topology_validator import validate_3d_topology
from app.engine.ai_pipeline import (
    extract_building_footprints_from_dsm,
    segment_floors_from_point_cloud,
    delineate_vertical_parcels
)
from app.engine.cityjson_exporter import export_units_to_cityjson
from app.data.synthetic_dataset import generate_synthetic_3d_dataset


app = FastAPI(
    title="3D ULPIN Engine API — SIH26011 Prototype",
    description=(
        "API for 3D Unique Land Parcel Identification Number (ULPIN) generation, "
        "vertical property mapping, AI building extraction, point cloud floor segmentation, "
        "and 3D topology validation.\n\n"
        "**Disclaimer**: Prototype 3D ULPIN — proposed format, candidate spatial unit "
        "requiring human verification before becoming authoritative (Not an official DoLR/Survey of India standard)."
    ),
    version="1.0.0"
)

# Enable CORS for frontend connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory spatial unit database loaded with synthetic dataset seed
IN_MEMORY_DB: Dict[str, SpatialUnit] = {}


@app.on_event("startup")
def load_initial_dataset():
    """Seeds the in-memory dataset on server startup."""
    seed_units = generate_synthetic_3d_dataset()
    for unit in seed_units:
        IN_MEMORY_DB[unit.id] = unit
    print(f"Loaded {len(IN_MEMORY_DB)} 3D ULPIN spatial units into memory.")


# --- DTO Models for API ---
class GenerateUlpinRequest(BaseModel):
    parent_2d_ulpin: str
    building_id: str
    floor_number: int
    unit_number: str
    unit_type: SpatialUnitType = SpatialUnitType.APARTMENT
    unit_name: str
    footprint_coords: List[List[float]]  # [[lng, lat], ...]
    z_min: float
    z_max: float
    owner_name: Optional[str] = "Govt / Candidate Owner"
    source_type: Optional[str] = "Drone Mesh / Manual"


class FloorSegmentationRequest(BaseModel):
    z_min_base: float = 500.0
    building_height: float = 24.0
    floor_height: float = 3.2
    has_basement: bool = True


class VerticalDelineationRequest(BaseModel):
    parent_2d_ulpin: str
    building_id: str
    building_name: str
    footprint_coords: List[List[float]]
    building_height: float = 19.2
    floor_height: float = 3.2
    units_per_floor: int = 2
    has_basement: bool = True


# --- API Endpoints ---

@app.get("/")
def root():
    return {
        "status": "online",
        "system": "3D ULPIN Engine (SIH26011)",
        "total_units": len(IN_MEMORY_DB),
        "disclaimer": DISCLAIMER_TEXT
    }


@app.get("/units", response_model=List[SpatialUnit])
def get_spatial_units(
    building_id: Optional[str] = Query(None, description="Filter by Building ID e.g. B01"),
    unit_type: Optional[SpatialUnitType] = Query(None, description="Filter by unit type"),
    floor_number: Optional[int] = Query(None, description="Filter by floor number")
):
    """Retrieve all 3D spatial units with optional filters."""
    result = list(IN_MEMORY_DB.values())
    if building_id:
        result = [u for u in result if u.building_id.upper() == building_id.upper()]
    if unit_type:
        result = [u for u in result if u.unit_type == unit_type]
    if floor_number is not None:
        result = [u for u in result if u.floor_number == floor_number]
    return result


@app.get("/ulpin/{id}")
def get_ulpin_by_id(id: str):
    """Retrieve spatial unit, ownership metadata, and provenance by 3D ULPIN ID."""
    clean_id = id.strip().upper()
    if clean_id not in IN_MEMORY_DB:
        # Check if valid format even if not in DB
        parsed = parse_3d_ulpin(clean_id)
        if parsed["is_valid_format"]:
            return {
                "in_database": False,
                "parsed_structure": parsed,
                "disclaimer": DISCLAIMER_TEXT
            }
        raise HTTPException(status_code=404, detail="3D ULPIN ID not found in cadastre store.")
    
    unit = IN_MEMORY_DB[clean_id]
    parsed_struct = parse_3d_ulpin(clean_id)
    return {
        "in_database": True,
        "spatial_unit": unit,
        "parsed_structure": parsed_struct,
        "disclaimer": DISCLAIMER_TEXT
    }


@app.post("/ulpin/generate")
def generate_ulpin_endpoint(req: GenerateUlpinRequest):
    """Generate a 3D ULPIN for a given vertical unit geometry and save to store."""
    ulpin_id, z_hash = generate_3d_ulpin(
        parent_2d_ulpin=req.parent_2d_ulpin,
        building_id=req.building_id,
        floor_number=req.floor_number,
        unit_number=req.unit_number,
        footprint_coords=req.footprint_coords,
        z_min=req.z_min,
        z_max=req.z_max
    )
    
    # Ensure coords loop is closed
    coords = req.footprint_coords
    if coords[0] != coords[-1]:
        coords.append(coords[0])

    unit = SpatialUnit(
        id=ulpin_id,
        parent_2d_ulpin=req.parent_2d_ulpin,
        building_id=req.building_id.upper(),
        floor_number=req.floor_number,
        unit_number=req.unit_number.upper(),
        unit_type=req.unit_type,
        name=req.unit_name,
        footprint=GeoJSONPolygon(coordinates=[coords]),
        z_min=round(req.z_min, 2),
        z_max=round(req.z_max, 2),
        height_meters=round(req.z_max - req.z_min, 2),
        ownership=OwnershipMetadata(
            owner_name=req.owner_name or "Govt / Candidate Owner",
            property_tax_id=f"TAX-MH-{req.building_id}-{req.floor_number}-{req.unit_number}",
            title_deed_number=f"DEED-2026-{z_hash}"
        ),
        provenance=ProvenanceMetadata(
            source_type=req.source_type or "Drone Mesh / Manual GIS",
            verification_status="CANDIDATE_UNVERIFIED"
        ),
        confidence_score=0.95
    )
    
    IN_MEMORY_DB[ulpin_id] = unit
    return {
        "message": "3D ULPIN generated and saved successfully",
        "ulpin_3d": ulpin_id,
        "z_hash": z_hash,
        "spatial_unit": unit
    }


@app.post("/processing/building-extraction")
def building_extraction_endpoint():
    """Runs automated building extraction from DSM/point-cloud raster data."""
    buildings = extract_building_footprints_from_dsm()
    return {
        "status": "SUCCESS",
        "buildings_extracted": len(buildings),
        "data": buildings,
        "disclaimer": DISCLAIMER_TEXT
    }


@app.post("/processing/floor-segmentation")
def floor_segmentation_endpoint(req: FloorSegmentationRequest):
    """Performs point-cloud height histogram clustering to segment floor slabs."""
    slabs = segment_floors_from_point_cloud(
        z_min_base=req.z_min_base,
        building_height=req.building_height,
        floor_height=req.floor_height,
        has_basement=req.has_basement
    )
    return {
        "status": "SUCCESS",
        "total_slabs_detected": len(slabs),
        "floor_slabs": [
            {"floor_number": f, "z_min": round(z1, 2), "z_max": round(z2, 2)}
            for f, z1, z2 in slabs
        ]
    }


@app.post("/processing/vertical-delineation")
def vertical_delineation_endpoint(req: VerticalDelineationRequest):
    """Executes full automated pipeline: floor segmentation + vertical slicing + 3D ULPIN generation."""
    slabs = segment_floors_from_point_cloud(
        z_min_base=500.0,
        building_height=req.building_height,
        floor_height=req.floor_height,
        has_basement=req.has_basement
    )
    
    new_units = delineate_vertical_parcels(
        parent_2d_ulpin=req.parent_2d_ulpin,
        building_id=req.building_id,
        building_name=req.building_name,
        footprint_coords=req.footprint_coords,
        floors_slabs=slabs,
        units_per_floor=req.units_per_floor
    )
    
    for u in new_units:
        IN_MEMORY_DB[u.id] = u

    return {
        "status": "SUCCESS",
        "units_generated": len(new_units),
        "spatial_units": new_units
    }


@app.post("/validate/topology", response_model=TopologyValidationReport)
def validate_topology_endpoint():
    """Runs 3D topology & consistency validation on all units in the cadastre database."""
    units = list(IN_MEMORY_DB.values())
    report = validate_3d_topology(units)
    return report


@app.get("/export/cityjson")
def export_cityjson_endpoint():
    """Exports all 3D ULPIN units into valid OGC CityJSON 1.1 / ISO 19152 format."""
    units = list(IN_MEMORY_DB.values())
    cityjson_doc = export_units_to_cityjson(units)
    return cityjson_doc
