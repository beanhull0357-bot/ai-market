import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Workflow, Play, Save, Plus, Trash2, Settings, Search, Shield, Radio, TrendingUp, ShoppingCart, AlertTriangle, CheckCircle2, ChevronDown, Bot, Zap, Eye, ArrowRight, RotateCcw } from 'lucide-react';
import { useProducts } from '../hooks';
import { useLanguage } from '../context/LanguageContext';

// ━━━ Workflow Node Types ━━━

type NodeType = 'POLICY' | 'SEARCH' | 'FILTER' | 'A2A_CHECK' | 'NEGOTIATE' | 'ORDER' | 'CONDITION' | 'NOTIFY';

interface WorkflowNode {
    id: string;
    type: NodeType;
    label: string;
    config: Record<string, any>;
    x: number;
    y: number;
}

interface WorkflowEdge {
    from: string;
    to: string;
    label?: string;
}

interface SimulationStep {
    nodeId: string;
    status: 'PASS' | 'FAIL' | 'SKIP' | 'RUNNING';
    message: string;
    durationMs: number;
}

interface WorkflowDef {
    id: string;
    name: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    createdAt: string;
}

// ━━━ Node Definitions ━━━

const NODE_DEFS: Record<NodeType, { icon: React.ReactNode; label: string; color: string; defaultConfig: Record<string, any>; configFields: { key: string; label: string; type: 'number' | 'text' | 'select'; options?: string[] }[] }> = {
    POLICY: {
        icon: <Shield size={16} />, label: 'Policy Load', color: '#8b5cf6',
        defaultConfig: { maxBudget: 50000, minTrust: 75, maxDeliveryDays: 3 },
        configFields: [
            { key: 'maxBudget', label: 'Max Budget (₩)', type: 'number' },
            { key: 'minTrust', label: 'Min Trust Score', type: 'number' },
            { key: 'maxDeliveryDays', label: 'Max Delivery Days', type: 'number' },
        ],
    },
    SEARCH: {
        icon: <Search size={16} />, label: 'Catalog Search', color: '#06b6d4',
        defaultConfig: { category: 'ALL', keyword: '', limit: 20 },
        configFields: [
            { key: 'category', label: 'Category', type: 'select', options: ['ALL', 'CONSUMABLES', 'MRO', 'ELECTRONICS'] },
            { key: 'keyword', label: 'Keyword', type: 'text' },
            { key: 'limit', label: 'Max Results', type: 'number' },
        ],
    },
    FILTER: {
        icon: <Settings size={16} />, label: 'Filter & Rank', color: '#f59e0b',
        defaultConfig: { sortBy: 'price', inStockOnly: true },
        configFields: [
            { key: 'sortBy', label: 'Sort By', type: 'select', options: ['price', 'trust', 'delivery'] },
        ],
    },
    A2A_CHECK: {
        icon: <Radio size={16} />, label: 'A2A Cross-check', color: '#a78bfa',
        defaultConfig: { minEndorsements: 1, ttlHours: 2 },
        configFields: [
            { key: 'minEndorsements', label: 'Min Endorsements', type: 'number' },
            { key: 'ttlHours', label: 'TTL (hours)', type: 'number' },
        ],
    },
    NEGOTIATE: {
        icon: <TrendingUp size={16} />, label: 'Price Negotiation', color: '#f97316',
        defaultConfig: { maxRounds: 5, targetDiscount: 10 },
        configFields: [
            { key: 'maxRounds', label: 'Max Rounds', type: 'number' },
            { key: 'targetDiscount', label: 'Target Discount (%)', type: 'number' },
        ],
    },
    ORDER: {
        icon: <ShoppingCart size={16} />, label: 'Create Order', color: '#34d399',
        defaultConfig: { autoConfirm: true, qty: 1 },
        configFields: [
            { key: 'qty', label: 'Quantity', type: 'number' },
        ],
    },
    CONDITION: {
        icon: <AlertTriangle size={16} />, label: 'Condition Check', color: '#ef4444',
        defaultConfig: { condition: 'price < budget', failAction: 'stop' },
        configFields: [
            { key: 'condition', label: 'Condition', type: 'text' },
            { key: 'failAction', label: 'On Fail', type: 'select', options: ['stop', 'retry', 'skip'] },
        ],
    },
    NOTIFY: {
        icon: <Zap size={16} />, label: 'Webhook/Notify', color: '#ec4899',
        defaultConfig: { channel: 'webhook', url: '' },
        configFields: [
            { key: 'channel', label: 'Channel', type: 'select', options: ['webhook', 'email', 'slack'] },
        ],
    },
};

