import React from 'react';

interface CodeBlockProps {
  data: any;
  label?: string;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ data, label, className }) => {
  const jsonString = JSON.stringify(data, null, 2);

  // Simple syntax highlighting via regex replacement
  const highlighted = jsonString
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'text-orange-400'; // number
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'text-blue-400'; // key
        } else {
          cls = 'text-green-400'; // string
        }
      } else if (/true|false/.test(match)) {
        cls = 'text-purple-400'; // boolean
      } else if (/null/.test(match)) {
        cls = 'text-gray-500'; // null
      }
      return `<span class="${cls}">${match}</span>`;
    });

  return (
    <div className={`font-mono text-sm border border-slate-800 bg-slate-900/50 rounded p-4 overflow-x-auto ${className}`}>
      {label && <div className="text-xs text-slate-500 mb-2 border-b border-slate-800 pb-1">{label}</div>}
      <pre dangerouslySetInnerHTML={{ __html: highlighted }} />
    </div>
  );
};