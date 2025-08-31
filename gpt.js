require('dotenv').config();

/**
 * OpenAI GPT 연동 모듈
 * - 환경변수 OPENAI_API_KEY 필요
 * - 환경변수 OPENAI_MODEL(선택): 기본값 'gpt-4.1-mini'
 *
 * 사용 예시:
 *  const { generateMessage } = require('./gpt');
 *  (async () => {
 *    const text = await generateMessage('간단히 자기소개를 해줘');
 *    console.log(text);
 *  })();
 */

// SDK 로드 (CommonJS)
const OpenAI = require('openai');

// 기본 모델은 환경변수에서 가져오고, 없으면 경량 모델을 사용
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

// OpenAI 클라이언트 인스턴스 생성
// 주의: API 키는 소스코드에 하드코딩하지 않고 환경변수로 주입한다.
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * 사용자 프롬프트에 기반해 GPT의 메시지를 생성한다.
 * @param {string} prompt 사용자 입력 프롬프트
 * @param {Object} [options] 추가 옵션
 * @param {string} [options.system] 시스템 프롬프트(모델의 역할/말투 지정)
 * @param {string} [options.model] 사용할 모델 ID (기본값: process.env.OPENAI_MODEL || 'gpt-4o-mini')
 * @param {number} [options.temperature] 창의성(0~2 권장), 기본 미설정
 * @param {number} [options.maxTokens] 응답 토큰 제한, 기본 미설정(모델 기본값)
 * @returns {Promise<string>} 모델이 생성한 최종 텍스트 컨텐츠
 */
async function generateMessage(prompt, options = {}) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('prompt는 문자열이어야 합니다.');
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('환경변수 OPENAI_API_KEY가 설정되어 있지 않습니다.');
  }

  const {
    system = '당신은 간결하고 유용한 한국어 어시스턴트입니다. 불필요한 수식을 피하고 핵심만 답하세요.',
    model = DEFAULT_MODEL,
    temperature,
    maxTokens,
  } = options;

  // chat.completions API를 사용하여 대화형 응답을 요청
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    // 선택 옵션만 전달 (undefined는 제거)
    ...(temperature !== undefined ? { temperature } : {}),
    ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
  });

  const text = completion?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('모델이 유효한 응답을 반환하지 않았습니다.');
  }
  return text;
}

module.exports = {
  generateMessage,
};