const DEFAULT_WORKFLOW: WorkflowDef = {
    id: 'WF-DEFAULT',
    name: 'Standard Procurement',
    nodes: [
        { id: 'n1', type: 'POLICY', label: 'Policy Load', config: NODE_DEFS.POLICY.defaultConfig, x: 80, y: 60 },
        { id: 'n2', type: 'SEARCH', label: 'Catalog Search', config: NODE_DEFS.SEARCH.defaultConfig, x: 80, y: 160 },
        { id: 'n3', type: 'FILTER', label: 'Filter & Rank', config: NODE_DEFS.FILTER.defaultConfig, x: 80, y: 260 },
        { id: 'n4', type: 'A2A_CHECK', label: 'A2A Cross-check', config: NODE_DEFS.A2A_CHECK.defaultConfig, x: 80, y: 360 },
        { id: 'n5', type: 'NEGOTIATE', label: 'Price Negotiation', config: NODE_DEFS.NEGOTIATE.defaultConfig, x: 80, y: 460 },
        { id: 'n6', type: 'ORDER', label: 'Create Order', config: NODE_DEFS.ORDER.defaultConfig, x: 80, y: 560 },
    ],
    edges: [
        { from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' },
        { from: 'n3', to: 'n4' }, { from: 'n4', to: 'n5' },
        { from: 'n5', to: 'n6' },
    ],
    createdAt: new Date().toISOString(),
};

// ━━━ Canvas Flow Renderer ━━━

function FlowCanvas({ workflow, selectedNodeId, simResults, onSelectNode }: {
    workflow: WorkflowDef; selectedNodeId: string | null;
    simResults: Record<string, SimulationStep>; onSelectNode: (id: string) => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, rect.width, rect.height);

        const nodeW = 200;
        const nodeH = 52;

        // Draw edges
        workflow.edges.forEach(e => {
            const fromNode = workflow.nodes.find(n => n.id === e.from);
            const toNode = workflow.nodes.find(n => n.id === e.to);
            if (!fromNode || !toNode) return;

            const x1 = fromNode.x + nodeW / 2;
            const y1 = fromNode.y + nodeH;
            const x2 = toNode.x + nodeW / 2;
            const y2 = toNode.y;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            const midY = (y1 + y2) / 2;
            ctx.bezierCurveTo(x1, midY, x2, midY, x2, y2);

            const fromSim = simResults[e.from];
            if (fromSim?.status === 'PASS') {
                ctx.strokeStyle = 'rgba(52,211,153,0.6)';
                ctx.lineWidth = 2;
            } else if (fromSim?.status === 'FAIL') {
                ctx.strokeStyle = 'rgba(239,68,68,0.4)';
                ctx.lineWidth = 1.5;
            } else {
                ctx.strokeStyle = 'rgba(255,255,255,0.08)';
                ctx.lineWidth = 1;
            }
            ctx.stroke();

            // Arrow
            const angle = Math.atan2(y2 - midY, x2 - x1 || 0.001);
            const arrowSize = 6;
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - arrowSize * Math.cos(angle - 0.5), y2 - arrowSize * Math.sin(angle - 0.5));
            ctx.lineTo(x2 - arrowSize * Math.cos(angle + 0.5), y2 - arrowSize * Math.sin(angle + 0.5));
            ctx.closePath();
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fill();
        });

        // Draw nodes
        workflow.nodes.forEach(node => {
            const def = NODE_DEFS[node.type];
            const sim = simResults[node.id];
            const isSelected = node.id === selectedNodeId;

            // Background
            ctx.fillStyle = isSelected ? 'rgba(34,211,238,0.08)' : 'rgba(15,15,20,0.9)';
            ctx.strokeStyle = sim?.status === 'PASS' ? 'rgba(52,211,153,0.6)'
                : sim?.status === 'FAIL' ? 'rgba(239,68,68,0.6)'
                    : sim?.status === 'RUNNING' ? 'rgba(34,211,238,0.6)'
                        : isSelected ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.08)';
            ctx.lineWidth = isSelected || sim ? 2 : 1;

            const radius = 10;
            ctx.beginPath();
            ctx.moveTo(node.x + radius, node.y);
            ctx.lineTo(node.x + nodeW - radius, node.y);
            ctx.arcTo(node.x + nodeW, node.y, node.x + nodeW, node.y + radius, radius);
            ctx.lineTo(node.x + nodeW, node.y + nodeH - radius);
            ctx.arcTo(node.x + nodeW, node.y + nodeH, node.x + nodeW - radius, node.y + nodeH, radius);
            ctx.lineTo(node.x + radius, node.y + nodeH);
            ctx.arcTo(node.x, node.y + nodeH, node.x, node.y + nodeH - radius, radius);
            ctx.lineTo(node.x, node.y + radius);
            ctx.arcTo(node.x, node.y, node.x + radius, node.y, radius);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Icon dot
            ctx.fillStyle = def.color;
            ctx.beginPath();
            ctx.arc(node.x + 20, node.y + nodeH / 2, 6, 0, Math.PI * 2);
            ctx.fill();

            // Label
            ctx.fillStyle = '#e4e4e7';
            ctx.font = 'bold 12px Inter, system-ui, sans-serif';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.label, node.x + 34, node.y + nodeH / 2 - 6);

            // Sublabel
            ctx.fillStyle = 'rgba(161,161,170,0.6)';
            ctx.font = '10px "JetBrains Mono", monospace';
            const subLabel = sim ? `${sim.status} • ${sim.durationMs}ms` : node.type;
            ctx.fillText(subLabel, node.x + 34, node.y + nodeH / 2 + 10);

            // Status indicator
            if (sim) {
                const statusColor = sim.status === 'PASS' ? '#34d399' : sim.status === 'FAIL' ? '#ef4444' : sim.status === 'RUNNING' ? '#22d3ee' : '#6b7280';
                ctx.fillStyle = statusColor;
                ctx.beginPath();
                ctx.arc(node.x + nodeW - 16, node.y + nodeH / 2, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }, [workflow, selectedNodeId, simResults]);

    useEffect(() => { draw(); }, [draw]);

    const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        for (const node of workflow.nodes) {
            if (x >= node.x && x <= node.x + 200 && y >= node.y && y <= node.y + 52) {
                onSelectNode(node.id);
                return;
            }
        }
    };

    return (
        <canvas
            ref={canvasRef}
            onClick={handleClick}
            style={{
                width: '100%', height: '100%', display: 'block', cursor: 'pointer',
                borderRadius: 'var(--radius-lg)',
            }}
        />
    );
}

