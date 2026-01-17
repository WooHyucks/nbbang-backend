import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Currency Utility
 * ExchangeRate-API를 사용하여 실시간 환율 조회
 * https://www.exchangerate-api.com/
 */

const EXCHANGE_RATE_API_KEY = process.env.EXCHANGE_RATE_API_KEY;
const EXCHANGE_RATE_API_BASE_URL = 'https://v6.exchangerate-api.com/v6';

/**
 * ExchangeRate-API 응답 타입
 */
interface ExchangeRateResponse {
  result: string;
  base_code: string;
  conversion_rates: Record<string, number>;
}

/**
 * 환율 조회
 * 
 * @param baseCurrency - 기준 통화 (예: "KRW")
 * @param targetCurrency - 대상 통화 (예: "JPY", "USD")
 * @returns 환율 (1 baseCurrency = ? targetCurrency)
 * @throws Error - API 호출 실패 시
 */
export async function getExchangeRate(
  baseCurrency: string,
  targetCurrency: string,
): Promise<number> {
  if (!EXCHANGE_RATE_API_KEY) {
    throw new Error('EXCHANGE_RATE_API_KEY is not set in environment variables');
  }

  // 같은 통화면 1.0 반환
  if (baseCurrency === targetCurrency) {
    return 1.0;
  }

  try {
    const url = `${EXCHANGE_RATE_API_BASE_URL}/${EXCHANGE_RATE_API_KEY}/latest/${baseCurrency}`;
    const response = await axios.get<ExchangeRateResponse>(url);

    if (response.data.result !== 'success') {
      throw new Error(`ExchangeRate API error: ${response.data.result}`);
    }

    const rate = response.data.conversion_rates[targetCurrency];
    if (!rate) {
      throw new Error(`Currency ${targetCurrency} not found in conversion rates`);
    }

    return rate;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch exchange rate: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 원화 대비 환율 조회 (KRW를 기준으로)
 * 
 * @param targetCurrency - 대상 통화 (예: "JPY", "USD")
 * @returns 환율 (1 KRW = ? targetCurrency)
 */
export async function getExchangeRateFromKRW(targetCurrency: string): Promise<number> {
  return getExchangeRate('KRW', targetCurrency);
}

/**
 * 외화를 원화로 환산
 * 
 * @param amount - 외화 금액
 * @param currency - 외화 통화 코드 (예: "JPY", "USD")
 * @returns 원화 환산 금액
 */
export async function convertToKRW(amount: number, currency: string): Promise<number> {
  if (currency === 'KRW') {
    return amount;
  }

  // 1 KRW = ? currency 환율을 가져옴
  const rate = await getExchangeRateFromKRW(currency);
  // amount currency = ? KRW
  // amount / rate = KRW 금액
  return amount / rate;
}

/**
 * 원화를 외화로 환산
 * 
 * @param amount - 원화 금액
 * @param targetCurrency - 대상 통화 코드 (예: "JPY", "USD")
 * @returns 외화 환산 금액
 */
export async function convertFromKRW(amount: number, targetCurrency: string): Promise<number> {
  if (targetCurrency === 'KRW') {
    return amount;
  }

  const rate = await getExchangeRateFromKRW(targetCurrency);
  // amount KRW * rate = targetCurrency 금액
  return amount * rate;
}











