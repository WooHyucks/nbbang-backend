import axios from 'axios';
import { prisma } from '../utils/prisma.util';
import dotenv from 'dotenv';

dotenv.config();

/**
 * ExchangeRate-API 응답 타입
 */
interface ExchangeRateResponse {
  result: string;
  base_code: string;
  conversion_rates: Record<string, number>;
}

/**
 * Currency Service
 * 환율 조회 및 동기화 서비스
 */
export class CurrencyService {
  private readonly EXCHANGE_RATE_API_KEY = process.env.EXCHANGE_RATE_API_KEY;
  private readonly EXCHANGE_RATE_API_BASE_URL = 'https://v6.exchangerate-api.com/v6';

  /**
   * 일일 환율 동기화
   * ExchangeRate-API에서 오늘 날짜의 환율을 조회하여 DB에 저장
   * 
   * API 응답은 1 KRW 기준이므로, 역수로 변환하여 저장 (1 USD = ? KRW 형태)
   */
  async syncDailyRates(): Promise<void> {
    if (!this.EXCHANGE_RATE_API_KEY) {
      throw new Error('EXCHANGE_RATE_API_KEY is not set in environment variables');
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    console.log(`[CurrencyService] Starting daily rate sync for ${today}...`);

    try {
      // API 호출: 1 KRW 기준 환율 조회
      const url = `${this.EXCHANGE_RATE_API_BASE_URL}/${this.EXCHANGE_RATE_API_KEY}/latest/KRW`;
      const response = await axios.get<ExchangeRateResponse>(url);

      if (response.data.result !== 'success') {
        throw new Error(`ExchangeRate API error: ${response.data.result}`);
      }

      const conversionRates = response.data.conversion_rates;
      console.log(`[CurrencyService] Fetched ${Object.keys(conversionRates).length} exchange rates from API`);

      // 각 통화에 대해 역수 변환하여 저장
      const ratesToSave = Object.entries(conversionRates)
        .filter(([currency]) => currency !== 'KRW') // KRW는 제외
        .map(([currency, apiRate]) => {
          // API 응답: 1 KRW = apiRate currency
          // 우리 DB 저장: 1 currency = (1 / apiRate) KRW
          const rate = 1 / apiRate;
          
          return {
            date: today,
            currency: currency,
            rate: rate,
          };
        });

      // DB에 upsert (createMany는 unique constraint 위반 시 실패하므로 upsert 사용)
      let savedCount = 0;
      for (const rateData of ratesToSave) {
        await prisma.dailyExchangeRate.upsert({
          where: {
            date_currency: {
              date: rateData.date,
              currency: rateData.currency,
            },
          },
          update: {
            rate: rateData.rate,
          },
          create: rateData,
        });
        savedCount++;
      }

      console.log(`[CurrencyService] Successfully synced ${savedCount} exchange rates for ${today}`);
    } catch (error) {
      console.error('[CurrencyService] Failed to sync daily rates:', error);
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch exchange rate: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 환율 조회
   * 지정된 날짜의 환율을 DB에서 조회, 없으면 Fallback 로직 적용
   * 
   * @param currency - 통화 코드 (예: "USD", "JPY")
   * @param date - 날짜 (선택적, 없으면 오늘 날짜 사용)
   * @returns 환율 (1 currency = ? KRW)
   */
  async getRate(currency: string, date?: Date): Promise<number> {
    if (currency === 'KRW') {
      return 1.0;
    }

    // 날짜 결정: 제공된 날짜 또는 오늘 날짜
    const targetDate = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

    // Step 1: DB에서 해당 날짜의 환율 조회
    const cachedRate = await prisma.dailyExchangeRate.findUnique({
      where: {
        date_currency: {
          date: targetDate,
          currency: currency,
        },
      },
    });

    if (cachedRate) {
      // console.log(`[CurrencyService] Cache hit for ${currency} on ${targetDate}: ${cachedRate.rate}`);
      return cachedRate.rate;
    }

    // Step 2: 캐시 미스 처리
    if (targetDate === today) {
      // 오늘 날짜인 경우: 동기화 후 재조회
      // console.log(`[CurrencyService] Cache miss for ${currency} on ${targetDate}, syncing...`);
      await this.syncDailyRates();

      const rate = await prisma.dailyExchangeRate.findUnique({
        where: {
          date_currency: {
            date: targetDate,
            currency: currency,
          },
        },
      });

      if (rate) {
        return rate.rate;
      }
      
      // 동기화 후에도 없으면 Fallback으로 진행
      // console.log(`[CurrencyService] Still not found after sync, using fallback...`);
    }

    // Step 3: Fallback - 해당 날짜 이전 중 가장 최신 데이터 조회
    // console.log(`[CurrencyService] Searching for latest available rate for ${currency} before or on ${targetDate}...`);
    
    const latestRate = await prisma.dailyExchangeRate.findFirst({
      where: {
        currency: currency,
        date: {
          lte: targetDate, // targetDate 이하
        },
      },
      orderBy: {
        date: 'desc', // 최신순
      },
    });

    if (latestRate) {
      // console.log(`[CurrencyService] Using fallback rate for ${currency}: ${latestRate.date} (requested: ${targetDate})`);
      return latestRate.rate;
    }

    // Step 4: 그래도 없으면 기본값 반환 (또는 실시간 API 호출)
    // console.warn(`[CurrencyService] No exchange rate found for ${currency} on ${targetDate}, returning 1.0 as fallback`);
    return 1.0;
  }

  /**
   * 환율 조회 (날짜 정보 포함)
   * 
   * @param currency - 통화 코드
   * @param date - 날짜 (선택적)
   * @returns 환율 및 실제 사용된 날짜
   */
  async getRateWithDate(currency: string, date?: Date): Promise<{ rate: number; date: string }> {
    if (currency === 'KRW') {
      const today = new Date().toISOString().split('T')[0];
      return { rate: 1.0, date: today };
    }

    // 날짜 결정: 제공된 날짜 또는 오늘 날짜
    const targetDate = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

    // Step 1: DB에서 해당 날짜의 환율 조회
    const cachedRate = await prisma.dailyExchangeRate.findUnique({
      where: {
        date_currency: {
          date: targetDate,
          currency: currency,
        },
      },
    });

    if (cachedRate) {
      // console.log(`[CurrencyService] Cache hit for ${currency} on ${targetDate}: ${cachedRate.rate}`);
      return { rate: cachedRate.rate, date: targetDate };
    }

    // Step 2: 캐시 미스 처리
    if (targetDate === today) {
      // 오늘 날짜인 경우: 동기화 후 재조회
      // console.log(`[CurrencyService] Cache miss for ${currency} on ${targetDate}, syncing...`);
      await this.syncDailyRates();

      const rate = await prisma.dailyExchangeRate.findUnique({
        where: {
          date_currency: {
            date: targetDate,
            currency: currency,
          },
        },
      });

      if (rate) {
        return { rate: rate.rate, date: targetDate };
      }
      
      // 동기화 후에도 없으면 Fallback으로 진행
      // console.log(`[CurrencyService] Still not found after sync, using fallback...`);
    }

    // Step 3: Fallback - 해당 날짜 이전 중 가장 최신 데이터 조회
    // console.log(`[CurrencyService] Searching for latest available rate for ${currency} before or on ${targetDate}...`);
    
    const latestRate = await prisma.dailyExchangeRate.findFirst({
      where: {
        currency: currency,
        date: {
          lte: targetDate, // targetDate 이하
        },
      },
      orderBy: {
        date: 'desc', // 최신순
      },
    });

    if (latestRate) {
      // console.log(`[CurrencyService] Using fallback rate for ${currency}: ${latestRate.date} (requested: ${targetDate})`);
      return { rate: latestRate.rate, date: latestRate.date };
    }

    // Step 4: 그래도 없으면 기본값 반환
    // console.warn(`[CurrencyService] No exchange rate found for ${currency} on ${targetDate}, returning 1.0 as fallback`);
    const todayStr = new Date().toISOString().split('T')[0];
    return { rate: 1.0, date: todayStr };
  }

  /**
   * 여러 통화의 환율을 한 번에 조회
   * 
   * @param currencies - 통화 코드 배열
   * @returns 통화별 환율 맵
   */
  async getRates(currencies: string[]): Promise<Record<string, number>> {
    const today = new Date().toISOString().split('T')[0];
    const rates: Record<string, number> = {};

    // KRW는 항상 1.0
    if (currencies.includes('KRW')) {
      rates['KRW'] = 1.0;
    }

    const otherCurrencies = currencies.filter(c => c !== 'KRW');
    if (otherCurrencies.length === 0) {
      return rates;
    }

    // DB에서 일괄 조회
    const cachedRates = await prisma.dailyExchangeRate.findMany({
      where: {
        date: today,
        currency: { in: otherCurrencies },
      },
    });

    const cachedMap = new Map(cachedRates.map(r => [r.currency, r.rate]));
    const missingCurrencies: string[] = [];

    for (const currency of otherCurrencies) {
      const rate = cachedMap.get(currency);
      if (rate) {
        rates[currency] = rate;
      } else {
        missingCurrencies.push(currency);
      }
    }

    // 누락된 통화가 있으면 동기화 후 재조회
    if (missingCurrencies.length > 0) {
      // console.log(`[CurrencyService] Missing rates for: ${missingCurrencies.join(', ')}, syncing...`);
      await this.syncDailyRates();

      const syncedRates = await prisma.dailyExchangeRate.findMany({
        where: {
          date: today,
          currency: { in: missingCurrencies },
        },
      });

      for (const rate of syncedRates) {
        rates[rate.currency] = rate.rate;
      }
    }

    return rates;
  }
}











