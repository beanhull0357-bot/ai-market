import React, { useState, useEffect } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Send, Copy, Check, Lock, Unlock, ExternalLink, Zap, Server, Tag } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface ParamSchema {
    name: string;
    in?: string;
    required?: boolean;
    schema?: any;
    description?: string;
}

interface EndpointInfo {
    path: string;
    method: string;
    summary: string;
    description?: string;
    operationId: string;
    tags: string[];
    security?: any[];
    parameters?: ParamSchema[];
    requestBody?: any;
    responses?: any;
}

const METHOD_COLORS: Record<string, string> = {
    get: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    post: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    put: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    delete: 'bg-red-500/20 text-red-400 border-red-500/40',
};

const TAG_COLORS: Record<string, string> = {
    Agents: 'text-orange-400',
    Products: 'text-green-400',
    Orders: 'text-blue-400',
    Reviews: 'text-purple-400',
    Checkout: 'text-emerald-400',
    Offers: 'text-yellow-400',
    Webhooks: 'text-pink-400',
    Negotiate: 'text-cyan-400',
    Rewards: 'text-amber-400',
    Sandbox: 'text-gray-400',
};

/* ━━━ Single Endpoint Card ━━━ */
const EndpointCard: React.FC<{ ep: EndpointInfo }> = ({ ep }) => {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const isPublic = ep.security && ep.security.length === 0;
    const methodColor = METHOD_COLORS[ep.method] || METHOD_COLORS.get;

    // Build params list from path params + query params + requestBody
    const allParams: { name: string; type: string; required: boolean; in: string; desc: string }[] = [];

    ep.parameters?.forEach(p => {
        allParams.push({
            name: p.name,
            type: p.schema?.type || 'string',
            required: p.required || false,
            in: p.in || 'query',
            desc: p.description || '',
        });
    });

    if (ep.requestBody?.content?.['application/json']?.schema?.properties) {
        const props = ep.requestBody.content['application/json'].schema.properties;
        const reqFields = ep.requestBody.content['application/json'].schema.required || [];
        Object.entries(props).forEach(([key, val]: [string, any]) => {
            allParams.push({
                name: key,
                type: val.type || 'string',
                required: reqFields.includes(key),
                in: 'body',
                desc: val.description || '',
            });
        });
    }

    // Build cURL
    const buildCurl = () => {
        const base = 'https://api.jsonmart.xyz';
        if (ep.method === 'get') {
            const queryParams = allParams.filter(p => p.in === 'query').map(p => `${p.name}=...`).join('&');
            const url = `${base}${ep.path}${queryParams ? '?' + queryParams : ''}`;
            return `curl '${url}' \\\n  -H 'Authorization: Bearer agk_YOUR_API_KEY'`;
        }
        const bodyFields = allParams.filter(p => p.in === 'body');
        const bodyStr = bodyFields.length > 0
            ? `  -d '${JSON.stringify(Object.fromEntries(bodyFields.map(p => [p.name, p.type === 'integer' ? 1 : p.type === 'array' ? [] : '...'])), null, 0)}'`
            : '';
        return `curl -X POST '${base}${ep.path}' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Authorization: Bearer agk_YOUR_API_KEY'${bodyStr ? ' \\\n' + bodyStr : ''}`;
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(buildCurl());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Example response
    const getExampleResponse = () => {
        const resp200 = ep.responses?.['200'];
        if (!resp200?.content?.['application/json']?.schema?.properties) return null;
        const props = resp200.content['application/json'].schema.properties;
        const example: Record<string, any> = {};
        Object.entries(props).forEach(([key, val]: [string, any]) => {
            if (val.example !== undefined) example[key] = val.example;
            else if (val.type === 'boolean') example[key] = true;
            else if (val.type === 'string') example[key] = '...';
            else if (val.type === 'integer') example[key] = 0;
            else if (val.type === 'number') example[key] = 0;
            else if (val.type === 'array') example[key] = ['...'];
            else example[key] = {};
        });
        return JSON.stringify(example, null, 2);
    };

    return (
        <div className="border border-gray-800 rounded-lg overflow-hidden mb-3 hover:border-gray-600 transition-all duration-200">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-900/50 transition-colors">
                <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded border uppercase tracking-wider ${methodColor}`}>
                    {ep.method}
                </span>
                <code className="text-sm text-white font-mono font-semibold flex-1">{ep.path}</code>
                {isPublic
                    ? <Unlock size={12} className="text-green-500" title="No auth required" />
                    : <Lock size={12} className="text-yellow-500" title="API key required" />
                }
                <span className="text-xs text-gray-500 hidden md:inline max-w-[200px] truncate">{ep.summary}</span>
                {open ? <ChevronDown size={14} className="text-gray-600" /> : <ChevronRight size={14} className="text-gray-600" />}
            </button>

            {open && (
                <div className="border-t border-gray-800 bg-black/40">
                    {/* Description */}
                    {ep.description && (
                        <div className="px-4 py-3 border-b border-gray-800/50">
                            <p className="text-sm text-gray-400">{ep.description}</p>
                        </div>
                    )}

                    {/* Parameters */}
                    {allParams.length > 0 && (
                        <div className="px-4 py-3 border-b border-gray-800/50">
                            <h5 className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-2">Parameters</h5>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead><tr className="text-gray-600">
                                        <th className="text-left pb-1 pr-4">Name</th>
                                        <th className="text-left pb-1 pr-4">Type</th>
                                        <th className="text-left pb-1 pr-4">In</th>
                                        <th className="text-left pb-1 pr-4">Required</th>
                                        <th className="text-left pb-1">Description</th>
                                    </tr></thead>
                                    <tbody>
                                        {allParams.map(p => (
                                            <tr key={p.name} className="border-t border-gray-900/50">
                                                <td className="py-1.5 pr-4"><code className="text-blue-400">{p.name}</code></td>
                                                <td className="pr-4 text-gray-500">{p.type}</td>
                                                <td className="pr-4"><span className={`text-[9px] px-1.5 py-0.5 rounded ${p.in === 'body' ? 'bg-blue-900/30 text-blue-400' : p.in === 'path' ? 'bg-orange-900/30 text-orange-400' : 'bg-gray-800 text-gray-400'}`}>{p.in}</span></td>
                                                <td className="pr-4">{p.required ? <span className="text-red-400 text-sm">●</span> : <span className="text-gray-700">○</span>}</td>
                                                <td className="text-gray-400">{p.desc}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* cURL */}
                    <div className="px-4 py-3 border-b border-gray-800/50">
                        <div className="flex items-center justify-between mb-2">
                            <h5 className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">cURL Example</h5>
                            <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-white transition-colors">
                                {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
                                {copied ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                        <pre className="text-[11px] text-green-400/80 bg-gray-950 p-3 rounded-lg overflow-x-auto font-mono leading-relaxed">{buildCurl()}</pre>
                    </div>

                    {/* Response */}
                    {getExampleResponse() && (
                        <div className="px-4 py-3">
                            <h5 className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-2">Example Response</h5>
                            <pre className="text-[11px] text-cyan-400/80 bg-gray-950 p-3 rounded-lg overflow-x-auto font-mono leading-relaxed">{getExampleResponse()}</pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/* ━━━ Main Swagger UI Page ━━━ */
export const SwaggerUI: React.FC = () => {
    const [spec, setSpec] = useState<any>(null);
    const [endpoints, setEndpoints] = useState<EndpointInfo[]>([]);
    const [activeTag, setActiveTag] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetch('/openapi.json')
            .then(r => r.json())
            .then(data => {
                setSpec(data);
                const eps: EndpointInfo[] = [];
                if (data.paths) {
                    Object.entries(data.paths).forEach(([path, methods]: [string, any]) => {
                        Object.entries(methods).forEach(([method, info]: [string, any]) => {
                            eps.push({
                                path,
                                method,
                                summary: info.summary || '',
                                description: info.description || '',
                                operationId: info.operationId || '',
                                tags: info.tags || ['Other'],
                                security: info.security,
                                parameters: info.parameters,
                                requestBody: info.requestBody,
                                responses: info.responses,
                            });
                        });
                    });
                }
                setEndpoints(eps);
            })
            .catch(console.error);
    }, []);

    const tags = spec?.tags?.map((t: any) => t.name) || [];
    const filteredEndpoints = endpoints.filter(ep => {
        const matchTag = activeTag === 'all' || ep.tags.includes(activeTag);
        const matchSearch = !searchQuery || ep.path.toLowerCase().includes(searchQuery.toLowerCase()) || ep.summary.toLowerCase().includes(searchQuery.toLowerCase());
        return matchTag && matchSearch;
    });

    if (!spec) return (
        <div className="min-h-screen bg-terminal-bg flex items-center justify-center">
            <div className="text-gray-500 animate-pulse">Loading API specification...</div>
        </div>
    );

    return (
        <div className="min-h-screen bg-terminal-bg text-terminal-text">
            <div className="max-w-5xl mx-auto p-6">
                {/* Header */}
                <header className="mb-8 border-b border-gray-800 pb-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg border border-blue-500/30">
                            <BookOpen className="text-blue-400" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">{spec.info.title}</h1>
                            <span className="text-xs text-gray-500">v{spec.info.version}</span>
                        </div>
                    </div>
                    <p className="text-sm text-gray-400 max-w-3xl mb-4">{spec.info.description}</p>

                    {/* Server Info */}
                    <div className="flex flex-wrap gap-3 mb-4">
                        {spec.servers?.map((s: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs">
                                <Server size={12} className={i === 0 ? 'text-green-400' : 'text-yellow-400'} />
                                <code className="text-gray-300">{s.url}</code>
                                <span className="text-gray-600">— {s.description}</span>
                            </div>
                        ))}
                    </div>

                    {/* Quick Links */}
                    <div className="flex flex-wrap gap-3">
                        <a href="/openapi.json" target="_blank" className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                            <ExternalLink size={11} /> OpenAPI JSON
                        </a>
                        <a href="/#/agent/docs" className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors">
                            <BookOpen size={11} /> API Guide
                        </a>
                        <a href="/#/playground" className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors">
                            <Zap size={11} /> Playground
                        </a>
                    </div>
                </header>

                {/* Auth Info */}
                <div className="mb-6 p-4 bg-gradient-to-r from-yellow-500/5 to-orange-500/5 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <Lock size={14} className="text-yellow-400" />
                        <span className="text-sm font-bold text-white">Authentication</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">Protected endpoints require an API key passed as a Bearer token or in the request body.</p>
                    <code className="text-[11px] text-yellow-400/80 bg-black/30 px-3 py-1.5 rounded block font-mono">
                        Authorization: Bearer agk_your_api_key_here
                    </code>
                </div>

                {/* Search & Tag Filter */}
                <div className="flex flex-col md:flex-row gap-3 mb-6">
                    <input
                        type="text"
                        placeholder="Search endpoints..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500/50 focus:outline-none transition-colors"
                    />
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            onClick={() => setActiveTag('all')}
                            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all ${activeTag === 'all' ? 'bg-white/10 text-white border-white/20' : 'text-gray-500 border-gray-800 hover:border-gray-600'}`}
                        >
                            All ({endpoints.length})
                        </button>
                        {tags.map((tag: string) => {
                            const count = endpoints.filter(e => e.tags.includes(tag)).length;
                            return (
                                <button
                                    key={tag}
                                    onClick={() => setActiveTag(activeTag === tag ? 'all' : tag)}
                                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all flex items-center gap-1.5 ${activeTag === tag ? 'bg-white/10 text-white border-white/20' : 'text-gray-500 border-gray-800 hover:border-gray-600'}`}
                                >
                                    <Tag size={9} className={TAG_COLORS[tag] || 'text-gray-400'} />
                                    {tag} ({count})
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Endpoints */}
                <div>
                    {activeTag === 'all' ? (
                        tags.map((tag: string) => {
                            const tagEps = filteredEndpoints.filter(ep => ep.tags.includes(tag));
                            if (tagEps.length === 0) return null;
                            const tagDesc = spec.tags?.find((t: any) => t.name === tag)?.description || '';
                            return (
                                <div key={tag} className="mb-8">
                                    <div className="flex items-center gap-2 mb-3">
                                        <h2 className={`text-sm font-bold uppercase tracking-wider ${TAG_COLORS[tag] || 'text-gray-400'}`}>{tag}</h2>
                                        {tagDesc && <span className="text-[10px] text-gray-600">— {tagDesc}</span>}
                                    </div>
                                    {tagEps.map(ep => <EndpointCard key={ep.operationId} ep={ep} />)}
                                </div>
                            );
                        })
                    ) : (
                        filteredEndpoints.map(ep => <EndpointCard key={ep.operationId} ep={ep} />)
                    )}
                </div>

                {/* Footer */}
                <footer className="mt-12 border-t border-gray-800 pt-6 text-center text-xs text-gray-600">
                    <p>JSONMart Agent Commerce API v{spec.info.version} · Agent-Native Commerce Infrastructure</p>
                    <p className="mt-1">Built for AI agents. Documented for developers. Verified by machines.</p>
                </footer>
            </div>
        </div>
    );
};
