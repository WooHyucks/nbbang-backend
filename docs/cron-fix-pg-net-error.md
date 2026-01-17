# Cron Job "schema net does not exist" 에러 해결

## 문제 상황
- ✅ pg_cron job이 설정되어 있음
- ✅ job이 실행은 시도함
- ❌ `ERROR: schema "net" does not exist` 에러 발생
- ❌ 결과: `status = failed`

## 원인
`pg_net` extension이 활성화되지 않아서 `net.http_post()` 함수를 사용할 수 없습니다.

## 해결 방법

### 방법 1: pg_net Extension 활성화 (권장)

#### Step 1: Supabase Dashboard에서 활성화
1. Supabase Dashboard > **Database** > **Extensions** 이동
2. `pg_net` 검색
3. **Enable** 클릭

#### Step 2: SQL로 활성화 시도
Supabase SQL Editor에서 실행:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

#### Step 3: Cron Job 재설정
`supabase/scripts/fix-cron-with-pg-net.sql` 파일을 실행하세요.

**중요:** 파일 내의 `YOUR_SERVICE_ROLE_KEY`를 실제 Service Role Key로 교체하세요:
- Supabase Dashboard > Settings > API > `service_role` key 복사

### 방법 2: GitHub Actions 사용 (pg_net이 없는 경우)

Supabase의 일부 플랜에서는 `pg_net`을 지원하지 않을 수 있습니다. 이 경우 GitHub Actions를 사용하세요.

#### Step 1: GitHub Secrets 설정
1. GitHub 저장소 > **Settings** > **Secrets and variables** > **Actions**
2. **New repository secret** 클릭
3. Name: `SUPABASE_SERVICE_ROLE_KEY`
4. Value: Supabase Dashboard > Settings > API > `service_role` key
5. **Add secret** 클릭

#### Step 2: 자동 실행 확인
- `.github/workflows/sync-exchange-rates.yml` 파일이 이미 생성되어 있음
- 매일 한국시간 00:00 (UTC 15:00)에 자동 실행됨
- GitHub Actions 탭에서 실행 내역 확인 가능

### 방법 3: 수동 실행 (임시 해결)

긴급한 경우 수동으로 실행:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  https://qdvwwnylfhhevwzdfumm.supabase.co/functions/v1/sync-exchange-rates
```

또는 Supabase Dashboard에서:
1. **Edge Functions** > `sync-exchange-rates` 선택
2. **Invoke** 버튼 클릭

## 확인 방법

### pg_net 활성화 확인
```sql
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') 
    THEN '✅ pg_net is enabled'
    ELSE '❌ pg_net is NOT enabled'
  END AS status;
```

### Cron Job 실행 이력 확인
```sql
SELECT 
  status,
  return_message,
  start_time
FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid FROM cron.job WHERE jobname = 'sync-daily-exchange-rates'
)
ORDER BY start_time DESC
LIMIT 5;
```

## 권장 사항

1. **이중화 설정**: pg_net과 GitHub Actions 둘 다 설정
   - pg_net이 작동하면 pg_cron 사용
   - pg_net이 없으면 GitHub Actions 사용
   - 하나가 실패해도 다른 하나가 작동

2. **모니터링**: 매일 환율이 업데이트되었는지 확인
   ```sql
   SELECT COUNT(*) 
   FROM "DailyExchangeRate" 
   WHERE date = CURRENT_DATE;
   ```

3. **알림 설정**: 실패 시 알림을 받도록 설정 (선택사항)

## 다음 단계

1. ✅ Supabase Dashboard에서 `pg_net` extension 활성화 시도
2. ✅ 활성화되면 `fix-cron-with-pg-net.sql` 실행 (Service Role Key 교체 필수)
3. ✅ 안 되면 GitHub Actions 사용 (Secrets 설정 필수)
4. ✅ 다음날 자동 실행 확인

