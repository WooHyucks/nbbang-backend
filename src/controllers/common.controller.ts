import { Request, Response, NextFunction } from 'express';
import { CurrencyService } from '../services/currency.service';
import { CountryService } from '../services/country.service';

const currencyService = new CurrencyService();
const countryService = new CountryService();

/**
 * Common Controller
 * 공통 API 엔드포인트 처리
 */

/**
 * 환율 조회
 * GET /common/exchange-rate?currency=USD&date=2026-01-05
 */
export async function getExchangeRate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const currency = req.query.currency as string;

    if (!currency) {
      res.status(400).json({ detail: 'currency query parameter is required' });
      return;
    }

    // 날짜 파라미터 파싱 (선택적)
    const dateParam = req.query.date as string | undefined;
    let targetDate: Date | undefined;
    if (dateParam) {
      targetDate = new Date(dateParam);
      if (isNaN(targetDate.getTime())) {
        res.status(400).json({ detail: 'Invalid date format. Use YYYY-MM-DD' });
        return;
      }
    }

    const result = await currencyService.getRateWithDate(currency.toUpperCase(), targetDate);
    
    res.status(200).json({
      currency: currency.toUpperCase(),
      rate: result.rate,
      date: result.date, // 실제 사용된 날짜 (Fallback인 경우 다를 수 있음)
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 국가 목록 조회
 * GET /common/countries
 */
export async function getCountries(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const countries = await countryService.getAllCountries();
    
    res.status(200).json(countries);
  } catch (error) {
    next(error);
  }
}

/**
 * 환율 수동 동기화 (개발/관리용)
 * POST /common/sync-exchange-rates
 */
export async function syncExchangeRates(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    console.log('[CommonController] Manual exchange rate sync requested');
    await currencyService.syncDailyRates();
    
    res.status(200).json({
      success: true,
      message: 'Exchange rates synced successfully',
      date: new Date().toISOString().split('T')[0],
    });
  } catch (error) {
    console.error('[CommonController] Failed to sync exchange rates:', error);
    next(error);
  }
}











