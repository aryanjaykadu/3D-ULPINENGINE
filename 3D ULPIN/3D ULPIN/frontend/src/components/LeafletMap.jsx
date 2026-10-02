import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function LeafletMap({
  units = [],
  selectedUnit = null,
  onSelectUnit = () => {}
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const geojsonLayerRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Prevent double init

    // Initialize Leaflet Map centered on Pune parcel site
    const map = L.map(mapContainerRef.current, {
      center: [18.5204, 73.8567],
      zoom: 17,
      zoomControl: false
    });

    // Dark CartoDB Tile Layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update GeoJSON Polygons when units or selectedUnit changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (geojsonLayerRef.current) {
      map.removeLayer(geojsonLayerRef.current);
      geojsonLayerRef.current = null;
    }

    if (!units || units.length === 0) return;

    // Group units by base 2D footprint to render 2D ground parcels
    const uniqueFootprints = [];
    const seenHashes = new Set();

    units.forEach((u) => {
      const key = `${u.parent_2d_ulpin}_${u.building_id}_${u.floor_number}`;
      if (!seenHashes.has(key)) {
        seenHashes.add(key);
        uniqueFootprints.push(u);
      }
    });

    const geojsonData = {
      type: 'FeatureCollection',
      features: uniqueFootprints.map((u) => ({
        type: 'Feature',
        geometry: u.footprint,
        properties: {
          id: u.id,
          parent_2d_ulpin: u.parent_2d_ulpin,
          building_id: u.building_id,
          floor_number: u.floor_number,
          unit_type: u.unit_type,
          name: u.name,
          unit: u
        }
      }))
    };

    const layer = L.geoJSON(geojsonData, {
      style: (feature) => {
        const u = feature.properties.unit;
        const isSelected = selectedUnit && selectedUnit.id === u.id;
        
        let strokeColor = '#38bdf8';
        let fillColor = '#0284c7';

        if (u.unit_type === 'transit_corridor') {
          strokeColor = '#f43f5e';
          fillColor = '#e11d48';
        } else if (u.unit_type === 'basement') {
          strokeColor = '#fbbf24';
          fillColor = '#d97706';
        } else if (u.unit_type === 'air_rights') {
          strokeColor = '#34d399';
          fillColor = '#10b981';
        }

        if (isSelected) {
          strokeColor = '#00f0ff';
          fillColor = '#38bdf8';
        }

        return {
          color: strokeColor,
          weight: isSelected ? 3 : 1.5,
          opacity: isSelected ? 1.0 : 0.7,
          fillColor: fillColor,
          fillOpacity: isSelected ? 0.6 : 0.35
        };
      },
      onEachFeature: (feature, featureLayer) => {
        const props = feature.properties;
        featureLayer.bindTooltip(
          `<div><strong>${props.name}</strong><br/><span style="font-family: monospace; font-size:11px; color:#38bdf8">${props.id}</span></div>`,
          { sticky: true }
        );
        featureLayer.on({
          click: () => {
            onSelectUnit(props.unit);
          }
        });
      }
    }).addTo(map);

    geojsonLayerRef.current = layer;
  }, [units, selectedUnit]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      <div
        className="glass-pill"
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          zIndex: 1000,
          color: 'var(--text-muted)',
          fontSize: '0.7rem'
        }}
      >
        2D Base GIS Footprints (Synced)
      </div>
    </div>
  );
}
