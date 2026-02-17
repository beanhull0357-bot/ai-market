import React from 'react';

interface CodeBlockProps {
  data: any;
  label?: string;
  className?: string;
}

// Tokenize JSON string into typed segments for safe rendering
function tokenize(json: string): { text: string; type: string }[] {
  const tokens: { text: string; type: string }[] = [];
  const regex = /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(json)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: json.slice(lastIndex, match.index), type: 'plain' });
    }
    let type = 'number';
    if (/^"/.test(match[0])) {
      type = /:$/.test(match[0]) ? 'key' : 'string';
    } else if (/true|false/.test(match[0])) {
      type = 'boolean';
    } else if (/null/.test(match[0])) {
      type = 'null';
    }
    tokens.push({ text: match[0], type });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < json.length) {
    tokens.push({ text: json.slice(lastIndex), type: 'plain' });
  }
  return tokens;
}

const colorMap: Record<string, string> = {
  key: 'text-blue-400',
  string: 'text-green-400',
  number: 'text-orange-400',
  boolean: 'text-purple-400',
  null: 'text-gray-500',
  plain: '',
};

export const CodeBlock: React.FC<CodeBlockProps> = ({ data, label, className }) => {
  const jsonString = JSON.stringify(data, null, 2);
  const tokens = tokenize(jsonString);

  return (
    <div className={`font-mono text-sm border border-slate-800 bg-slate-900/50 rounded p-4 overflow-x-auto ${className}`}>
      {label && <div className="text-xs text-slate-500 mb-2 border-b border-slate-800 pb-1">{label}</div>}
      <pre>
        {tokens.map((token, i) => (
          token.type === 'plain'
            ? <React.Fragment key={i}>{token.text}</React.Fragment>
            : <span key={i} className={colorMap[token.type]}>{token.text}</span>
        ))}
      </pre>
    </div>
  );
};