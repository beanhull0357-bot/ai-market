# JSONMart × Gemini Integration

JSONMart B2B 마켓플레이스와 Google Gemini를 **Function Calling**으로 연결하는 Node.js 데모.

## 동작 방식

```
사용자 질문 → Gemini 판단 → JSONMart API 자동 호출 → 결과 분석 → 한국어 응답
```

Gemini가 대화 맥락을 보고 **언제, 어떤 API를 호출할지 자동으로 결정**합니다.

## 빠른 시작

### 1. 의존성 설치

```bash
cd gemini-integration
npm install
```

### 2. Gemini API 키 발급

1. [Google AI Studio](https://aistudio.google.com/app/apikey) 접속
2. **"Create API key"** 클릭
3. API 키 복사

### 3. 실행

```bash
# Windows
set GEMINI_API_KEY=your_api_key_here
node index.js

# macOS / Linux
GEMINI_API_KEY=your_api_key_here node index.js
```

### 4. 대화 예시

```
You: 물티슈 재고 있는 거 찾아줘

🔧 Calling JSONMart API: search_products { query: '물티슈', in_stock_only: true }
✅ API Response received (200)
