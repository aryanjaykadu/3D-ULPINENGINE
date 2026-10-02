# 3D ULPIN Engine & Vertical Property Mapping System
**Smart India Hackathon 2026 Prototype**  
**Problem Statement SIH26011**: *3D ULPIN Generation and Vertical Property Mapping System*  
**Ministry**: Ministry of Rural Development — Department of Land Resources (DoLR)  
**Theme**: Space Technology / DILRMP  

---

## 📌 Problem Context & Solution Vision
India's existing 14-digit **ULPIN** (Unique Land Parcel Identification Number, aka "Bhu-Aadhaar") identifies 2D surface ground footprint boundaries. It cannot represent ownership of individual apartment floors, subterranean basements, underground metro transit corridors, utility networks, elevated expressways, or air-rights airspace volumes.

The **3D ULPIN Engine** extends India's land administration into the vertical (Z) dimension with:
1. **Deterministic 3D ULPIN Generation**: Structured extension appending vertical floor, unit, and Z-span hash segments.
2. **3D Topology & Volumetric Overlap Validator**: Detects horizontal footprint overlaps, height monotonicity errors, and true 3D volumetric clipping (e.g. underground metro tunnel clipping into a private basement).
3. **AI/ML Ingestion Pipeline**: Automated building footprint extraction from elevation rasters + point-cloud height histogram clustering for floor slab segmentation.
4. **Interactive 3D Digital Twin & 2D GIS Map**: WebGL Three.js volumetric rendering synchronized with a 2D Leaflet parcel map.
5. **OGC CityJSON & ISO 19152 LADM Export**: Interoperable cadastre export to open standards.

---

## 🏷️ 3D ULPIN ID Format Specification
```
<Base-2D-ULPIN>-B<BuildingID>-F<FloorNumber>-U<UnitNumber>-Z<zmin_zmax_hash>
```
*Example*: `14MH27042910-B01-F03-U02-Z0412`

- **Base 2D ULPIN**: 14-digit ground parcel ID (e.g. `14MH27042910`)
- **Building ID**: `B01` (Building structure identifier)
- **Floor Segment**: `F03` (Floor 3), `FB1` (Basement 1), `FAIR` (Air Rights)
- **Unit Segment**: `U02` (Unit number)
- **Z-Span Deterministic Hash**: SHA-256 of `(parent_ulpin + footprint_wkt + z_min + z_max)` truncated to 4 uppercase hex characters. Same spatial volume always regenerates the identical ID.

> **Governance Disclaimer**: All generated IDs are explicitly labeled:  
> *"Prototype 3D ULPIN — proposed format, candidate spatial unit requiring human verification before becoming authoritative (Not an official DoLR/Survey of India standard)."*

---

## 🛠️ Tech Stack Defaults
- **Backend API**: Python 3.13 + FastAPI + Uvicorn + Pydantic v2 + Shapely (3D spatial math) + GeoPandas + NumPy
- **Frontend Dashboard**: React + Vite + Three.js (WebGL Volumetric Twin) + Leaflet (2D GIS Map) + Lucide Icons
- **Data Model**: In-Memory Spatial Index + SQLite / GeoJSON (Aligned with ISO 19152 LADM 3D Extension)

---

## 🚀 Quickstart & Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js v18+ & npm

### 1. Run Backend API Server
```bash
# Navigate to backend directory
cd backend

# Install Python GIS dependencies
python -m pip install -r requirements.txt

# Launch FastAPI server on http://localhost:8000
python run.py
```
*Backend API Documentation (Swagger UI) is available at http://localhost:8000/docs*

### 2. Run Frontend 3D Digital Twin Dashboard
```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install Node modules
npm install

# Start Vite dev server on http://localhost:3000
npm run dev
```
Open your browser at **http://localhost:3000** to view the 3D Digital Twin GIS Dashboard.

---

## 🧪 Key Demo Scenarios to Test in UI

1. **Underground Metro Tunnel vs. Private Basement 3D Overlap**:
   - Open the **Validation & AI** drawer on the right sidebar.
   - Click **Run 3D Topology & Overlap Check**.
   - Observe the critical error flag: `VOLUMETRIC_CLIPPING` between Pune Metro Line 3 Underground Tunnel (`14MH27042911-B99-FB2-UMETRO01-Z...`) and Shree Ram Heights Basement 1. The calculated overlap volume (m³) is displayed and highlighted in crimson red in the 3D viewer!

2. **Search by 3D ULPIN**:
   - Enter `14MH27042910-B01-F03-U02-Z0412` into the top search bar.
   - The system parses the structured segments, highlights Flat U02 on Floor 3 in both 3D & 2D views, and loads its property tax deed and sensor audit trail.

3. **OGC CityJSON Export**:
   - Click **Export OGC CityJSON (ISO 19152)** in the inspector panel to download a valid 3D CityJSON 1.1 model file.

4. **AI Processing Pipeline Simulation**:
   - In the **Validation & AI** tab, click **1. Automated Building Extraction** or **2. Point-Cloud Height Histogram Floor Segmentation** to inspect raw AI model outputs.

---

## 📄 File Structure
```
3D ULPIN/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI server & endpoints
│   │   ├── models/spatial_unit.py      # SpatialUnit & Topology Pydantic models
│   │   ├── engine/ulpin_generator.py   # Deterministic 3D ULPIN hash algorithm
│   │   ├── engine/topology_validator.py# 3D spatial overlap & Z integrity validator
│   │   ├── engine/ai_pipeline.py       # Building extraction & floor segmentation
│   │   ├── engine/cityjson_exporter.py # ISO 19152 LADM / CityJSON 1.1 exporter
│   │   └── data/synthetic_dataset.py   # Sample 3D seed dataset
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── App.jsx                     # Main dashboard layout
│   │   ├── components/ThreeViewer.jsx  # Three.js 3D WebGL volumetric digital twin
│   │   ├── components/LeafletMap.jsx   # 2D Leaflet GIS parcel map
│   │   ├── components/UlpinInspector.jsx # 3D ULPIN metadata inspector & audit log
│   │   ├── components/ValidationPanel.jsx# AI pipeline & 3D topology dashboard
│   │   └── components/GovernanceBanner.jsx # Top header & disclaimer banner
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── SIH26011_WRITEUP.md                  # SIH 2026 Problem Statement mapping report
└── README.md
```
