import React, { useState } from 'react';
import { Search, AlertTriangle, ShieldCheck, Box, Sparkles } from 'lucide-react';

export default function GovernanceBanner({ onSearchUlpin, totalUnitsCount = 0 }) {
  const [searchInput, setSearchInput] = useState('');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearchUlpin(searchInput.trim());
    }
  };

  return (
    <header style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Top Navigation Bar */}
      <div
        style={{
          background: 'rgba(17, 24, 39, 0.95)',
          borderBottom: '1px solid var(--border-color)',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}
      >
        {/* Brand & Problem Statement */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(37, 99, 235, 0.5)'
            }}
          >
            <Box size={20} color="#fff" />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.2px' }}>
                3D ULPIN Engine
              </h1>
              <span className="glass-pill" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                SIH26011
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Vertical Property Mapping System | Ministry of Rural Development (DoLR)
            </span>
          </div>
        </div>

        {/* Search by 3D ULPIN */}
        <form onSubmit={handleSearchSubmit} style={{ flex: '0 1 380px' }}>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px' }} />
            <input
              type="text"
              placeholder="Search by 3D ULPIN (e.g. 14MH27042910-B01-F03-U02-Z0412)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="font-mono"
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-accent)',
                borderRadius: '8px',
                padding: '8px 12px 8px 36px',
                color: '#fff',
                fontSize: '0.75rem',
                outline: 'none'
              }}
            />
          </div>
        </form>

        {/* Status Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--accent-emerald)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-emerald)', boxShadow: '0 0 8px var(--accent-emerald)' }}></span>
            <span>{totalUnitsCount} Units Active</span>
          </div>
        </div>
      </div>

      {/* Mandatory Governance Disclaimer Banner */}
      <div className="disclaimer-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={15} />
          <span>
            <strong>GOVERNANCE DISCLAIMER:</strong> Prototype 3D ULPIN — proposed format, candidate spatial unit requiring human verification before becoming authoritative (Not an official DoLR/Survey of India standard).
          </span>
        </div>
        <span className="font-mono" style={{ fontSize: '0.68rem', opacity: 0.8 }}>
          ISO 19152 LADM / OGC CityJSON Standard
        </span>
      </div>
    </header>
  );
}
