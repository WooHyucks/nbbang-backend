# 환율 스케줄링 설정 완료 가이드

## 현재 설정 상태

✅ **GitHub Actions 자동 스케줄링**이 설정되었습니다.
- 매일 한국시간 00:00 (UTC 15:00)에 자동 실행
- `.github/workflows/sync-exchange-rates.yml` 파일 참조

## 설정 확인 방법

### 1. GitHub Actions 확인

1. GitHub 저장소로 이동
2. **Actions** 탭 클릭
3. **Sync Exchange Rates Daily** 워크플로우 확인
4. 최근 실행 내역 확인

### 2. GitHub Secrets 설정 (필수)

GitHub Actions가 작동하려면 Service Role Key를 설정해야 합니다:

1. GitHub 저장소 > **Settings** > **Secrets and variables** > **Actions**
2. **New repository secret** 클릭
3. Name: `SUPABASE_SERVICE_ROLE_KEY`
4. Value: Supabase Dashboard > Settings > API > `service_role` key 복사
5. **Add secret** 클릭

### 3. 수동 실행 테스트

GitHub Actions에서 수동으로 실행할 수 있습니다:

1. GitHub 저장소 > **Actions** 탭
2. **Sync Exchange Rates Daily** 워크플로우 선택
3. **Run workflow** 버튼 클릭
4. 실행 결과 확인

### 4. Edge Function 직접 호출 테스트

```bash
# Service Role Key로 직접 호출
curl -X POST \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  https://qdvwwnylfhhevwzdfumm.supabase.co/functions/v1/sync-exchange-rates
```

또는 Supabase Dashboard에서:
1. **Edge Functions** > `sync-exchange-rates` 선택
2. **Invoke** 버튼 클릭
3. 로그 확인

## 문제 해결

### GitHub Actions가 실행되지 않는 경우

1. **Secrets 확인**
   - `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있는지 확인
   - 키가 올바른지 확인

2. **워크플로우 파일 확인**
   - `.github/workflows/sync-exchange-rates.yml` 파일이 존재하는지 확인
   - 파일 내용이 올바른지 확인

3. **권한 확인**
   - GitHub Actions가 활성화되어 있는지 확인
   - 저장소 Settings > Actions > General에서 확인

### Edge Function이 실패하는 경우

1. **환경 변수 확인**
   - `EXCHANGE_RATE_API_KEY`가 설정되어 있는지 확인
   - Supabase Dashboard > Edge Functions > `sync-exchange-rates` > Settings > Secrets

2. **로그 확인**
   - Supabase Dashboard > Edge Functions > `sync-exchange-rates` > Logs
   - 에러 메시지 확인

3. **API 키 확인**
   - ExchangeRate-API 키가 유효한지 확인
   - [ExchangeRate-API Dashboard](https://www.exchangerate-api.com/dashboard)에서 확인

## 대안 방법

### 방법 1: Node.js 서버의 node-cron 사용

Node.js 서버가 항상 실행 중이라면:

1. 서버가 실행 중인지 확인
2. 서버 로그에서 다음 메시지 확인:
   ```
   [Cron] Daily exchange rate sync scheduler started
   ```
3. 매일 자정에 자동 실행됨

### 방법 2: Supabase Database Webhooks (실험적)

Supabase Dashboard > Database > Webhooks에서 설정할 수 있습니다.

### 방법 3: 외부 Cron 서비스

- [Cron-job.org](https://cron-job.org/)
- [EasyCron](https://www.easycron.com/)
- [Vercel Cron](https://vercel.com/docs/cron-jobs)

## 모니터링

매일 환율이 업데이트되었는지 확인:

```sql
-- 오늘 날짜의 환율 확인
SELECT 
  currency,
  rate,
  date
FROM "DailyExchangeRate"
WHERE date = CURRENT_DATE
ORDER BY currency;
```

## 다음 단계

1. ✅ GitHub Secrets에 `SUPABASE_SERVICE_ROLE_KEY` 추가
2. ✅ GitHub Actions에서 수동 실행 테스트
3. ✅ 다음날 자동 실행 확인
4. ✅ DailyExchangeRate 테이블에서 데이터 확인

