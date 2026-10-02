import React, { useState } from 'react';
import { Play, AlertOctagon, CheckCircle2, Cpu, Sparkles, AlertTriangle, Layers } from 'lucide-react';
import { runTopologyValidation, runBuildingExtraction, runFloorSegmentation } from '../utils/api';

export default function ValidationPanel({
  onValidationComplete = () => {},
  onSelectUnit = () => {},
  units = []
}) {
  const [report, setReport] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [aiOutput, setAiOutput] = useState(null);
  const [activeTab, setActiveTab] = useState('topology'); // 'topology' or 'ai'

  const handleRunValidation = async () => {
    setIsValidating(true);
    try {
      const data = await runTopologyValidation();
      setReport(data);
      onValidationComplete(data.errors || []);
    } catch (err) {
      alert('Validation failed: ' + err.message);
    } finally {
      setIsValidating(false);
    }
  };

  const handleRunBuildingExtraction = async () => {
    setIsValidating(true);
    try {
      const data = await runBuildingExtraction();
      setAiOutput({ type: 'building', result: data });
    } catch (err) {
      alert('Building extraction failed: ' + err.message);
    } finally {
      setIsValidating(false);
    }
  };

  const handleRunFloorSegmentation = async () => {
    setIsValidating(true);
    try {
      const data = await runFloorSegmentation();
      setAiOutput({ type: 'floors', result: data });
    } catch (err) {
      alert('Floor segmentation failed: ' + err.message);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Sub-tab selection */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <button
          className={`btn btn-sm ${activeTab === 'topology' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('topology')}
        >
          <AlertOctagon size={14} /> 3D Topology Validator
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'ai' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('ai')}
        >
          <Cpu size={14} /> AI Pipeline Models
        </button>
      </div>

      {/* TAB 1: 3D TOPOLOGY VALIDATION */}
      {activeTab === 'topology' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
              Intelligent 3D Topology & Volumetric Overlap Validator
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Detects 3D volumetric clipping (e.g. underground metro vs private basement), sibling overlaps, and floor height monotonicity errors across the cadastre.
            </p>
          </div>

          <button className="btn btn-primary" onClick={handleRunValidation} disabled={isValidating} style={{ justifyContent: 'center' }}>
            <Play size={16} /> {isValidating ? 'Running 3D Spatial Checks...' : 'Run 3D Topology & Overlap Check'}
          </button>

          {/* Validation Metrics Summary */}
          {report && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>UNITS CHECKED</span>
                <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {report.total_units_checked}
                </div>
              </div>
              <div style={{ background: 'rgba(244, 63, 94, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--accent-rose)' }}>3D CRITICAL ERRORS</span>
                <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-rose)' }}>
                  {report.critical_errors}
                </div>
              </div>
              <div style={{ background: 'rgba(251, 191, 36, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--accent-amber)' }}>WARNINGS</span>
                <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
                  {report.warnings}
                </div>
              </div>
            </div>
          )}

          {/* Error List */}
          {report && report.errors.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Detected Spatial Topology Conflicts ({report.errors.length})
              </h4>
              {report.errors.map((err, idx) => {
                const targetUnit = units.find(u => u.id === err.target_unit_id);
                return (
                  <div
                    key={idx}
                    onClick={() => targetUnit && onSelectUnit(targetUnit)}
                    style={{
                      background: err.severity === 'CRITICAL' ? 'rgba(244, 63, 94, 0.12)' : 'rgba(251, 191, 36, 0.12)',
                      border: `1px solid ${err.severity === 'CRITICAL' ? 'rgba(244, 63, 94, 0.35)' : 'rgba(251, 191, 36, 0.35)'}`,
                      borderRadius: '8px',
                      padding: '12px',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span className="font-mono" style={{ fontSize: '0.7rem', fontWeight: 700, color: err.severity === 'CRITICAL' ? 'var(--accent-rose)' : 'var(--accent-amber)' }}>
                        [{err.error_code}]
                      </span>
                      {err.overlap_volume_m3 && (
                        <span className="glass-pill" style={{ color: 'var(--accent-rose)', fontWeight: 600 }}>
                          Vol: {err.overlap_volume_m3} m³
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#fff', lineHeight: '1.3' }}>
                      {err.message}
                    </p>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '6px' }}>
                      Target 3D ULPIN: <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>{err.target_unit_id}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {report && report.errors.length === 0 && (
            <div style={{ padding: '16px', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-emerald)' }}>
              <CheckCircle2 size={20} />
              <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>No 3D spatial overlaps or Z-range topology errors detected.</span>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AI PIPELINE MODELS */}
      {activeTab === 'ai' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
              AI Sensor Processing Controls
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Test automated building extraction models on DSM elevation rasters and point-cloud height histogram clustering.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={handleRunBuildingExtraction} disabled={isValidating}>
              <Sparkles size={16} color="var(--accent-cyan)" /> 1. Automated Building Extraction (DSM / LiDAR)
            </button>
            <button className="btn btn-secondary" onClick={handleRunFloorSegmentation} disabled={isValidating}>
              <Layers size={16} color="var(--accent-emerald)" /> 2. Point-Cloud Height Histogram Floor Segmentation
            </button>
          </div>

          {/* AI Output Display */}
          {aiOutput && (
            <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-cyan)', marginBottom: '8px' }}>
                AI Model Output Log ({aiOutput.type.toUpperCase()})
              </h4>
              <pre className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflowX: 'auto', maxHeight: '200px' }}>
                {JSON.stringify(aiOutput.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
