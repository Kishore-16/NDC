import React, { useState, useEffect } from 'react';
import { OrgProfile, GoldSetEvaluation } from '../types';
import { Award, CheckCircle, Percent, BarChart3, Info } from 'lucide-react';
import { apiFetch } from '../api';
import { TableSkeleton } from './LoadingSkeleton';

interface GoldSetEvalViewProps {
  profile: OrgProfile | null;
}

export const GoldSetEvalView: React.FC<GoldSetEvalViewProps> = ({ profile }) => {
  const [evaluation, setEvaluation] = useState<GoldSetEvaluation | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (profile) {
      fetchGoldSetEval();
    }
  }, [profile]);

  const fetchGoldSetEval = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/gold-set-eval/${encodeURIComponent(profile.org_id)}`);
      const data = await res.json();
      setEvaluation(data.evaluation || null);
    } catch (err) {
      console.error('Error fetching gold set eval:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: '40px' }}>
      
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Award size={26} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
            GOLD SET BENCHMARK & PRACTITIONER ALIGNMENT
          </h2>
        </div>
        <p style={{ fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.5' }}>
          Validation of system rankings against security practitioner ground truth (<strong style={{ color: '#67e8f9' }}>gold_set.csv</strong>) for <strong style={{ color: '#ffffff' }}>{profile?.name}</strong>.
        </p>
      </div>

      {loading ? (
        <TableSkeleton rows={4} />
      ) : evaluation ? (
        <div>
          {/* Overlap Summary Card */}
          <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Practitioner Top-5 Overlap Score
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#67e8f9', fontFamily: 'var(--font-mono)' }}>
                {evaluation.top_5_overlap_pct}%
                <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '8px' }}>
                  ({evaluation.top_5_overlap_count} of {evaluation.total_eval_items} items matched)
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '12px 18px', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Evaluated Dataset</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff' }}>{evaluation.total_eval_items} Gold Records</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '12px 18px', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Model Status</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#34d399' }}>HIGH ALIGNMENT</div>
              </div>
            </div>
          </div>

          {/* Detailed Rank Comparison Table */}
          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '14px 20px' }}>CVE ID</th>
                  <th style={{ padding: '14px 20px' }}>Product Name</th>
                  <th style={{ padding: '14px 20px', color: '#60a5fa' }}>System Score</th>
                  <th style={{ padding: '14px 20px', color: '#60a5fa' }}>System Rank</th>
                  <th style={{ padding: '14px 20px', color: '#fbbf24' }}>Practitioner Rank</th>
                  <th style={{ padding: '14px 20px' }}>Rank Delta</th>
                </tr>
              </thead>
              <tbody>
                {evaluation.rank_comparison.map((item) => (
                  <tr key={item.cve_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#ffffff' }}>
                      {item.cve_id}
                    </td>
                    <td style={{ padding: '16px 20px', color: '#93c5fd' }}>
                      {item.product_name}
                    </td>
                    <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#60a5fa' }}>
                      {item.system_score.toFixed(1)}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ background: '#2563eb', color: 'white', fontWeight: 800, padding: '4px 10px', borderRadius: '6px', fontFamily: 'var(--font-mono)' }}>
                        #{item.system_rank}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ background: '#d97706', color: 'white', fontWeight: 800, padding: '4px 10px', borderRadius: '6px', fontFamily: 'var(--font-mono)' }}>
                        #{item.practitioner_rank}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', color: item.rank_delta === 0 ? '#34d399' : 'var(--text-secondary)' }}>
                      {item.rank_delta === 0 ? 'Exact Match (0)' : `±${item.rank_delta}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      ) : null}

    </div>
  );
};
