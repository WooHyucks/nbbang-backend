import { prisma } from '../utils/prisma.util';

/**
 * Country Service
 * 국가 정보 관리 서비스
 */
export class CountryService {
  /**
   * 주요 국가 데이터 (서버 시작 시 시딩)
   * order 순서대로 정렬됨
   */
  private readonly DEFAULT_COUNTRIES = [
    { code: 'KR', name: '대한민국', currency: 'KRW', symbol: '₩', flag: '🇰🇷', order: 0 },
    { code: 'JP', name: '일본', currency: 'JPY', symbol: '¥', flag: '🇯🇵', order: 1 },
    { code: 'US', name: '미국', currency: 'USD', symbol: '$', flag: '🇺🇸', order: 2 },
    { code: 'CN', name: '중국', currency: 'CNY', symbol: '¥', flag: '🇨🇳', order: 3 },
    { code: 'GB', name: '영국', currency: 'GBP', symbol: '£', flag: '🇬🇧', order: 4 },
    { code: 'EU', name: '유럽연합', currency: 'EUR', symbol: '€', flag: '🇪🇺', order: 5 },
    { code: 'TH', name: '태국', currency: 'THB', symbol: '฿', flag: '🇹🇭', order: 6 },
    { code: 'VN', name: '베트남', currency: 'VND', symbol: '₫', flag: '🇻🇳', order: 7 },
    { code: 'PH', name: '필리핀', currency: 'PHP', symbol: '₱', flag: '🇵🇭', order: 8 },
    { code: 'SG', name: '싱가포르', currency: 'SGD', symbol: 'S$', flag: '🇸🇬', order: 9 },
    { code: 'MY', name: '말레이시아', currency: 'MYR', symbol: 'RM', flag: '🇲🇾', order: 10 },
    { code: 'ID', name: '인도네시아', currency: 'IDR', symbol: 'Rp', flag: '🇮🇩', order: 11 },
    { code: 'AU', name: '호주', currency: 'AUD', symbol: 'A$', flag: '🇦🇺', order: 12 },
    { code: 'NZ', name: '뉴질랜드', currency: 'NZD', symbol: 'NZ$', flag: '🇳🇿', order: 13 },
    { code: 'CA', name: '캐나다', currency: 'CAD', symbol: 'C$', flag: '🇨🇦', order: 14 },
  ];

  /**
   * 국가 데이터 시딩
   * 서버 시작 시 실행
   */
  async seedCountries(): Promise<void> {
    // console.log('[CountryService] Seeding countries...');

    try {
      for (const country of this.DEFAULT_COUNTRIES) {
        await prisma.country.upsert({
          where: { code: country.code },
          update: {
            name: country.name,
            currency: country.currency,
            symbol: country.symbol,
            flag: country.flag,
            order: country.order,
          },
          create: country,
        });
      }

      // console.log(`[CountryService] Successfully seeded ${this.DEFAULT_COUNTRIES.length} countries`);
    } catch (error) {
      // console.error('[CountryService] Failed to seed countries:', error);
      throw error;
    }
  }

  /**
   * 모든 국가 조회 (order 순으로 정렬)
   */
  async getAllCountries(): Promise<Array<{
    code: string;
    name: string;
    currency: string;
    symbol: string | null;
    flag: string | null;
    order: number;
  }>> {
    return prisma.country.findMany({
      orderBy: { order: 'asc' },
    });
  }

  /**
   * 국가 코드로 국가 조회
   */
  async getCountryByCode(code: string): Promise<{
    code: string;
    name: string;
    currency: string;
    symbol: string | null;
    flag: string | null;
    order: number;
  } | null> {
    return prisma.country.findUnique({
      where: { code },
    });
  }
}










