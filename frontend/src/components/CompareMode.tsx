import React, { useState, useEffect } from 'react';
import { OrgProfile, ComparisonItem } from '../types';
import { GitCompare, ArrowRightLeft, ShieldAlert, Sparkles, Building2, Rocket } from 'lucide-react';
import { apiFetch } from '../api';
import { TableSkeleton } from './LoadingSkeleton';

interface CompareModeProps {
  profiles: OrgProfile[];
}

export const CompareMode: React.FC<CompareModeProps> = ({ profiles }) => {
  const [orgId1, setOrgId1] = useState<string>('ORG-001'); // Bank
  const [orgId2, setOrgId2] = useState<string>('ORG-002'); // Startup
  const [comparison, setComparison] = useState<ComparisonItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const profile1 = profiles.find((p) => p.org_id === orgId1) || profiles[0];
  const profile2 = profiles.find((p) => p.org_id === orgId2) || profiles[1] || profiles[0];

  useEffect(() => {
    fetchComparison();
  }, [orgId1, orgId2]);

  const fetchComparison = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id_1: orgId1, org_id_2: orgId2 })
      });
      const data = await res.json();
      setComparison(data.comparison || []);
    } catch (err) {
      console.error('Error fetching comparison:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: '40px' }}>
      
      {/* Banner */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.4) 0%, rgba(88, 28, 135, 0.4) 100%)', border: '1px solid var(--border-glow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Sparkles size={24} color="#f472b6" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
            ORGANISATION COMPARISON MODE
          </h2>
        </div>
        <p style={{ fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.5' }}>
          <strong style={{ color: '#ffffff' }}>"Same vulnerabilities. Different organisations. Different priorities."</strong> Demonstrate to judges how risk appetites, weighting preferences, and critical product context change the top 5 outputs.
        </p>
      </div>

      {/* Profile Selector Headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        
        {/* Profile 1 Card */}
        <div className="glass-panel" style={{ padding: '20px', borderTop: '4px solid #60a5fa' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
            Organisation Profile 1
          </label>
          <select
            value={orgId1}
            onChange={(e) => setOrgId1(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.5)',
              color: '#ffffff',
              border: '1px solid var(--border-color)',
              fontSize: '1rem',
              fontWeight: 600,
              fontFamily: 'var(--font-main)',
              outline: 'none'
            }}
          >
            {profiles.map((p) => (
              <option key={p.org_id} value={p.org_id}>{p.name} ({p.sector})</option>
            ))}
          </select>

          {profile1 && (
            <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <div>Weights: CVSS {Math.round(profile1.weight_modifiers.cvss_weight*100)}% | KEV {Math.round(profile1.weight_modifiers.cisa_kev_weight*100)}% | EPSS {Math.round(profile1.weight_modifiers.first_epss_weight*100)}%</div>
              <div style={{ marginTop: '4px', color: '#93c5fd' }}>Critical: {profile1.critical_products.join(', ')}</div>
            </div>
          )}
        </div>

        {/* Profile 2 Card */}
        <div className="glass-panel" style={{ padding: '20px', borderTop: '4px solid #f472b6' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
            Organisation Profile 2
          </label>
          <select
            value={orgId2}
            onChange={(e) => setOrgId2(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.5)',
              color: '#ffffff',
              border: '1px solid var(--border-color)',
              fontSize: '1rem',
              fontWeight: 600,
              fontFamily: 'var(--font-main)',
              outline: 'none'
            }}
          >
            {profiles.map((p) => (
              <option key={p.org_id} value={p.org_id}>{p.name} ({p.sector})</option>
            ))}
          </select>

          {profile2 && (
            <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <div>Weights: CVSS {Math.round(profile2.weight_modifiers.cvss_weight*100)}% | KEV {Math.round(profile2.weight_modifiers.cisa_kev_weight*100)}% | EPSS {Math.round(profile2.weight_modifiers.first_epss_weight*100)}%</div>
              <div style={{ marginTop: '4px', color: '#f472b6' }}>Critical: {profile2.critical_products.join(', ')}</div>
            </div>
          )}
        </div>

      </div>

      {/* Comparison Matrix Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '14px 20px' }}>CVE & Affected Product</th>
              <th style={{ padding: '14px 20px', color: '#60a5fa' }}>{profile1?.name} Rank & Score</th>
              <th style={{ padding: '14px 20px', color: '#f472b6' }}>{profile2?.name} Rank & Score</th>
              <th style={{ padding: '14px 20px' }}>Why Did Order Shift?</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ padding: '16px' }}>
                  <TableSkeleton rows={3} />
                </td>
              </tr>
            ) : comparison.map((item) => (
              <tr key={item.cve_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                
                {/* CVE & Product */}
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#ffffff' }}>{item.cve_id}</div>
                  <div style={{ fontSize: '0.8rem', color: '#93c5fd' }}>{item.product_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    CVSS {item.cvss_base_score} | KEV {item.cisa_kev ? 'YES' : 'NO'} | EPSS {(item.first_epss * 100).toFixed(1)}%
                  </div>
                </td>

                {/* Profile 1 Rank */}
                <td style={{ padding: '16px 20px' }}>
                  {item.rank_org1 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#2563eb', color: 'white', fontWeight: 800, padding: '4px 10px', borderRadius: '6px', fontFamily: 'var(--font-mono)' }}>
                        #{item.rank_org1}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#93c5fd' }}>{item.score_org1?.toFixed(1)}</span>
                    </div>
                  ) : (
                    <span style={{ color: '#f87171', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                      EXCLUDED (Not Critical)
                    </span>
                  )}
                </td>

                {/* Profile 2 Rank */}
                <td style={{ padding: '16px 20px' }}>
                  {item.rank_org2 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#db2777', color: 'white', fontWeight: 800, padding: '4px 10px', borderRadius: '6px', fontFamily: 'var(--font-mono)' }}>
                        #{item.rank_org2}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#f472b6' }}>{item.score_org2?.toFixed(1)}</span>
                    </div>
                  ) : (
                    <span style={{ color: '#f87171', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                      EXCLUDED (Not Critical)
                    </span>
                  )}
                </td>

                {/* Explanation */}
                <td style={{ padding: '16px 20px', color: '#cbd5e1', lineHeight: '1.4' }}>
                  {item.shift_explanation}
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};
