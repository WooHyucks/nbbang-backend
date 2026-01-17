import cron from 'node-cron';
import { CurrencyService } from '../services/currency.service';

/**
 * Cron Scheduler
 * 정기적으로 실행되는 작업들을 관리
 */

const currencyService = new CurrencyService();

/**
 * 일일 환율 동기화 스케줄러
 * 매일 자정 0시 0분 0초에 실행
 * 
 * Cron 표현식: "0 0 0 * * *"
 * - 초: 0
 * - 분: 0
 * - 시: 0
 * - 일: * (매일)
 * - 월: * (매월)
 * - 요일: * (매요일)
 */
export function startDailyRateSync(): void {
  // Asia/Seoul 타임존 설정 (가능한 경우)
  const cronExpression = '0 0 0 * * *'; // 매일 자정
  
  console.log('[Cron] Starting daily exchange rate sync scheduler...');
  console.log(`[Cron] Schedule: ${cronExpression} (Daily at midnight KST)`);

  cron.schedule(cronExpression, async () => {
    console.log('[Cron] Daily rate sync job started at', new Date().toISOString());
    
    try {
      await currencyService.syncDailyRates();
      console.log('[Cron] Daily rate sync job completed successfully');
    } catch (error) {
      console.error('[Cron] Daily rate sync job failed:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Seoul', // 한국 시간대
  });

  console.log('[Cron] Daily exchange rate sync scheduler started');
}

/**
 * 모든 스케줄러 시작
 */
export function startAllSchedulers(): void {
  startDailyRateSync();
}










