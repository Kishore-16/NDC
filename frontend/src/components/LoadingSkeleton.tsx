interface SkeletonProps { className?: string; }

export function Skeleton({ className = '' }: SkeletonProps) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

export function TriageSkeleton({ count = 3 }: { count?: number }) {
  return <div className="triage-list" aria-label="Ranking vulnerabilities"><span className="loading-copy">Applying organisation context and ranking vulnerabilities…</span>{Array.from({ length: count }, (_, index) => <div className="triage-card triage-card-skeleton" key={index}><Skeleton className="skeleton-rank" /><div className="triage-card-main"><Skeleton className="skeleton-chip" /><Skeleton className="skeleton-title" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line short" /></div><div className="triage-card-score"><Skeleton className="skeleton-score" /><Skeleton className="skeleton-button" /></div></div>)}</div>;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return <div className="table-skeleton" aria-label="Loading data"><span className="loading-copy">Preparing decision evidence…</span>{Array.from({ length: rows }, (_, index) => <div key={index}><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div>)}</div>;
}
