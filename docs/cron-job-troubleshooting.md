# Cron Job 실행 안됨 문제 해결

## 현재 상황
- ✅ pg_cron extension: 활성화됨
- ✅ cron job: `sync-daily-exchange-rates` 등록됨
- ✅ schedule: `0 15 * * *` (매일 15:00 UTC = 한국시간 00:00)
- ✅ active: `true`
- ❓ **실행이 안됨**

## 문제 진단

### Step 1: pg_net extension 확인 (가장 중요!)

Supabase SQL Editor에서 실행:

```sql
-- pg_net extension 확인
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') 
    THEN '✅ pg_net extension is available'
    ELSE '❌ pg_net extension is NOT available - HTTP requests will fail!'
  END AS pg_net_status;
```

**만약 pg_net이 없다면:**
1. Supabase Dashboard > Database > Extensions
2. `pg_net` 검색
3. Enable 클릭

### Step 2: Cron Job 실행 이력 확인

```sql
-- 최근 실행 이력 확인
SELECT 
  runid,
  jobid,
  status,
  return_message,
  start_time,
  end_time,
  command
FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid FROM cron.job WHERE jobname = 'sync-daily-exchange-rates'
)
ORDER BY start_time DESC
LIMIT 10;
```

**확인 사항:**
- `status`가 `failed`인지 확인
- `return_message`에 에러 메시지가 있는지 확인
- `start_time`이 있는지 확인 (실행 시도가 있었는지)

### Step 3: Service Role Key 확인

현재 cron job의 command를 확인:

```sql
SELECT 
  jobname,
  command
FROM cron.job
WHERE jobname = 'sync-daily-exchange-rates';
```

**확인 사항:**
- `YOUR_SERVICE_ROLE_KEY`가 실제 키로 교체되었는지 확인
- Service Role Key는 Supabase Dashboard > Settings > API에서 확인

### Step 4: Edge Function 직접 테스트

cron job이 실행되기 전에 Edge Function이 정상 작동하는지 확인:

```bash
# Service Role Key로 직접 호출
curl -X POST \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  https://qdvwwnylfhhevwzdfumm.supabase.co/functions/v1/sync-exchange-rates
```

또는 Supabase Dashboard에서:
1. Edge Functions > `sync-exchange-rates` 선택
2. **Invoke** 버튼 클릭
3. 로그 확인

## 해결 방법

### 방법 1: pg_net 활성화 후 Cron Job 재설정

```sql
-- 1. pg_net 활성화
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. 기존 job 제거
SELECT cron.unschedule('sync-daily-exchange-rates');

-- 3. 새 job 등록 (Service Role Key를 실제 키로 교체!)
SELECT cron.schedule(
  'sync-daily-exchange-rates',
  '0 15 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://qdvwwnylfhhevwzdfumm.supabase.co/functions/v1/sync-exchange-rates',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' -- 실제 Service Role Key
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

### 방법 2: GitHub Actions 사용 (pg_net이 없는 경우)

pg_net이 지원되지 않으면 GitHub Actions를 사용하세요:

1. `.github/workflows/sync-exchange-rates.yml` 파일이 이미 생성되어 있음
2. GitHub Secrets에 `SUPABASE_SERVICE_ROLE_KEY` 추가
3. 자동으로 매일 실행됨

### 방법 3: 수동 실행으로 우회

긴급한 경우 수동으로 실행:

```bash
# 매일 수동으로 실행하거나
curl -X POST \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  https://qdvwwnylfhhevwzdfumm.supabase.co/functions/v1/sync-exchange-rates
```

## 체크리스트

진단을 위해 다음을 확인하세요:

- [ ] `supabase/scripts/check-cron-status.sql` 실행하여 실행 이력 확인
- [ ] pg_net extension이 활성화되어 있는지 확인
- [ ] cron job의 command에 실제 Service Role Key가 들어가 있는지 확인
- [ ] Edge Function을 수동으로 호출했을 때 정상 작동하는지 확인
- [ ] cron.job_run_details 테이블에서 에러 메시지 확인

## 다음 단계

1. `supabase/scripts/check-cron-status.sql` 실행
2. 결과를 확인하여 문제 원인 파악
3. 위의 해결 방법 중 하나 선택하여 적용

