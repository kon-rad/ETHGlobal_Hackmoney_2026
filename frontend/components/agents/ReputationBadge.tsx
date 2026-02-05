'use client';

interface ReputationBadgeProps {
  score: number;      // 0-5 scale
  totalJobs: number;
  confidence?: number; // 0-1
  size?: 'sm' | 'md' | 'lg';
  showJobs?: boolean;
}

export function ReputationBadge({
  score,
  totalJobs,
  confidence = 0,
  size = 'md',
  showJobs = true
}: ReputationBadgeProps) {
  const stars = Math.round(Math.min(5, Math.max(0, score)));

  const sizes = {
    sm: { star: 'w-3 h-3', text: 'text-xs', gap: 'gap-0.5' },
    md: { star: 'w-4 h-4', text: 'text-sm', gap: 'gap-1' },
    lg: { star: 'w-5 h-5', text: 'text-base', gap: 'gap-1' },
  };

  const s = sizes[size];

  // Color based on score
  const starColor = score >= 4 ? 'text-yellow-400' :
                   score >= 3 ? 'text-yellow-500' :
                   score >= 2 ? 'text-orange-400' : 'text-gray-400';

  return (
    <div className={`flex items-center ${s.gap}`}>
      {/* Stars */}
      <div className={`flex ${s.gap}`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <svg
            key={i}
            className={`${s.star} ${i <= stars ? starColor : 'text-slate-600'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>

      {/* Job count */}
      {showJobs && (
        <span className={`${s.text} text-slate-400 ml-1`}>
          ({totalJobs} {totalJobs === 1 ? 'job' : 'jobs'})
        </span>
      )}

      {/* Confidence indicator */}
      {confidence > 0 && (
        <div
          className="ml-1 w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: confidence > 0.7 ? '#10B981' :
                           confidence > 0.4 ? '#F59E0B' : '#6B7280'
          }}
          title={`${Math.round(confidence * 100)}% confidence`}
        />
      )}
    </div>
  );
}
