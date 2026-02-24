/**
 * JSONMart × Gemini — Interactive CLI Chat
 *
 * Usage:
 *   GEMINI_API_KEY=<your_key> node index.js
 *
 * Gemini will automatically decide when to call JSONMart API functions
 * based on the conversation. No manual routing needed.
 */

import readline from 'readline';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { jsonmartFunctionDeclarations, executeFunction } from './functions.js';

// ━━━ Config ━━━
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
    console.error('   실행: GEMINI_API_KEY=your_key node index.js');
    process.exit(1);
}

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';

// ━━━ Gemini Setup ━━━
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: `당신은 JSONMart B2B AI 마켓플레이스의 구매 도우미 에이전트입니다.

JSONMart는 AI 에이전트를 위한 B2B 공급망 마켓플레이스로, 소모품·MRO·사무용품·IT 장비 등을 취급합니다.

당신의 역할:
- 상품 검색 및 비교를 통해 최적의 구매 의사 결정을 지원합니다.
- 현재 프로모션 및 할인 정보를 안내합니다.
- 주문 생성 및 주문 상태 조회를 도와드립니다.
- 셀러 신뢰도, 배송 기간, 가격을 분석하여 구체적인 추천을 제공합니다.

응답 스타일:
- 한국어로 응답합니다.
- 상품 비교 시 표 형식을 사용합니다.
- 가격은 항상 원화(₩) 형식으로 표시합니다.
- 구체적이고 실행 가능한 추천을 제공합니다.`,
    tools: [{ functionDeclarations: jsonmartFunctionDeclarations }],
    toolConfig: {
        functionCallingConfig: {
            mode: 'AUTO', // Gemini decides when to call functions automatically
        },
    },
});

// ━━━ Agentic Loop ━━━
// Handles multi-turn function calling until Gemini returns a final text response

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function agenticCall(chat, userMessage, retryCount = 0) {
    let response;
    try {
        response = await chat.sendMessage(userMessage);
    } catch (err) {
        // Parse retry delay from error message if rate limited
        const retryMatch = err.message?.match(/retry in (\d+(?:\.\d+)?)s/i)
            || err.message?.match(/"retryDelay":"(\d+)s"/);
        if (retryMatch && retryCount < 3) {
            const waitSec = Math.ceil(parseFloat(retryMatch[1])) + 2;
            console.log(`\n⏳ Rate limit 감지 — ${waitSec}초 후 자동 재시도... (${retryCount + 1}/3)`);
            await sleep(waitSec * 1000);
            return agenticCall(chat, userMessage, retryCount + 1);
        }
        throw err;
    }

    // Loop: if Gemini returns function calls, execute them and feed results back
    while (true) {
        const candidate = response.response.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        const functionCalls = parts.filter(p => p.functionCall);
        if (functionCalls.length === 0) break; // No more function calls — done

        // Execute all function calls in parallel
        const functionResults = await Promise.all(
            functionCalls.map(async (part) => {
                const { name, args } = part.functionCall;
                const result = await executeFunction(name, args);
                return {
                    functionResponse: {
                        name,
                        response: { result },
                    },
                };
            })
        );

        // Send function results back to Gemini
        try {
            response = await chat.sendMessage(functionResults);
        } catch (err) {
            const retryMatch = err.message?.match(/retry in (\d+(?:\.\d+)?)s/i)
                || err.message?.match(/"retryDelay":"(\d+)s"/);
            if (retryMatch && retryCount < 3) {
                const waitSec = Math.ceil(parseFloat(retryMatch[1])) + 2;
                console.log(`\n⏳ Rate limit — ${waitSec}초 후 재시도...`);
                await sleep(waitSec * 1000);
                response = await chat.sendMessage(functionResults);
            } else {
                throw err;
            }
        }
    }

    return response.response.text();
}


// ━━━ CLI Interface ━━━

async function main() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║   JSONMart × Gemini  구매 에이전트              ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  모델: ${MODEL.padEnd(42)}║`);
    console.log('║  종료: "exit" 또는 Ctrl+C                       ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    console.log('💡 예시 질문:');
    console.log('   • "물티슈 검색해줘"');
    console.log('   • "재고 있는 사무용품 10만원 이하로 찾아줘"');
    console.log('   • "현재 프로모션 알려줘"');
    console.log('   • "SKU-003과 SKU-007 비교해줘"');
    console.log('');

    const chat = model.startChat({ history: [] });
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const ask = () => {
        rl.question('You: ', async (input) => {
            const text = input.trim();
            if (!text) return ask();
            if (text.toLowerCase() === 'exit') {
                console.log('\n👋 JSONMart 에이전트를 종료합니다.');
                rl.close();
                return;
            }

            try {
                process.stdout.write('\nAssistant: ');
                const reply = await agenticCall(chat, text);
                console.log(reply);
                console.log('');
            } catch (err) {
                console.error(`\n❌ 오류: ${err.message}`);
            }

            ask();
        });
    };

    ask();
}

main();
