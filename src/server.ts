import app from './app';
import { startAllSchedulers } from './cron';
import { CountryService } from './services/country.service';

const PORT = parseInt(process.env.PORT || '3001', 10);
const SERVICE_ENV = process.env.SERVICE_ENV || 'dev';

/**
 * Server Entry Point
 * Python의 main.py의 if __name__ == "__main__" 부분과 동일
 */

// 서버 시작 시 초기화 작업
async function initializeServer(): Promise<void> {
  // 국가 데이터 시딩
  const countryService = new CountryService();
  try {
    await countryService.seedCountries();
  } catch (error) {
    // 시딩 실패해도 서버는 계속 실행
  }

  // Cron 스케줄러 시작
  startAllSchedulers();

  // 서버 시작 시 즉시 환율 동기화 시도 (오늘 날짜 환율이 없을 수 있으므로)
  const { CurrencyService } = await import('./services/currency.service');
  const currencyService = new CurrencyService();
  try {
    console.log('[Server] Initializing: Syncing today\'s exchange rates...');
    await currencyService.syncDailyRates();
    console.log('[Server] Initialization: Exchange rates synced successfully');
  } catch (error) {
    console.error('[Server] Initialization: Failed to sync exchange rates (will retry at midnight):', error);
    // 초기화 실패해도 서버는 계속 실행 (자정에 재시도)
  }
}

// 서버 시작
if (SERVICE_ENV === 'dev') {
  initializeServer().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      // Server started
    });
  });
} else {
  // Production 환경에서는 다른 방식으로 실행 (예: PM2, Docker 등)
  initializeServer().then(() => {
    app.listen(PORT, () => {
      // Server started
    });
  });
}

