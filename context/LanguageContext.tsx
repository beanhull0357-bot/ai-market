import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'ko';

export const translations = {
  en: {
    nav: {
      humanMode: "Human Mode",
      agentConsole: "Agent Console",
      adminQueue: "Admin Queue",
      inventory: "Inventory",
      title: "JSONMart"
    },
    landing: {
      systemOnline: "System Online",
      heroTitle1: "Humans can browse.",
      heroTitle2: "Agents can buy.",
      heroSubtitle: "The first Agent-Native Marketplace. No images. No marketing copy. Just pure JSON, Policies, and Fulfillment for AI Agents.",
      btnConnect: "Connect Agent",
      btnViewCode: "View Store as Code",
      feature1Title: "Store speaks JSON",
      feature1Desc: "Products are defined by facts, not feelings. Specs, policies, and real-time stock status are served via API.",
      feature2Title: "Humans Can't Checkout",
      feature2Desc: "Purchase authority is delegated to agents via strict policy rules. Humans only oversee the approval queue.",
      feature3Title: "Fulfilled via Domeme",
      feature3Desc: "Seamless B2B fulfillment backend. Orders are verified and routed to wholesale suppliers.",
      catalogPreview: "Catalog Preview",
      catalogDesc: "This is how your agent sees our inventory. Optimized for LLM context windows and deterministic decision making.",
      list1: "Normalized Attributes",
      list2: "Machine-Readable Policies",
      list3: "AI Readiness Score",
      footerCopyright: "JSONMart Inc. © 2025. Agent-Native Commerce Infrastructure.",
      footerPrivacy: "Operating under strict privacy and delegation protocols.",
      agentReviews: "Agent Protocol Reviews",
      agentReviewsDesc: "Peer agents leave cryptographic attestations based on spec compliance and API latency.",
    },
    console: {
      title: "Agent Controller",
      labelPolicy: "Agent Policy (JSON)",
      btnRun: "Run Auto-Purchase",
      btnWorking: "Agent Working...",
      capabilityTitle: "Agent Capability",
      cap1: "Catalog Search API",
      cap2: "Policy Validation Engine",
      cap3: "24h Payment Auth Hold",
      cap4: "Domeme Fulfillment Trigger",
      waiting: "Waiting for agent execution command...",
      orderCreated: "Order Created",
      timerStarted: "24h Capture Timer Started",
      viewReceipt: "View Explainable Receipt",
      btnSimulateReview: "Simulate Delivery & Generate Review",
      reviewGenerated: "Protocol Review Published",
      simulateDefect: "Simulate Defect (Weight Mismatch)",
    },
    admin: {
      title: "Procurement Queue",
      subtitle: "Pending Approval (Authorized Payment Hold). Auto-void in 24h.",
      created: "Created",
      expiresIn: "Expires in",
      expired: "EXPIRED",
      voided: "VOIDED",
      totalAuth: "Total Authorization",
      riskFlags: "Risk Flags",
      btnReject: "Reject & Void",
      btnApprove: "Approve & Capture"
    },
    inventory: {
      title: "Inventory Management",
      subtitle: "Hybrid Management: Human Operations + AI Sourcing Agents",
      btnAdd: "Add Product (Manual)",
      btnAutoSource: "Run AI Sourcing Agent",
      tableSku: "SKU",
      tableProduct: "Product Name",
      tablePrice: "Price",
      tableStock: "Stock",
      tableAiScore: "AI Score",
      tableSource: "Source",
      sourceHuman: "HUMAN",
      sourceAi: "AI AGENT",
      sourcing: "AI Agent Scanning Wholesale Markets...",
      formTitle: "Add New Product",
      formSku: "SKU",
      formName: "Title",
      formPrice: "Price (KRW)",
      formStock: "Stock Qty",
      btnSave: "Register Product",
      btnCancel: "Cancel"
    },
    receipt: {
      title: "Explainable Receipt",
      trace: "Decision Trace",
      data: "Data Packet",
      footer: "This receipt is generated automatically by JSONMart Agent Core."
    },
    review: {
      verdict: "Verdict",
      latency: "Latency",
      compliance: "Spec Match",
      delta: "ETA Delta"
    },
    auth: {
      signIn: "Sign In",
      signUp: "Create Account",
      signInSubtitle: "Authenticate to delegate purchasing authority to your agent.",
      signUpSubtitle: "Register to connect your AI purchasing agent.",
      email: "Email",
      password: "Password",
      processing: "Processing...",
      signUpSuccess: "Account Created",
      checkEmail: "Check your email to verify your account, then sign in.",
      goToSignIn: "← Back to Sign In",
      hasAccount: "Already have an account? Sign In",
      noAccount: "No account? Create one",
      footer: "Your credentials are secured via Supabase Auth.",
      signOut: "Sign Out"
    }
  },
  ko: {
    nav: {
      humanMode: "휴먼 모드",
      agentConsole: "에이전트 콘솔",
      adminQueue: "관리자 큐",
      inventory: "재고 관리",
      title: "JSONMart"
    },
    landing: {
      systemOnline: "시스템 정상 작동",
      heroTitle1: "인간은 구경만 하세요.",
      heroTitle2: "구매는 에이전트가 합니다.",
      heroSubtitle: "최초의 에이전트 전용 마켓플레이스. 이미지도, 마케팅 문구도 없습니다. 오직 순수한 JSON, 정책, 그리고 AI 에이전트를 위한 풀필먼트만 존재합니다.",
      btnConnect: "에이전트 연결",
      btnViewCode: "스토어 코드 보기",
      feature1Title: "JSON으로 말하는 스토어",
      feature1Desc: "상품은 감성이 아닌 팩트로 정의됩니다. 스펙, 정책, 실시간 재고 현황이 API로 제공됩니다.",
      feature2Title: "인간은 결제 불가",
      feature2Desc: "구매 권한은 엄격한 정책 규칙에 따라 에이전트에게 위임됩니다. 인간은 승인 대기열만 감독합니다.",
      feature3Title: "도매매(Domeme) 연동",
      feature3Desc: "원활한 B2B 풀필먼트 백엔드. 주문이 검증되고 도매 공급업체로 라우팅됩니다.",
      catalogPreview: "카탈로그 미리보기",
      catalogDesc: "에이전트가 보는 인벤토리 모습입니다. LLM 컨텍스트 윈도우와 결정론적 의사결정에 최적화되어 있습니다.",
      list1: "정규화된 속성",
      list2: "기계 판독 가능한 정책",
      list3: "AI 준비도 점수",
      footerCopyright: "JSONMart Inc. © 2025. 에이전트 전용 상거래 인프라.",
      footerPrivacy: "엄격한 개인정보 보호 및 위임 프로토콜 하에 운영됩니다.",
      agentReviews: "에이전트 프로토콜 리뷰",
      agentReviewsDesc: "동료 에이전트들이 스펙 일치율과 API 지연 시간을 기반으로 암호화된 증명을 남깁니다.",
    },
    console: {
      title: "에이전트 컨트롤러",
      labelPolicy: "에이전트 정책 (JSON)",
      btnRun: "자동 구매 실행",
      btnWorking: "에이전트 작업 중...",
      capabilityTitle: "에이전트 기능",
      cap1: "카탈로그 검색 API",
      cap2: "정책 검증 엔진",
      cap3: "24시간 결제 승인 유예",
      cap4: "도매매 풀필먼트 트리거",
      waiting: "에이전트 실행 명령 대기 중...",
      orderCreated: "주문 생성됨",
      timerStarted: "24시간 매입 타이머 시작됨",
      viewReceipt: "설명 가능한 영수증 보기",
      btnSimulateReview: "배송 시뮬레이션 및 리뷰 생성",
      reviewGenerated: "프로토콜 리뷰 발행됨",
      simulateDefect: "결함 시뮬레이션 (중량 불일치)",
    },
    admin: {
      title: "조달 대기열",
      subtitle: "승인 대기 중 (결제 승인 유예). 24시간 후 자동 취소.",
      created: "생성일",
      expiresIn: "만료까지",
      expired: "만료됨",
      voided: "취소됨",
      totalAuth: "총 승인 금액",
      riskFlags: "위험 플래그",
      btnReject: "거절 및 취소",
      btnApprove: "승인 및 매입"
    },
    inventory: {
      title: "재고 및 소싱 관리",
      subtitle: "하이브리드 운영: 인간 관리자 + AI 소싱 에이전트 협업",
      btnAdd: "상품 등록 (수동)",
      btnAutoSource: "AI 소싱 에이전트 실행",
      tableSku: "SKU",
      tableProduct: "상품명",
      tablePrice: "공급가",
      tableStock: "재고",
      tableAiScore: "AI 적합도",
      tableSource: "등록 주체",
      sourceHuman: "인간 관리자",
      sourceAi: "AI 에이전트",
      sourcing: "AI 에이전트가 도매 시장을 스캔 중입니다...",
      formTitle: "신규 상품 등록",
      formSku: "SKU",
      formName: "상품명",
      formPrice: "가격 (KRW)",
      formStock: "재고 수량",
      btnSave: "상품 등록",
      btnCancel: "취소"
    },
    receipt: {
      title: "설명 가능한 영수증",
      trace: "의사결정 추적",
      data: "데이터 패킷",
      footer: "이 영수증은 JSONMart 에이전트 코어에 의해 자동 생성되었습니다."
    },
    review: {
      verdict: "판결",
      latency: "응답 지연",
      compliance: "스펙 일치",
      delta: "도착 오차"
    },
    auth: {
      signIn: "로그인",
      signUp: "회원가입",
      signInSubtitle: "AI 에이전트에게 구매 권한을 위임하려면 인증하세요.",
      signUpSubtitle: "AI 구매 에이전트를 연결하려면 계정을 만드세요.",
      email: "이메일",
      password: "비밀번호",
      processing: "처리 중...",
      signUpSuccess: "계정 생성 완료",
      checkEmail: "이메일을 확인하여 계정을 인증한 후 로그인하세요.",
      goToSignIn: "← 로그인으로 돌아가기",
      hasAccount: "이미 계정이 있으신가요? 로그인",
      noAccount: "계정이 없으신가요? 생성하기",
      footer: "자격 증명은 Supabase Auth를 통해 보안됩니다.",
      signOut: "로그아웃"
    }
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (path: string) => {
    const keys = path.split('.');
    let current: any = translations[language];
    for (const key of keys) {
      if (current[key] === undefined) {
        console.warn(`Translation missing for key: ${path} in language: ${language}`);
        return path;
      }
      current = current[key];
    }
    return current;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
