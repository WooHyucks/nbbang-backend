# 환율 스케줄링 문제 해결 가이드

## 문제 진단

환율이 매일 자동으로 업데이트되지 않는 경우, 다음을 확인하세요:

### 1. 현재 스케줄링 상태 확인

#### Supabase pg_cron 확인
Supabase SQL Editor에서 다음 쿼리를 실행하세요:

```sql
-- pg_cron extension 확인
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') 
    THEN '✅ pg_cron extension is enabled'
    ELSE '❌ pg_cron extension is NOT enabled'
  END AS pg_cron_status;

-- 현재 cron job 확인
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname = 'sync-daily-exchange-rates' OR jobname LIKE '%exchange%';
```

#### Node.js 서버 확인
Node.js 서버가 실행 중인지 확인하세요:
- 서버 로그에서 `[Cron] Daily exchange rate sync scheduler started` 메시지 확인
- 서버가 재시작되면 스케줄러도 재시작됩니다

## 해결 방법

### 방법 1: Supabase pg_cron 사용 (권장)

#### Step 1: pg_cron 활성화 확인
Supabase Dashboard > Database > Extensions에서 `pg_cron`이 활성화되어 있는지 확인하세요.

#### Step 2: Service Role Key 확인
Supabase Dashboard > Settings > API에서 `service_role` key를 복사하세요.

#### Step 3: Cron Job 설정
Supabase SQL Editor에서 다음 SQL을 실행하세요 (YOUR_SERVICE_ROLE_KEY를 실제 키로 교체):

```sql
-- 기존 job 제거
SELECT cron.unschedule('sync-daily-exchange-rates') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-daily-exchange-rates'
);

-- 새 job 등록
-- 주의: Supabase의 pg_cron은 net.http_post를 지원하지 않을 수 있습니다
-- 이 경우 방법 2나 3을 사용하세요
SELECT cron.schedule(
  'sync-daily-exchange-rates',
  '0 15 * * *', -- 매일 15:00 UTC (한국시간 00:00)
  $$
  SELECT
    net.http_post(
      url := 'https://qdvwwnylfhhevwzdfumm.supabase.co/functions/v1/sync-exchange-rates',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

**주의**: Supabase의 일부 플랜에서는 `net.http_post`를 지원하지 않을 수 있습니다. 이 경우 방법 2나 3을 사용하세요.

### 방법 2: Node.js 서버의 node-cron 사용

Node.js 서버가 항상 실행 중이어야 합니다:

1. **서버 시작 확인**
   ```bash
   # 서버 로그에서 다음 메시지 확인:
   [Cron] Daily exchange rate sync scheduler started
   [Server] Initialization: Exchange rates synced successfully
   ```

2. **PM2로 서버 관리 (권장)**
   ```bash
   # PM2 설치
   npm install -g pm2
   
   # 서버 시작
   pm2 start dist/server.js --name nbbang-backend
   
   # 자동 재시작 설정
   pm2 startup
   pm2 save
   ```

3. **Docker로 서버 실행**
   서버를 Docker 컨테이너로 실행하여 항상 실행 상태를 유지하세요.

### 방법 3: 외부 Cron 서비스 사용

#### GitHub Actions 사용
`.github/workflows/sync-exchange-rates.yml` 파일 생성:

```yaml
name: Sync Exchange Rates

on:
  schedule:
    - cron: '0 0 * * *'  # 매일 자정 UTC (한국시간 09:00)
  workflow_dispatch:  # 수동 실행 가능

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Call Supabase Edge Function
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            https://qdvwwnylfhhevwzdfumm.supabase.co/functions/v1/sync-exchange-rates
```

#### Vercel Cron 사용
`vercel.json` 파일에 cron 설정 추가:

```json
{
  "crons": [{
    "path": "/api/sync-exchange-rates",
    "schedule": "0 0 * * *"
  }]
}
```

### 방법 4: 수동 동기화

긴급한 경우 수동으로 동기화할 수 있습니다:

#### API 엔드포인트 호출
```bash
# Node.js 서버의 엔드포인트
curl -X POST http://localhost:3001/common/sync-exchange-rates

# 또는 Supabase Edge Function 직접 호출
curl -X POST \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  https://qdvwwnylfhhevwzdfumm.supabase.co/functions/v1/sync-exchange-rates
```

#### Supabase Dashboard에서 실행
Supabase Dashboard > Edge Functions > `sync-exchange-rates` > Invoke 버튼 클릭

## 문제 해결 체크리스트

- [ ] pg_cron extension이 활성화되어 있는가?
- [ ] cron job이 등록되어 있는가? (`SELECT * FROM cron.job;`)
- [ ] cron job이 활성화되어 있는가? (`active = true`)
- [ ] Service Role Key가 올바른가?
- [ ] Edge Function이 배포되어 있는가?
- [ ] Edge Function이 정상 작동하는가? (수동 호출 테스트)
- [ ] Node.js 서버가 실행 중인가?
- [ ] 서버 로그에 cron 스케줄러 시작 메시지가 있는가?

## 로그 확인

### Supabase Edge Function 로그
Supabase Dashboard > Edge Functions > `sync-exchange-rates` > Logs

### Node.js 서버 로그
```bash
# PM2 로그 확인
pm2 logs nbbang-backend

# 또는 직접 실행 시
# 콘솔에서 다음 메시지 확인:
# [Cron] Daily rate sync job started at ...
# [Cron] Daily rate sync job completed successfully
```

## 권장 사항

1. **이중화**: pg_cron과 node-cron 둘 다 설정하여 하나가 실패해도 다른 하나가 작동하도록
2. **모니터링**: 매일 환율이 업데이트되었는지 확인하는 알림 설정
3. **백업**: 수동 동기화 엔드포인트를 항상 사용 가능하게 유지

## 추가 리소스

- [Supabase pg_cron 문서](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [Node-cron 문서](https://github.com/node-cron/node-cron)
- [스크립트 파일](../supabase/scripts/check-and-setup-cron.sql)

