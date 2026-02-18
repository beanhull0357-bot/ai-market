import React from 'react';
import { AgentReview } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { CheckCircle, AlertTriangle, Ban, Server, Scale, Clock } from 'lucide-react';

interface AgentReviewListProps {
  reviews: AgentReview[];
}

export const AgentReviewList: React.FC<AgentReviewListProps> = ({ reviews }) => {
  const { t } = useLanguage();

  const getVerdictStyle = (verdict: string) => {
    switch (verdict) {
      case 'ENDORSE': return 'text-terminal-green border-terminal-green bg-green-900/10';
      case 'WARN': return 'text-terminal-yellow border-terminal-yellow bg-yellow-900/10';
      case 'BLOCKLIST': return 'text-terminal-red border-terminal-red bg-red-900/10';
      default: return 'text-gray-500';
    }
  };

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case 'ENDORSE': return <CheckCircle size={14} />;
      case 'WARN': return <AlertTriangle size={14} />;
      case 'BLOCKLIST': return <Ban size={14} />;
      default: return null;
    }
  };

  return (
    <div className="font-mono text-xs">
      {reviews.map((rev) => (
        <div key={rev.reviewId} className="mb-3 border-l-2 border-gray-800 pl-3 py-1 hover:border-gray-600 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 border rounded flex items-center gap-1 font-bold ${getVerdictStyle(rev.verdict)}`}>
                {getVerdictIcon(rev.verdict)} {rev.verdict}
              </span>
              <span className="text-gray-500">@{rev.reviewerAgentId}</span>
            </div>
            <span className="text-gray-600">{new Date(rev.timestamp).toISOString().split('T')[0]}</span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 bg-gray-900/50 p-2 rounded">
            <div className="flex items-center gap-1 text-gray-400 whitespace-nowrap">
              <Scale size={12} />
              <span>{t('review.compliance')}:</span>
              <span className={rev.metrics.specCompliance >= 0.98 ? 'text-green-400' : 'text-red-400'}>
                {(rev.metrics.specCompliance * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center gap-1 text-gray-400 whitespace-nowrap">
              <Server size={12} />
              <span>{t('review.latency')}:</span>
              <span className={rev.metrics.apiLatencyMs < 500 ? 'text-green-400' : 'text-yellow-400'}>
                {rev.metrics.apiLatencyMs}ms
              </span>
            </div>
            <div className="flex items-center gap-1 text-gray-400 whitespace-nowrap">
              <Clock size={12} />
              <span>{t('review.delta')}:</span>
              <span className={rev.metrics.fulfillmentDelta === 0 ? 'text-green-400' : 'text-red-400'}>
                {rev.metrics.fulfillmentDelta}h
              </span>
            </div>
          </div>

          <div className="space-y-1">
            {rev.structuredLog.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className={`w-12 text-center text-[10px] uppercase rounded ${log.level === 'INFO' ? 'bg-gray-800 text-gray-400' :
                    log.level === 'WARN' ? 'bg-yellow-900/30 text-yellow-500' : 'bg-red-900/30 text-red-500'
                  }`}>
                  {log.level}
                </span>
                <span className="text-gray-500">[{log.event}]</span>
                <span className="text-gray-300">{log.details}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};