// ━━━ Main Page ━━━

export function WorkflowBuilder() {
    const { t } = useLanguage();
    const { products } = useProducts();
    const [workflow, setWorkflow] = useState<WorkflowDef>({ ...DEFAULT_WORKFLOW });
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>('n1');
    const [simResults, setSimResults] = useState<Record<string, SimulationStep>>({});
    const [isSimulating, setIsSimulating] = useState(false);
    const [savedWorkflows, setSavedWorkflows] = useState<WorkflowDef[]>([]);
    const [workflowName, setWorkflowName] = useState(DEFAULT_WORKFLOW.name);

    const selectedNode = workflow.nodes.find(n => n.id === selectedNodeId);

    const updateNodeConfig = (nodeId: string, key: string, value: any) => {
        setWorkflow(prev => ({
            ...prev,
            nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, config: { ...n.config, [key]: value } } : n),
        }));
    };

    const addNode = (type: NodeType) => {
        const def = NODE_DEFS[type];
        const maxY = Math.max(...workflow.nodes.map(n => n.y), 0);
        const lastNode = workflow.nodes[workflow.nodes.length - 1];
        const newNode: WorkflowNode = {
            id: `n${Date.now()}`, type, label: def.label,
            config: { ...def.defaultConfig }, x: 80, y: maxY + 100,
        };
        const newEdge: WorkflowEdge = lastNode ? { from: lastNode.id, to: newNode.id } : { from: newNode.id, to: newNode.id };
        setWorkflow(prev => ({
            ...prev,
            nodes: [...prev.nodes, newNode],
            edges: lastNode ? [...prev.edges, newEdge] : prev.edges,
        }));
        setSelectedNodeId(newNode.id);
    };

    const removeNode = (nodeId: string) => {
        setWorkflow(prev => ({
            ...prev,
            nodes: prev.nodes.filter(n => n.id !== nodeId),
            edges: prev.edges.filter(e => e.from !== nodeId && e.to !== nodeId),
        }));
        if (selectedNodeId === nodeId) setSelectedNodeId(null);
    };

    const runSimulation = useCallback(async () => {
        setIsSimulating(true);
        setSimResults({});

        for (const node of workflow.nodes) {
            // Set running
            setSimResults(prev => ({ ...prev, [node.id]: { nodeId: node.id, status: 'RUNNING', message: 'Processing...', durationMs: 0 } }));
            setSelectedNodeId(node.id);

            await new Promise(r => setTimeout(r, 400 + Math.random() * 600));

            const duration = Math.floor(5 + Math.random() * 300);
            const pass = Math.random() > 0.12;
            const messages: Record<NodeType, () => string> = {
                POLICY: () => `Loaded policy — Budget: ₩${node.config.maxBudget?.toLocaleString()}, Trust ≥ ${node.config.minTrust}`,
                SEARCH: () => `Found ${products.length} products in ${node.config.category || 'ALL'}`,
                FILTER: () => `${Math.max(1, products.length - Math.floor(Math.random() * 2))} products passed filters, sorted by ${node.config.sortBy}`,
                A2A_CHECK: () => pass ? `${1 + Math.floor(Math.random() * 3)} endorsements received` : 'BLOCKLIST warning from peer agent',
                NEGOTIATE: () => pass ? `Negotiated ${node.config.targetDiscount}% discount in ${1 + Math.floor(Math.random() * node.config.maxRounds)} rounds` : 'Failed to reach agreement',
                ORDER: () => pass ? `Order created: ${node.config.qty} units` : 'Insufficient stock',
                CONDITION: () => pass ? `Condition "${node.config.condition}" satisfied` : `Condition "${node.config.condition}" failed`,
                NOTIFY: () => `Notification sent via ${node.config.channel}`,
            };

            setSimResults(prev => ({
                ...prev,
                [node.id]: {
                    nodeId: node.id,
                    status: pass ? 'PASS' : 'FAIL',
                    message: messages[node.type](),
                    durationMs: duration,
                },
            }));

            if (!pass && node.type !== 'NOTIFY') break; // stop on failure
        }

        setIsSimulating(false);
    }, [workflow, products]);

    const saveWorkflow = () => {
        const wf = { ...workflow, id: `WF-${Date.now().toString(36).toUpperCase()}`, name: workflowName, createdAt: new Date().toISOString() };
        setSavedWorkflows(prev => [wf, ...prev]);
    };

    const loadWorkflow = (wf: WorkflowDef) => {
        setWorkflow({ ...wf });
        setWorkflowName(wf.name);
        setSimResults({});
        setSelectedNodeId(wf.nodes[0]?.id || null);
    };

    const simValues: SimulationStep[] = Object.values(simResults);
    const totalSimDuration = simValues.reduce((a, s) => a + s.durationMs, 0);
    const passCount = simValues.filter(s => s.status === 'PASS').length;

    return (
        <div className="page-enter" style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(16px, 4vw, 32px)' }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 'var(--radius-md)',
                            background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.15))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Workflow size={20} style={{ color: 'var(--accent-amber)' }} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Agent Workflow Builder</h1>
                            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>노코드로 AI 구매 에이전트의 워크플로우를 설계하세요</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={saveWorkflow} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-card)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: 11, cursor: 'pointer',
                        }}>
                            <Save size={12} /> Save
                        </button>
                        <button onClick={runSimulation} disabled={isSimulating} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                            borderRadius: 'var(--radius-md)', border: 'none',
                            background: isSimulating ? 'var(--border-subtle)' : 'linear-gradient(135deg, var(--accent-green), #059669)',
                            color: isSimulating ? 'var(--text-dim)' : '#000', fontWeight: 700, fontSize: 11, cursor: isSimulating ? 'default' : 'pointer',
                        }}>
                            <Play size={12} /> {isSimulating ? 'Simulating...' : 'Run Simulation'}
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }} className="grid-responsive-bento">
                {/* Main Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Workflow Name */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                            value={workflowName} onChange={e => setWorkflowName(e.target.value)}
                            style={{
                                flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-md)',
                                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, outline: 'none',
                            }}
                        />
                        {Object.keys(simResults).length > 0 && (
                            <span style={{
                                padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: 10, fontWeight: 700,
                                background: passCount === workflow.nodes.length ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                                color: passCount === workflow.nodes.length ? '#34d399' : '#ef4444',
                                fontFamily: 'var(--font-mono)',
                            }}>
                                {passCount}/{workflow.nodes.length} PASS • {totalSimDuration}ms
                            </span>
                        )}
                    </div>

                    {/* Canvas */}
                    <div style={{
                        borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-card)', height: Math.max(400, workflow.nodes.length * 100 + 60), position: 'relative',
                        overflow: 'hidden',
                        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.02) 1px, transparent 1px)',
                        backgroundSize: '20px 20px',
                    }}>
                        <FlowCanvas workflow={workflow} selectedNodeId={selectedNodeId} simResults={simResults} onSelectNode={setSelectedNodeId} />
                    </div>

                    {/* Node Palette */}
                    <div style={{
                        padding: '12px 16px', borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)', background: 'var(--bg-card)',
                    }}>
                        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>
                            Add Node
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {(Object.keys(NODE_DEFS) as NodeType[]).map(type => {
                                const def = NODE_DEFS[type];
                                return (
                                    <button key={type} onClick={() => addNode(type)} style={{
                                        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                                        borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
                                        background: 'var(--bg-elevated)', color: def.color,
                                        fontSize: 10, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms',
                                    }}>
                                        {def.icon} {def.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Saved Workflows */}
                    {savedWorkflows.length > 0 && (
                        <div style={{
                            padding: '12px 16px', borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-subtle)', background: 'var(--bg-card)',
                        }}>
                            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>
                                Saved Workflows
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {savedWorkflows.map(wf => (
                                    <div key={wf.id} onClick={() => loadWorkflow(wf)} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--border-subtle)', cursor: 'pointer',
                                        background: 'var(--bg-elevated)', transition: 'background 150ms',
                                    }}>
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{wf.name}</div>
                                            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                                                {wf.nodes.length} nodes • {wf.id}
                                            </div>
                                        </div>
                                        <ArrowRight size={12} style={{ color: 'var(--text-dim)' }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel: Node Config + Sim Results */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Node Properties */}
                    {selectedNode ? (
                        <div style={{
                            borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-card)', overflow: 'hidden',
                        }}>
                            <div style={{
                                padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ color: NODE_DEFS[selectedNode.type].color }}>{NODE_DEFS[selectedNode.type].icon}</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedNode.label}</span>
                                </div>
                                <button onClick={() => removeNode(selectedNode.id)} style={{
                                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', padding: 4,
                                }}>
                                    <Trash2 size={13} />
                                </button>
                            </div>
                            <div style={{ padding: '12px 16px' }}>
                                {/* Label edit */}
                                <div style={{ marginBottom: 12 }}>
                                    <label style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Label</label>
                                    <input
                                        value={selectedNode.label}
                                        onChange={e => setWorkflow(prev => ({
                                            ...prev,
                                            nodes: prev.nodes.map(n => n.id === selectedNode.id ? { ...n, label: e.target.value } : n),
                                        }))}
                                        style={{
                                            width: '100%', padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                                            background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
                                            color: 'var(--text-secondary)', fontSize: 11, outline: 'none',
                                        }}
                                    />
                                </div>

                                {/* Config fields */}
                                {NODE_DEFS[selectedNode.type].configFields.map(field => (
                                    <div key={field.key} style={{ marginBottom: 10 }}>
                                        <label style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                                            {field.label}
                                        </label>
                                        {field.type === 'select' ? (
                                            <select
                                                value={selectedNode.config[field.key] || ''}
                                                onChange={e => updateNodeConfig(selectedNode.id, field.key, e.target.value)}
                                                style={{
                                                    width: '100%', padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                                                    background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
                                                    color: 'var(--text-secondary)', fontSize: 11, outline: 'none',
                                                }}
                                            >
                                                {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        ) : (
                                            <input
                                                type={field.type} value={selectedNode.config[field.key] ?? ''}
                                                onChange={e => updateNodeConfig(selectedNode.id, field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                                                style={{
                                                    width: '100%', padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                                                    background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
                                                    color: 'var(--text-secondary)', fontSize: 11, outline: 'none',
                                                }}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-card)', padding: 32, textAlign: 'center',
                        }}>
                            <Settings size={28} style={{ color: 'var(--text-dim)', opacity: 0.3, marginBottom: 8 }} />
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Select a node to configure</div>
                        </div>
                    )}

                    {/* Simulation Log */}
                    {Object.keys(simResults).length > 0 && (
                        <div style={{
                            borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-card)', overflow: 'hidden',
                        }}>
                            <div style={{
                                padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)',
                                display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                                <Eye size={12} style={{ color: 'var(--accent-cyan)' }} />
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Simulation Log</span>
                            </div>
                            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                {workflow.nodes.map(node => {
                                    const sim = simResults[node.id];
                                    if (!sim) return null;
                                    return (
                                        <div key={node.id} style={{
                                            padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)',
                                            display: 'flex', alignItems: 'flex-start', gap: 8,
                                            animation: 'fadeIn 300ms',
                                        }}>
                                            <div style={{
                                                width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                                                background: sim.status === 'PASS' ? '#34d399' : sim.status === 'FAIL' ? '#ef4444' : sim.status === 'RUNNING' ? '#22d3ee' : '#6b7280',
                                            }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{node.label}</span>
                                                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{sim.durationMs}ms</span>
                                                </div>
                                                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{sim.message}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}
