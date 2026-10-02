"""
Spatial Unit Data Models for 3D ULPIN Generation & Vertical Property Mapping System.
Aligned with ISO 19152 (Land Administration Domain Model - LADM 3D Extension).
"""

from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class SpatialUnitType(str, Enum):
    SURFACE_PARCEL = "surface_parcel"
    APARTMENT = "apartment"
    BASEMENT = "basement"
    UTILITY_CORRIDOR = "utility_corridor"
    TRANSIT_CORRIDOR = "transit_corridor"
    PARKING_SLOT = "parking_slot"
    AIR_RIGHTS = "air_rights"


class GeoJSONPolygon(BaseModel):
    type: str = "Polygon"
    coordinates: List[List[List[float]]]  # [[[lng, lat], [lng, lat], ...]]


class OwnershipMetadata(BaseModel):
    owner_name: str = "Government / Unassigned"
    property_tax_id: Optional[str] = None
    title_deed_number: Optional[str] = None
    encumbrance_status: str = "Clear"
    occupancy_type: str = "Freehold"


class ProvenanceMetadata(BaseModel):
    source_type: str = "LiDAR / Drone Mesh"  # drone, lidar, cad_floor_plan, dem, manual_gnss
    sensor_model: str = "DJI Zenmuse L1 / Simulated CORS"
    capture_timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    processing_agent: str = "3D-ULPIN-AI-Engine-v1.0"
    verification_status: str = "CANDIDATE_UNVERIFIED"


class SpatialUnit(BaseModel):
    id: str  # Deterministic 3D ULPIN e.g. 14MH27042910-B01-F03-U02-Z0412
    parent_2d_ulpin: str  # 14-digit base 2D ULPIN e.g. 14MH27042910
    building_id: str  # e.g. B01
    floor_number: int  # e.g. -2, -1, 0, 1, 2, 3...
    unit_number: str  # e.g. U01, UTIL-01, METRO-01, AIR-01
    unit_type: SpatialUnitType
    name: str
    
    # Footprint & Vertical Span
    footprint: GeoJSONPolygon
    z_min: float  # meters relative to MSL / Datum
    z_max: float  # meters relative to MSL / Datum
    height_meters: float  # calculated z_max - z_min
    
    # Metadata & Governance
    ownership: OwnershipMetadata
    provenance: ProvenanceMetadata
    confidence_score: float = Field(ge=0.0, le=1.0, default=0.95)
    disclaimer: str = (
        "Prototype 3D ULPIN — proposed format, candidate spatial unit "
        "requiring human verification before becoming authoritative (Not an official DoLR/Survey of India standard)."
    )


class TopologyValidationError(BaseModel):
    error_code: str  # Z_INVALID, SIBLING_OVERLAP, VOLUMETRIC_CLIPPING, MONOTONICITY_VIOLATION, SENSOR_DISCREPANCY
    severity: str  # CRITICAL, WARNING, INFO
    target_unit_id: str
    conflicting_unit_id: Optional[str] = None
    message: str
    overlap_volume_m3: Optional[float] = None


class TopologyValidationReport(BaseModel):
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    total_units_checked: int
    is_valid: bool
    critical_errors: int
    warnings: int
    errors: List[TopologyValidationError]
