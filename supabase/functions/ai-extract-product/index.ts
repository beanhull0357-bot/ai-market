// supabase/functions/ai-extract-product/index.ts
// Gemini 2.0 Flash — 상품 이미지 → 구조화 JSON 변환
// Deploy: supabase functions deploy ai-extract-product
// Secret: supabase secrets set GEMINI_API_KEY=your_key

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-seller-key',
};

interface ExtractRequest {
    image_urls: string[];
    category: string;
    title: string;
    schema_fields?: { key: string; label: string }[];
}

// ─── Build structured prompt ───
function buildPrompt(req: ExtractRequest): string {
    const fieldList = req.schema_fields?.map(f => `- ${f.key}: ${f.label}`).join('\n') || '';

    return `You are an AI product detail extractor for a B2B wholesale marketplace.
Analyze the provided product images and extract structured information.

Product Title: "${req.title}"
Category: "${req.category}"

${fieldList ? `Expected fields to extract:\n${fieldList}` : ''}

Return a JSON object with this exact structure (fill what you can detect, leave empty string for what you can't):
{
  "specs": {
    // Key-value pairs of product specifications detected from images
    // Examples: "material": "cotton 65%, polyester 35%", "size": "Free (56-59cm)"
  },
  "features": [
    // Array of notable product features detected
  ],
  "use_cases": [
    // Suggested use cases based on product type
  ],
  "care_instructions": [
    // Care/maintenance instructions if detectable
  ],
  "warnings": [
    // Any warnings or cautions detected
  ],
  "certifications": [
    // Any certifications or quality marks detected (KC, CE, etc.)
  ],
  "ai_summary": "One-line summary of the product in Korean",
  "detected_text": [
    // Any text detected in the images (labels, tags, descriptions)
  ],
  "confidence": 0.85
}

RULES:
1. Respond ONLY with valid JSON, no markdown, no explanation
2. Write the ai_summary in Korean
3. Extract ALL visible text from images (labels, tags, packaging text)
4. If you detect size/color/material from images, include them in specs
5. Confidence should be 0.0-1.0 based on how much you could extract`;
}

// ─── Fetch image and convert to base64 ───
async function imageUrlToBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'JSONMart-AI-Extractor/1.0' },
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) return null;

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const buffer = await response.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

        return { data: base64, mimeType: contentType.split(';')[0] };
    } catch (e) {
        console.error(`Failed to fetch image: ${url}`, e);
        return null;
    }
}

// ─── Main handler ───
Deno.serve(async (req: Request) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }

    try {
        const apiKey = Deno.env.get('GEMINI_API_KEY');
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
                status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        const body: ExtractRequest = await req.json();
        if (!body.image_urls?.length) {
            return new Response(JSON.stringify({ error: 'image_urls required' }), {
                status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        // ─── Build Gemini request ───
        const parts: any[] = [{ text: buildPrompt(body) }];

        // Convert images to base64 and add to request
        const imageResults = await Promise.all(
            body.image_urls.slice(0, 5).map(url => imageUrlToBase64(url))
        );

        for (const img of imageResults) {
            if (img) {
                parts.push({
                    inlineData: { mimeType: img.mimeType, data: img.data }
                });
            }
        }

        const loadedImages = imageResults.filter(Boolean).length;
        if (loadedImages === 0) {
            // No images loaded — do text-only extraction
            parts[0] = { text: buildPrompt(body) + '\n\nNote: No images available, extract what you can from the title and category alone.' };
        }

        // ─── Call Gemini API ───
        const geminiResponse = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 2048,
                    responseMimeType: 'application/json',
                },
            }),
        });

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error('Gemini API error:', geminiResponse.status, errorText);
            return new Response(JSON.stringify({
                error: 'GEMINI_API_ERROR',
                status: geminiResponse.status,
                message: `Gemini API returned ${geminiResponse.status}`,
            }), {
                status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        const geminiData = await geminiResponse.json();

        // ─── Parse Gemini response ───
        const textContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textContent) {
            return new Response(JSON.stringify({ error: 'Empty response from Gemini' }), {
                status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        // Clean and parse JSON response
        let extracted;
        try {
            const cleaned = textContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            extracted = JSON.parse(cleaned);
        } catch (parseErr) {
            console.error('Failed to parse Gemini JSON:', textContent);
            return new Response(JSON.stringify({
                error: 'PARSE_ERROR',
                message: 'Failed to parse AI response',
                raw: textContent.slice(0, 500),
            }), {
                status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        // ─── Return structured result ───
        return new Response(JSON.stringify({
            success: true,
            extracted_by: 'gemini-2.0-flash',
            images_analyzed: loadedImages,
            ...extracted,
        }), {
            status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error('Extraction error:', err);
        return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: String(err) }), {
            status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }
});
