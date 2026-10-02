const API_BASE = '/api';

export async function fetchUnits(buildingId, unitType, floorNumber) {
  let url = `${API_BASE}/units`;
  const params = new URLSearchParams();
  if (buildingId) params.append('building_id', buildingId);
  if (unitType) params.append('unit_type', unitType);
  if (floorNumber !== undefined && floorNumber !== null) params.append('floor_number', floorNumber);
  
  if (params.toString()) url += `?${params.toString()}`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch spatial units');
  return res.json();
}

export async function fetchUlpinDetails(id) {
  const res = await fetch(`${API_BASE}/ulpin/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Failed to fetch 3D ULPIN details');
  return res.json();
}

export async function generate3DUlpin(payload) {
  const res = await fetch(`${API_BASE}/ulpin/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to generate 3D ULPIN');
  return res.json();
}

export async function runBuildingExtraction() {
  const res = await fetch(`${API_BASE}/processing/building-extraction`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed building extraction');
  return res.json();
}

export async function runFloorSegmentation(params = {}) {
  const res = await fetch(`${API_BASE}/processing/floor-segmentation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!res.ok) throw new Error('Failed floor segmentation');
  return res.json();
}

export async function runTopologyValidation() {
  const res = await fetch(`${API_BASE}/validate/topology`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed topology validation');
  return res.json();
}

export async function fetchCityJsonExport() {
  const res = await fetch(`${API_BASE}/export/cityjson`);
  if (!res.ok) throw new Error('Failed CityJSON export');
  return res.json();
}
