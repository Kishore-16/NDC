import React, { useState, useEffect } from 'react';
import { OrgProfile, NegativeTestItem } from '../types';
import { Ban, AlertTriangle, ShieldX, HelpCircle, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../api';
import { TriageSkeleton } from './LoadingSkeleton';

interface NegativeTestViewProps {
  profile: OrgProfile | null;
}

export const NegativeTestView: React.FC<NegativeTestViewProps> = ({ profile }) => {
  const [items, setItems] = useState<NegativeTestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (profile) {
      fetchNegativeTests();
    }
  }, [profile]);

  const fetchNegativeTests = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/negative-test/${encodeURIComponent(profile.org_id)}`);
      const data = await res.json();
      setItems(data.negative_tests || []);
    } catch (err) {
      console.error('Error fetching negative tests:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: '40px' }}>
      
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', borderLeft: '5px solid var(--urgent-red)', background: 'rgba(239, 68, 68, 0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <ShieldX size={26} color="var(--urgent-red)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
            MANDATORY HIGH-CVSS NEGATIVE TEST INSPECTOR
          </h2>
        </div>
        <p style={{ fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.5' }}>
          <strong style={{ color: '#fca5a5' }}>Proving Personalisation over Generic CVSS Sorting:</strong> Below are high-severity vulnerabilities (CVSS 9.0+) that our system <strong>EXCLUDED</strong> from the Top 5 for <strong style={{ color: '#93c5fd' }}>{profile?.name}</strong> because they do not touch the organisation's critical products.
        </p>
      </div>

      {loading ? (
        <TriageSkeleton count={2} />
      ) : items.length === 0 ? (
        <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No high-CVSS excluded vulnerabilities found for this profile.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {items.map((item) => (
            <div
              key={item.cve_id}
              className="glass-panel"
              style={{
                padding: '24px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: 'rgba(15, 23, 42, 0.8)',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                
                {/* Details */}
                <div style={{ flex: '1 1 450px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <span style={{ background: 'var(--urgent-red)', color: 'white', fontWeight: 800, fontSize: '0.8rem', padding: '2px 8px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                      EXCLUDED
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>
                      {item.cve_id}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.15)', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                      CVSS {item.cvss_base_score} (CRITICAL)
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#60a5fa', background: 'rgba(59, 130, 246, 0.15)', padding: '2px 8px', borderRadius: '6px' }}>
                      EPSS {(item.first_epss * 100).toFixed(1)}%
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fca5a5', marginBottom: '6px' }}>
                    WHY WASN'T THIS #1 FOR {profile?.name.toUpperCase()}?
                  </h3>

                  <div style={{ fontSize: '0.9rem', color: '#ffffff', fontWeight: 600, marginBottom: '12px' }}>
                    Product: <span style={{ color: '#93c5fd' }}>{item.product_name}</span>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.4)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', lineHeight: '1.5', fontSize: '0.85rem' }}>
                    <p style={{ color: '#cbd5e1', marginBottom: '6px' }}>
                      <strong style={{ color: '#f87171' }}>Exclusion Reason:</strong> {item.exclusion_reason}
                    </p>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      {item.why_not_top1}
                    </p>
                  </div>
                </div>

                {/* Status Stamp Box */}
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px dashed var(--urgent-red)',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                  minWidth: '180px'
                }}>
                  <Ban size={28} color="var(--urgent-red)" style={{ marginBottom: '6px' }} />
                  <div style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase' }}>
                    Decision Outcome
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
                    NOT RELEVANT
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Filtered out before ranking
                  </div>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
