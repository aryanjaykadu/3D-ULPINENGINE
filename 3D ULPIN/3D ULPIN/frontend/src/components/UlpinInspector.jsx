import React, { useState } from 'react';
import { Copy, Check, Download, ShieldCheck, Database, Layers, User, FileText, AlertTriangle } from 'lucide-react';
import { fetchCityJsonExport } from '../utils/api';

export default function UlpinInspector({ selectedUnit, onExportCityJson }) {
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (!selectedUnit) {
    return (
      <div className="glass-panel" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Database size={48} style={{ opacity: 0.3, marginBottom: '16px', color: 'var(--accent-cyan)' }} />
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>Select a 3D Spatial Unit</h3>
        <p style={{ fontSize: '0.8rem', maxWidth: '280px' }}>
          Click any volumetric unit in the 3D digital twin or 2D GIS map to inspect its 3D ULPIN structure, ownership deed, and sensor audit trail.
        </p>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedUnit.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await fetchCityJsonExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `3D_ULPIN_CityJSON_Export_${selectedUnit.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error exporting CityJSON: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Extract Z Hash from unit ID
  const zHashMatch = selectedUnit.id.match(/-Z([A-F0-9]{4})$/);
  const zHash = zHashMatch ? zHashMatch[1] : 'N/A';

  return (
    <div className="glass-panel" style={{ padding: '20px', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header & 3D ULPIN Code */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-cyan)', letterSpacing: '0.5px' }}>
            PROTOTYPE 3D ULPIN (BHU-AADHAAR 3D)
          </span>
          <span className="glass-pill" style={{ color: 'var(--accent-emerald)' }}>
            ISO 19152 LADM
          </span>
        </div>

        <div
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--border-accent)',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span className="font-mono" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>
            {selectedUnit.id}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={handleCopy} title="Copy 3D ULPIN">
            {copied ? <Check size={14} color="var(--accent-emerald)" /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* Segment Structure Breakdown */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
        <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>
          Structured ID Segment Breakdown
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem' }}>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Base 2D ULPIN:</span>
            <div className="font-mono" style={{ color: '#fff', fontWeight: 600 }}>{selectedUnit.parent_2d_ulpin}</div>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Building ID:</span>
            <div className="font-mono" style={{ color: '#fff', fontWeight: 600 }}>{selectedUnit.building_id}</div>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Floor Segment:</span>
            <div className="font-mono" style={{ color: '#fff', fontWeight: 600 }}>Floor {selectedUnit.floor_number}</div>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Z-Span Hash:</span>
            <div className="font-mono" style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>Z-{zHash}</div>
          </div>
        </div>
      </div>

      {/* Vertical Bounds & Geometry */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
        <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Layers size={14} color="var(--accent-cyan)" /> Vertical Bounds (Datum: MSL)
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '0.75rem', textAlign: 'center' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>Z MIN</span>
            <div className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>{selectedUnit.z_min} m</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>Z MAX</span>
            <div className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>{selectedUnit.z_max} m</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>HEIGHT</span>
            <div className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>{selectedUnit.height_meters} m</div>
          </div>
        </div>
      </div>

      {/* Ownership & Encumbrances */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
        <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <User size={14} color="var(--accent-indigo)" /> Ownership & Rights Registry
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-dim)' }}>Owner Name:</span>
            <span style={{ fontWeight: 600, color: '#fff' }}>{selectedUnit.ownership.owner_name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-dim)' }}>Property Tax ID:</span>
            <span className="font-mono" style={{ color: 'var(--text-muted)' }}>{selectedUnit.ownership.property_tax_id || 'N/A'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-dim)' }}>Title Deed No:</span>
            <span className="font-mono" style={{ color: 'var(--text-muted)' }}>{selectedUnit.ownership.title_deed_number || 'N/A'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-dim)' }}>Encumbrance:</span>
            <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>{selectedUnit.ownership.encumbrance_status}</span>
          </div>
        </div>
      </div>

      {/* Sensor Provenance & Audit Log */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
        <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={14} color="var(--accent-emerald)" /> Sensor Provenance & AI Audit Trail
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-dim)' }}>Data Source:</span>
            <span style={{ color: '#fff', fontWeight: 500 }}>{selectedUnit.provenance.source_type}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-dim)' }}>Verification Status:</span>
            <span className="glass-pill" style={{ color: 'var(--accent-amber)', fontSize: '0.65rem' }}>
              {selectedUnit.provenance.verification_status}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
            <span style={{ color: 'var(--text-dim)' }}>AI Confidence Score:</span>
            <span style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>{(selectedUnit.confidence_score * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Export Action */}
      <button className="btn btn-primary" onClick={handleExport} disabled={isExporting} style={{ width: '100%', justifyContent: 'center' }}>
        <Download size={16} /> {isExporting ? 'Exporting CityJSON...' : 'Export OGC CityJSON (ISO 19152)'}
      </button>

      {/* Mandatory Governance Disclaimer */}
      <div
        style={{
          background: 'rgba(251, 191, 36, 0.08)',
          border: '1px solid rgba(251, 191, 36, 0.25)',
          borderRadius: '8px',
          padding: '10px',
          fontSize: '0.7rem',
          color: 'var(--accent-amber)',
          lineHeight: '1.4'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, marginBottom: '4px' }}>
          <AlertTriangle size={14} /> Governance Note
        </div>
        {selectedUnit.disclaimer}
      </div>

    </div>
  );
}
