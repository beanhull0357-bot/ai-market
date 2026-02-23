#!/usr/bin/env node
// JSONMart MCP stdio Wrapper v2
// Claude Desktop (stdio) → HTTP POST → Supabase Edge Function MCP Server

const MCP_URL = 'https://psiysvvcusfyfsfozywn.supabase.co/functions/v1/mcp';

// Track in-flight requests so we don't exit while they're pending
let pending = 0;
let stdinEnded = false;

function tryExit() {
    if (stdinEnded && pending === 0) process.exit(0);
}

async function handleMessage(raw) {
    let msg;
    try {
        msg = JSON.parse(raw);
    } catch {
        return;
    }

    // Notifications need no response
    if (!('id' in msg)) return;

    pending++;
    try {
        const res = await fetch(MCP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(msg),
        });
        const text = await res.text();
        process.stdout.write(text.trim() + '\n');
    } catch (err) {
        const errObj = {
            jsonrpc: '2.0',
            id: msg.id ?? null,
            error: { code: -32603, message: `Proxy error: ${err.message}` },
        };
        process.stdout.write(JSON.stringify(errObj) + '\n');
    } finally {
        pending--;
        tryExit();
    }
}

let buffer = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
        const t = line.trim();
        if (t) handleMessage(t);
    }
});

process.stdin.on('end', () => {
    stdinEnded = true;
    if (buffer.trim()) handleMessage(buffer.trim());
    tryExit();
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
