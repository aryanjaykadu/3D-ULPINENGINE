"""
Synthetic Multi-Story 3D Cadastre Dataset Generator for SIH 2026 Problem SIH26011.
Includes:
- Residential Tower (B01) with 6 floors + basement
- Commercial Building (B02) with 4 floors
- Underground Metro Tunnel Conflict (Clips into Basement 1 of B01)
- Elevated Transit Corridor (Overhead Metro Line)
- Air Rights Volume (Solar/Height Corridor above B01)
- Underground Utility Duct (Water/Fiber optic pipe)
"""

import json
import os
from typing import List
from app.models.spatial_unit import SpatialUnit, SpatialUnitType, OwnershipMetadata, ProvenanceMetadata

def generate_synthetic_3d_dataset() -> List[SpatialUnit]:
    file_path = os.path.join(os.path.dirname(__file__), "synthetic_v2", "spatial_units.json")
    units = []
    
    if not os.path.exists(file_path):
        print(f"Warning: Synthetic data file not found at {file_path}")
        return units
        
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    for item in data:
        try:
            unit = SpatialUnit(**item)
            units.append(unit)
        except Exception as e:
            print(f"Error parsing spatial unit {item.get('id')}: {e}")
            
    return units
