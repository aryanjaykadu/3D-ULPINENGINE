import React, { useState, useEffect } from 'react';
import GovernanceBanner from './components/GovernanceBanner';
import ThreeViewer from './components/ThreeViewer';
import LeafletMap from './components/LeafletMap';
import UlpinInspector from './components/UlpinInspector';
import ValidationPanel from './components/ValidationPanel';
import { fetchUnits, fetchUlpinDetails } from './utils/api';
import { Box, Map as MapIcon, ShieldCheck, AlertOctagon, Layers, RefreshCw } from 'lucide-react';

export default function App() {
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [topologyErrors, setTopologyErrors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('inspector'); // 'inspector' or 'validation'
  const [viewMode, setViewMode] = useState('split'); // 'split', '3d', '2d'

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUnits();
      setUnits(data);
      if (data.length > 0 && !selectedUnit) {
        setSelectedUnit(data[0]); // Default select first residential flat
      }
    } catch (err) {
      console.error('Failed to load spatial units:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearchUlpin = async (queryId) => {
    try {
      const res = await fetchUlpinDetails(queryId);
      if (res.in_database) {
        setSelectedUnit(res.spatial_unit);
        setActiveTab('inspector');
      } else if (res.parsed_structure && res.parsed_structure.is_valid_format) {
        alert(`Found valid 3D ULPIN format structure for ${queryId}, but it is not currently seeded in the active cadastre spatial store.`);
      } else {
        alert(`Invalid or unassigned 3D ULPIN ID: ${queryId}`);
      }
    } catch (err) {
      alert('Search failed: ' + err.message);
    }
  };

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      
      {/* Top Banner */}
      <GovernanceBanner onSearchUlpin={handleSearchUlpin} totalUnitsCount={units.length} />

      {/* Main Viewport Container */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        
        {/* Left Side: 3D Digital Twin & 2D GIS Map */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          
          {/* View Switcher Overlay Toolbar */}
          <div
            className="glass-panel"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              zIndex: 10,
              padding: '6px',
              display: 'flex',
              gap: '4px'
            }}
          >
            <button
              className={`btn btn-sm ${viewMode === 'split' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('split')}
            >
              Split 3D/2D
            </button>
            <button
              className={`btn btn-sm ${viewMode === '3d' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('3d')}
            >
              <Box size={14} /> 3D Digital Twin
            </button>
            <button
              className={`btn btn-sm ${viewMode === '2d' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('2d')}
            >
              <MapIcon size={14} /> 2D Map View
            </button>
            <button className="btn btn-secondary btn-sm" onClick={loadData} title="Refresh Dataset">
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Viewports Area */}
          <div style={{ flex: 1, display: 'flex', height: '100%', width: '100%' }}>
            
            {/* 3D Viewport */}
            {(viewMode === 'split' || viewMode === '3d') && (
              <div style={{ flex: 1, height: '100%', position: 'relative' }}>
                <ThreeViewer
                  units={units}
                  selectedUnit={selectedUnit}
                  onSelectUnit={setSelectedUnit}
                  topologyErrors={topologyErrors}
                />
              </div>
            )}

            {/* 2D GIS Map */}
            {(viewMode === 'split' || viewMode === '2d') && (
              <div style={{ flex: viewMode === 'split' ? 0.7 : 1, height: '100%', borderLeft: viewMode === 'split' ? '1px solid var(--border-color)' : 'none', position: 'relative' }}>
                <LeafletMap
                  units={units}
                  selectedUnit={selectedUnit}
                  onSelectUnit={setSelectedUnit}
                />
              </div>
            )}

          </div>
        </div>

        {/* Right Side: Sidebar Drawer Panel (3D ULPIN Inspector & Validation Panel) */}
        <div style={{ width: '380px', height: '100%', background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
          
          {/* Drawer Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.3)' }}>
            <button
              onClick={() => setActiveTab('inspector')}
              style={{
                flex: 1,
                padding: '12px',
                background: activeTab === 'inspector' ? 'var(--bg-secondary)' : 'transparent',
                color: activeTab === 'inspector' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                border: 'none',
                borderBottom: activeTab === 'inspector' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <ShieldCheck size={16} /> 3D ULPIN Inspector
            </button>
            
            <button
              onClick={() => setActiveTab('validation')}
              style={{
                flex: 1,
                padding: '12px',
                background: activeTab === 'validation' ? 'var(--bg-secondary)' : 'transparent',
                color: activeTab === 'validation' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                border: 'none',
                borderBottom: activeTab === 'validation' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <AlertOctagon size={16} /> Validation & AI
            </button>
          </div>

          {/* Drawer Content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {activeTab === 'inspector' ? (
              <UlpinInspector selectedUnit={selectedUnit} />
            ) : (
              <ValidationPanel
                units={units}
                onValidationComplete={setTopologyErrors}
                onSelectUnit={setSelectedUnit}
              />
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
