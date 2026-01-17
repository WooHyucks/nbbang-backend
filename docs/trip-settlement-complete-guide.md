# 여행 정산 시스템 완전 가이드

## 목차
1. [개요](#개요)
2. [데이터 모델](#데이터-모델)
3. [엔드포인트별 상세 로직](#엔드포인트별-상세-로직)
4. [환율 처리 로직](#환율-처리-로직)
5. [공금 계산 로직](#공금-계산-로직)
6. [정산 계산 로직](#정산-계산-로직)
7. [주요 개념 정리](#주요-개념-정리)

---

## 개요

여행 정산 시스템은 해외여행 시 공금(공동 자금)과 개인 지출을 관리하고, 최종적으로 멤버 간 정산 금액을 계산하는 시스템입니다.

### 핵심 특징
- **외화 지원**: 다양한 외화(USD, JPY, TWD 등) 지원
- **실시간 환율**: DailyExchangeRate 테이블에서 최신 환율 조회
- **공금 관리**: 초기 공금 설정 및 추가 공금 기능
- **균등 분배**: 공금 결제는 참여 멤버 수로 균등 분배
- **최종 정산**: 멤버별 지불액과 사용액을 비교하여 정산 금액 계산

---

## 데이터 모델

### Meeting 테이블
```typescript
{
  id: number;
  user_id: number;                    // 모임 관리자 ID
  is_trip: boolean;                   // 여행 모드 여부
  country_code: string;                // 국가 코드 (예: 'TW', 'JP')
  target_currency: string;              // 목표 통화 (예: 'TWD', 'JPY')
  base_exchange_rate: number;          // 초기 환율 (모임 생성 시점)
  initial_gonggeum: number;            // 초기 공금 (KRW 기준)
  added_foreign: number;                // 추가된 공금 (외화 기준, 누적)
  manual_exchange_rate: number | null; // 수동 설정 환율 (정산 시 사용)
}
```

**중요 필드 설명:**
- `initial_gonggeum`: 모임 생성 시 설정한 초기 공금 (KRW 기준, 변경되지 않음)
- `added_foreign`: 공금 추가 시마다 누적되는 외화 금액 (예: TWD 300 추가 → 300 누적)
- `base_exchange_rate`: 모임 생성 시점의 환율 (초기 공금 계산용)
- `manual_exchange_rate`: 정산 시 수동으로 설정한 환율 (우선순위 최상위)

### Contribution 테이블
```typescript
{
  id: number;
  member_id: number;
  meeting_id: number;
  amount_krw: number;                  // 멤버가 납부한 공금 (KRW 기준, 누적)
}
```

**중요:**
- `amount_krw`는 공금 추가 시마다 누적됨
- 공금 추가 시: `foreignAmount / memberCount * currentExchangeRate` 만큼 각 멤버에게 추가

### Payment 테이블
```typescript
{
  id: number;
  meeting_id: number;
  payer_id: number | null;             // null이면 공금 결제
  type: 'PUBLIC' | 'INDIVIDUAL';       // 결제 유형
  currency: string;                     // 통화 (예: 'TWD', 'KRW')
  price: number;                        // 결제 금액 (KRW 기준)
  original_price: number | null;       // 원래 외화 금액 (예: TWD 1000)
  exchange_rate: number | null;        // 결제 시점 환율
  attend_member_ids: number[];         // 참여 멤버 ID 배열
}
```

**결제 유형:**
- `PUBLIC` 또는 `payer_id === null`: 공금 결제 → 참여 멤버 수로 균등 분배
- `INDIVIDUAL` + `currency === 'KRW'`: 개인 선결제 (정산에 포함)
- `INDIVIDUAL` + `currency !== 'KRW'`: 개인 외화 결제 (정산에 미포함)

---

## 엔드포인트별 상세 로직

### 1. POST /trip - 해외여행 모임 생성

**요청:**
```json
{
  "country_code": "TW",
  "total_foreign": 1000,              // 선택: 초기 외화 금액
  "contributions": [                   // 선택: 초기 기여금
    {
      "member_name": "우혁",
      "amount_krw": 100000
    },
    {
      "member_name": "준영",
      "amount_krw": 100000
    }
  ],
  "advance_payments": []               // 선택: 선결제 내역
}
```

**처리 로직:**

1. **통화 코드 매핑**
   ```typescript
   const currencyMap = {
     'JP': 'JPY', 'US': 'USD', 'TW': 'TWD', ...
   };
   const targetCurrency = currencyMap[countryCode] || 'KRW';
   ```

2. **환율 및 초기 공금 계산**
   - `totalForeign`과 `totalKRW`가 모두 있으면:
     ```typescript
     baseExchangeRate = totalKRW / totalForeign;
     initialGonggeum = totalKRW;
     ```
   - `totalForeign`만 있으면:
     ```typescript
     baseExchangeRate = DailyExchangeRate에서 조회;
     initialGonggeum = totalForeign * baseExchangeRate;
     ```
   - `contributions`만 있으면:
     ```typescript
     initialGonggeum = contributions 합계;
     baseExchangeRate = DailyExchangeRate에서 조회;
     ```

3. **Meeting 생성**
   ```typescript
   {
     initial_gonggeum: finalInitialGonggeum,
     added_foreign: 0,                  // 초기값 0
     base_exchange_rate: baseExchangeRate,
     target_currency: targetCurrency,
     ...
   }
   ```

4. **Member 및 Contribution 생성**
   - `contributions` 배열을 순회하며 Member와 Contribution 생성
   - 첫 번째 멤버는 `leader: true`

5. **Advance Payment 생성** (선택)
   - `advance_payments` 배열을 순회하며 Payment 생성
   - `type: 'INDIVIDUAL'`, `currency: 'KRW'`

**응답:**
```json
{
  "id": 1512,
  "uuid": "...",
  ...
}
```

---

### 2. POST /:meeting_id/budget - 공금 추가

**요청:**
```json
{
  "foreignAmount": 300                 // 추가할 외화 금액 (예: TWD 300)
}
```

**처리 로직:**

1. **권한 확인**
   - 모임 관리자 또는 모임 멤버만 가능

2. **현재 환율 조회**
   ```typescript
   // 오늘 날짜의 환율 조회
   const today = new Date().toISOString().split('T')[0];
   const rateData = await DailyExchangeRate
     .where('currency', targetCurrency)
     .where('date', today)
     .single();
   
   // 없으면 최신 환율 조회
   // 없으면 base_exchange_rate 사용 (fallback)
   ```

3. **멤버별 기여금 추가**
   ```typescript
   const memberCount = allMembers.length;
   const foreignPerMember = foreignAmount / memberCount;
   const amountKRWPerMember = Math.round(foreignPerMember * currentExchangeRate);
   
   // 각 멤버의 Contribution.amount_krw에 추가
   for (const member of allMembers) {
     const newAmount = existingContribution.amount_krw + amountKRWPerMember;
     await Contribution.upsert({
       member_id: member.id,
       meeting_id: meetingId,
       amount_krw: newAmount
     });
   }
   ```

4. **Meeting.added_foreign 업데이트**
   ```typescript
   const currentAddedForeign = meeting.added_foreign || 0;
   const newAddedForeign = currentAddedForeign + foreignAmount;
   
   await Meeting.update({
     added_foreign: newAddedForeign    // 외화 기준으로 누적
   });
   ```

**중요:**
- `initial_gonggeum`은 변경하지 않음 (초기 공금은 고정)
- `added_foreign`은 외화 기준으로 누적 (예: 300 + 200 = 500)
- 각 멤버의 `Contribution.amount_krw`는 KRW 기준으로 누적

**응답:**
```json
null  // 성공 시 200 OK
```

---

### 3. GET /trip-page - 여행 페이지 조회

**처리 로직:**

1. **데이터 조회**
   - Meeting, Members, Contributions, Payments 조회

2. **결제 분류**
   ```typescript
   const publicPayments = payments.filter(p => 
     p.type === 'PUBLIC' || p.payer_id === null
   );
   const advancePayments = payments.filter(p => 
     p.type === 'INDIVIDUAL' && p.currency === 'KRW'
   );
   const individualPayments = payments.filter(p => 
     p.type === 'INDIVIDUAL' && p.currency !== 'KRW'
   );
   ```

3. **공금 현황 계산**
   ```typescript
   // 기본값
   const initialGonggeum = meeting.initial_gonggeum || 0;
   const addedGonggeumForeign = meeting.added_foreign || 0;
   const baseExchangeRate = meeting.base_exchange_rate || 1.0;
   const targetCurrency = meeting.target_currency || 'KRW';
   
   // 총 모은 공금 (KRW 기준)
   const totalCollected = contributions.reduce((sum, c) => 
     sum + c.amount_krw, 0
   );
   
   // 현재 시장 환율 조회
   const currentMarketRate = await getCurrentExchangeRate(targetCurrency);
   
   // 공금 사용액 계산 (외화 기준)
   const totalPublicSpentForeign = publicPayments.reduce((sum, p) => {
     if (p.original_price && p.currency !== 'KRW') {
       return sum + p.original_price;
     } else if (p.price && p.exchange_rate) {
       return sum + (p.price / p.exchange_rate);  // 역산
     }
     return sum;
   }, 0);
   
   // 공금 사용액 (KRW 기준)
   const totalPublicSpent = targetCurrency === 'KRW'
     ? publicPayments.reduce((sum, p) => sum + p.price, 0)
     : Math.round(totalPublicSpentForeign * currentMarketRate);
   
   // 외화 잔액 계산
   const initialGonggeumForeign = targetCurrency === 'KRW'
     ? initialGonggeum
     : (initialGonggeum / baseExchangeRate);
   const totalForeign = initialGonggeumForeign + addedGonggeumForeign;
   const remainingForeign = totalForeign - totalPublicSpentForeign;
   
   // 외화 잔액의 원화 가치
   const remainingGonggeumKRW = targetCurrency === 'KRW'
     ? remainingForeign
     : remainingForeign * currentMarketRate;
   
   // 실제 총 잔액
   const realTotalRemainingKRW = totalCollected - totalPublicSpent;
   ```

4. **개인 지출 계산**
   ```typescript
   const totalAdvanceSpent = advancePayments.reduce((sum, p) => 
     sum + p.price, 0
   );
   const totalIndividualCardSpent = individualPayments.reduce((sum, p) => 
     sum + p.price, 0
   );
   const totalIndividualSpent = totalAdvanceSpent + totalIndividualCardSpent;
   const grandTotalCost = totalPublicSpent + totalIndividualSpent;
   const perPersonCost = grandTotalCost / memberCount;
   ```

5. **멤버별 정산 계산** (간단 버전)
   ```typescript
   const memberDebitMap = new Map<number, number>();
   
   // 공금 결제 분배
   publicPayments.forEach(payment => {
     const perPersonAmount = payment.price / payment.attend_member_ids.length;
     payment.attend_member_ids.forEach(memberId => {
       memberDebitMap.set(memberId, 
         (memberDebitMap.get(memberId) || 0) + perPersonAmount
       );
     });
   });
   
   // 선결제 분배
   advancePayments.forEach(payment => {
     const perPersonAmount = payment.price / payment.attend_member_ids.length;
     payment.attend_member_ids.forEach(memberId => {
       memberDebitMap.set(memberId, 
         (memberDebitMap.get(memberId) || 0) + perPersonAmount
       );
     });
   });
   
   // 최종 정산
   const finalSettlement = members.map(member => {
     const contribution = contributions.find(c => c.member_id === member.id);
     const paidContribution = contribution?.amount_krw || 0;
     const paidIndividual = advancePayments
       .filter(p => p.payer_id === member.id)
       .reduce((sum, p) => sum + p.price, 0);
     const totalPaid = paidContribution + paidIndividual;
     const totalDebit = memberDebitMap.get(member.id) || 0;
     const settlementAmount = totalPaid - totalDebit;
     
     return {
       member_id: member.id,
       name: member.name,
       paid_contribution: paidContribution,
       paid_individual: paidIndividual,
       total_paid: totalPaid,
       total_debit: totalDebit,
       settlement_amount: settlementAmount,
       direction: settlementAmount > 0 ? 'RECEIVE' : 
                   settlementAmount < 0 ? 'SEND' : 'NONE',
       ...
     };
   });
   ```

**응답:**
```json
{
  "meeting": { ... },
  "public_budget": {
    "initial_gonggeum": 300000,              // 초기 공금 (고정)
    "added_gonggeum": 300,                   // 추가된 공금 (외화 기준)
    "total_collected": 313974,               // 총 모은 공금 (KRW)
    "total_public_spent": 27946,            // 공금 사용액 (KRW)
    "real_total_remaining_krw": 313973,    // 실제 총 잔액 (KRW)
    "remaining_gonggeum_krw": 107126,       // 외화 잔액의 원화 가치
    "remaining_gonggeum_foreign": 2300,      // 외화 잔액
    "status": "SURPLUS",                     // 'SURPLUS' | 'DEFICIT'
    "applied_exchange_rate": 46.5766,        // 현재 환율
    "exchange_rate_date": "2026-01-14",     // 환율 날짜
    "target_currency": "TWD"                 // 목표 통화
  },
  "trip_cost": {
    "total_public_spent": 27946,
    "total_individual_spent": 43973,
    "grand_total_cost": 71919,
    "per_person_cost": 23973
  },
  "final_settlement": [ ... ]
}
```

---

### 4. GET /:meeting_id/dashboard - 대시보드 조회

**처리 로직:**

1. **데이터 조회 및 분류**
   - `/trip-page`와 유사하지만 공유 페이지용

2. **공금 사용률 계산**
   ```typescript
   const totalForeign = initialGonggeumForeign + addedGonggeumForeign;
   const burnRate = totalForeign > 0
     ? Math.round((totalSpentForeign / totalForeign) * 1000) / 10
     : 0;
   
   // 상태 판단
   let status: 'SAFE' | 'WARNING' | 'DANGER';
   if (burnRate >= 80) status = 'DANGER';
   else if (burnRate >= 60) status = 'WARNING';
   else status = 'SAFE';
   ```

3. **멤버별 공금 지분 추적**
   ```typescript
   const initialSharePerPerson = totalForeign / memberCount;
   const memberSpentMap = new Map<number, number>();
   
   publicPayments.forEach(payment => {
     const paymentForeign = payment.original_price || 
                            (payment.price / payment.exchange_rate);
     const unitCost = paymentForeign / payment.attend_member_ids.length;
     payment.attend_member_ids.forEach(memberId => {
       memberSpentMap.set(memberId, 
         (memberSpentMap.get(memberId) || 0) + unitCost
       );
     });
   });
   
   const membersWalletStatus = members.map(member => {
     const usedAmount = memberSpentMap.get(member.id) || 0;
     const currentShare = initialSharePerPerson - usedAmount;
     const ratio = initialSharePerPerson > 0
       ? Math.round((currentShare / initialSharePerPerson) * 1000) / 10
       : 0;
     
     return {
       member_id: member.id,
       name: member.name,
       initial_share: initialSharePerPerson,
       used_amount: usedAmount,
       used_amount_krw: usedAmount * currentMarketRate,
       current_share: currentShare,
       ratio: ratio,
       status: ratio >= 50 ? 'SAFE' : ratio >= 20 ? 'WARNING' : 'DANGER',
       ...
     };
   });
   ```

**응답:**
```json
{
  "public_budget": {
    "total_collected": 313974,
    "total_collected_foreign": 6739.15,
    "total_public_spent": 27946,
    "remaining_gonggeum_krw": 107126,
    "remaining_gonggeum_foreign": 2300,
    "status": "SURPLUS",
    "applied_exchange_rate": 46.5766,
    "exchange_rate_date": "2026-01-14",
    "target_currency": "TWD"
  },
  "members_wallet_status": [ ... ],
  "my_public_status": { ... }
}
```

---

### 5. GET /share/trip - 공유 페이지 조회

**처리 로직:**
- `/dashboard`와 거의 동일하지만 인증이 필요 없음 (공유용)

---

### 6. GET /:meeting_id/result/trip - 정산 결과 조회

**처리 로직:**

1. **환율 결정** (최우선)
   ```typescript
   let finalExchangeRate: number;
   
   // 1순위: manual_exchange_rate
   if (meeting.manual_exchange_rate && meeting.manual_exchange_rate > 0) {
     finalExchangeRate = meeting.manual_exchange_rate;
   } else {
     // 2순위: 현재 시장 환율
     finalExchangeRate = await getCurrentExchangeRate(targetCurrency);
   }
   
   // base_exchange_rate는 사용하지 않음!
   ```

2. **멤버별 실제 사용량 계산** (KRW 기준)
   ```typescript
   const memberDebitMap = new Map<number, number>();
   
   // 공금 결제 처리
   publicPayments.forEach(payment => {
     let paymentKRW: number;
     
     if (payment.currency !== 'KRW') {
       if (payment.original_price) {
         // 외화 결제: original_price * finalExchangeRate
         paymentKRW = payment.original_price * finalExchangeRate;
       } else {
         // original_price 없으면 price를 그대로 사용 (이미 KRW로 변환됨)
         paymentKRW = payment.price;
       }
     } else {
       // KRW 결제
       paymentKRW = payment.price;
     }
     
     // 인당 금액 분배
     const perPersonAmount = paymentKRW / payment.attend_member_ids.length;
     payment.attend_member_ids.forEach(memberId => {
       memberDebitMap.set(memberId, 
         (memberDebitMap.get(memberId) || 0) + perPersonAmount
       );
     });
   });
   
   // 개인 선결제 처리 (이미 KRW)
   advancePayments.forEach(payment => {
     const perPersonAmount = payment.price / payment.attend_member_ids.length;
     payment.attend_member_ids.forEach(memberId => {
       memberDebitMap.set(memberId, 
         (memberDebitMap.get(memberId) || 0) + perPersonAmount
       );
     });
   });
   ```

3. **멤버별 정산 계산**
   ```typescript
   const finalSettlement = members.map(member => {
     // 지불한 금액
     const contribution = contributions.find(c => c.member_id === member.id);
     const paidContribution = contribution?.amount_krw || 0;
     const paidIndividual = advancePayments
       .filter(p => p.payer_id === member.id)
       .reduce((sum, p) => sum + p.price, 0);
     const totalPaid = paidContribution + paidIndividual;
     
     // 사용한 금액
     const totalDebit = memberDebitMap.get(member.id) || 0;
     
     // 정산 금액
     const settlementAmount = totalPaid - totalDebit;
     const roundedSettlement = Math.round(settlementAmount);
     
     // 10원 단위 올림
     const tippedSettlement = (() => {
       if (roundedSettlement === 0) return 0;
       if (Math.abs(roundedSettlement) % 10 === 0) return roundedSettlement;
       return roundedSettlement > 0
         ? Math.ceil(roundedSettlement / 10) * 10
         : -Math.ceil(Math.abs(roundedSettlement) / 10) * 10;
     })();
     
     return {
       member_id: member.id,
       name: member.name,
       paid_contribution: paidContribution,
       paid_individual: paidIndividual,
       total_paid: totalPaid,
       total_debit: totalDebit,
       settlement_amount: roundedSettlement,
       settlement_tipped_amount: tippedSettlement,
       direction: roundedSettlement > 0 ? 'RECEIVE' : 
                   roundedSettlement < 0 ? 'SEND' : 'NONE',
       deposit_copy_text: `... ${roundedSettlement}원`,
       tipped_deposit_copy_text: `... ${tippedSettlement}원`,
       links: {
         toss_deposit_link: `supertoss://send?amount=${roundedSettlement}&...`,
         tipped_toss_deposit_link: `supertoss://send?amount=${tippedSettlement}&...`,
         kakao_deposit_link: `https://qr.kakaopay.com/...`,
         tipped_kakao_deposit_link: `https://qr.kakaopay.com/...`
       }
     };
   });
   ```

**응답:**
```json
{
  "public_budget": { ... },
  "trip_cost": { ... },
  "manager_info": { ... },
  "final_settlement": [
    {
      "member_id": 3567,
      "name": "우혁",
      "paid_contribution": 145000,
      "paid_individual": 43973,
      "total_paid": 188973,
      "total_debit": 26302,
      "settlement_amount": 162671,
      "settlement_tipped_amount": 162680,
      "direction": "RECEIVE",
      "deposit_copy_text": "KB국민은행 40910201250999 162671원",
      "tipped_deposit_copy_text": "KB국민은행 40910201250999 162680원",
      "links": { ... }
    },
    ...
  ]
}
```

---

## 환율 처리 로직

### 환율 우선순위

1. **정산 결과 페이지 (`GET /:meeting_id/result/trip`)**
   - 1순위: `meeting.manual_exchange_rate` (수동 설정)
   - 2순위: `DailyExchangeRate` 테이블의 최신 환율
   - **사용 안 함**: `base_exchange_rate`

2. **기타 페이지 (`/trip-page`, `/dashboard`, `/share/trip`)**
   - `DailyExchangeRate` 테이블의 최신 환율
   - Fallback: `base_exchange_rate` (환율 데이터 없을 때만)

3. **공금 추가 (`POST /:meeting_id/budget`)**
   - `DailyExchangeRate` 테이블의 오늘 날짜 환율
   - Fallback: 최신 환율
   - Fallback: `base_exchange_rate`

### 환율 조회 함수 (의사 코드)
```typescript
async function getCurrentExchangeRate(targetCurrency: string): Promise<number> {
  if (targetCurrency === 'KRW') return 1.0;
  
  const today = new Date().toISOString().split('T')[0];
  
  // 1. 오늘 날짜의 환율 조회
  const todayRate = await DailyExchangeRate
    .where('currency', targetCurrency)
    .where('date', today)
    .single();
  
  if (todayRate) return todayRate.rate;
  
  // 2. 최신 환율 조회
  const latestRate = await DailyExchangeRate
    .where('currency', targetCurrency)
    .order('date', 'desc')
    .limit(1)
    .single();
  
  if (latestRate) return latestRate.rate;
  
  // 3. Fallback (공금 추가 시에만)
  return baseExchangeRate || 1.0;
}
```

---

## 공금 계산 로직

### 공금 구성

```
총 공금 (외화 기준) = 초기 공금 (외화) + 추가 공금 (외화)
총 공금 (KRW 기준) = Contribution.amount_krw 합계
```

### 초기 공금 (외화 기준)
```typescript
const initialGonggeumForeign = targetCurrency === 'KRW'
  ? meeting.initial_gonggeum
  : (meeting.initial_gonggeum / meeting.base_exchange_rate);
```

### 추가 공금 (외화 기준)
```typescript
const addedGonggeumForeign = meeting.added_foreign || 0;
```

### 총 공금 (외화 기준)
```typescript
const totalForeign = initialGonggeumForeign + addedGonggeumForeign;
```

### 공금 사용액 (외화 기준)
```typescript
const totalPublicSpentForeign = publicPayments.reduce((sum, p) => {
  if (p.original_price && p.currency !== 'KRW') {
    return sum + p.original_price;  // 원래 외화 금액
  } else if (p.price && p.exchange_rate) {
    return sum + (p.price / p.exchange_rate);  // 역산
  }
  return sum;
}, 0);
```

### 공금 잔액 (외화 기준)
```typescript
const remainingForeign = totalForeign - totalPublicSpentForeign;
```

### 공금 잔액 (KRW 기준, 현재 환율 적용)
```typescript
const remainingGonggeumKRW = targetCurrency === 'KRW'
  ? remainingForeign
  : remainingForeign * currentMarketRate;
```

---

## 정산 계산 로직

### 핵심 공식

```
정산 금액 = 지불한 금액 - 사용한 금액
         = (공금 기여 + 개인 선결제) - (공금 사용 분담 + 선결제 분담)
```

### 지불한 금액 (total_paid)

```typescript
const paidContribution = contribution?.amount_krw || 0;  // 공금 기여
const paidIndividual = advancePayments
  .filter(p => p.payer_id === member.id)
  .reduce((sum, p) => sum + p.price, 0);  // 개인 선결제
const totalPaid = paidContribution + paidIndividual;
```

### 사용한 금액 (total_debit)

```typescript
// 공금 결제 분담
publicPayments.forEach(payment => {
  const paymentKRW = payment.original_price * finalExchangeRate;  // 외화 → KRW
  const perPersonAmount = paymentKRW / payment.attend_member_ids.length;
  memberDebitMap.set(memberId, 
    (memberDebitMap.get(memberId) || 0) + perPersonAmount
  );
});

// 개인 선결제 분담
advancePayments.forEach(payment => {
  const perPersonAmount = payment.price / payment.attend_member_ids.length;
  memberDebitMap.set(memberId, 
    (memberDebitMap.get(memberId) || 0) + perPersonAmount
  );
});

const totalDebit = memberDebitMap.get(member.id) || 0;
```

### 정산 금액 (settlement_amount)

```typescript
const settlementAmount = totalPaid - totalDebit;
const direction = settlementAmount > 0 ? 'RECEIVE' : 
                  settlementAmount < 0 ? 'SEND' : 'NONE';
```

**의미:**
- `RECEIVE`: 받아야 할 금액 (다른 멤버들이 더 많이 사용함)
- `SEND`: 보내야 할 금액 (본인이 더 많이 사용함)
- `NONE`: 정산 완료 (차액 없음)

---

## 주요 개념 정리

### 1. initial_gonggeum vs added_foreign

- **`initial_gonggeum`**: 모임 생성 시 설정한 초기 공금 (KRW 기준, 변경되지 않음)
- **`added_foreign`**: 공금 추가 시마다 누적되는 외화 금액 (외화 기준, 누적)

**예시:**
```
초기 설정: 300,000 KRW (TWD 6,000 @ 50 KRW/TWD)
공금 추가: TWD 300
→ initial_gonggeum: 300,000 (변경 없음)
→ added_foreign: 300 (누적)
```

### 2. base_exchange_rate vs applied_exchange_rate

- **`base_exchange_rate`**: 모임 생성 시점의 환율 (초기 공금 계산용)
- **`applied_exchange_rate`**: 현재 시장 환율 (표시 및 정산용)

**사용 시점:**
- `base_exchange_rate`: 초기 공금을 외화로 변환할 때만 사용
- `applied_exchange_rate`: 공금 잔액 표시, 정산 계산 시 사용

### 3. original_price vs price

- **`original_price`**: 결제 시점의 원래 외화 금액 (예: TWD 1000)
- **`price`**: KRW로 변환된 금액 (예: 45,000 KRW)

**계산:**
```typescript
if (original_price) {
  paymentKRW = original_price * exchange_rate;
} else {
  // 역산
  estimatedOriginalPrice = price / exchange_rate;
  paymentKRW = estimatedOriginalPrice * finalExchangeRate;
}
```

### 4. 공금 결제 vs 개인 결제

**공금 결제 (`type === 'PUBLIC'` 또는 `payer_id === null`):**
- 참여 멤버 수로 균등 분배
- `memberDebitMap`에 인당 금액 추가

**개인 결제 (`type === 'INDIVIDUAL'`):**
- `currency === 'KRW'`: 선결제로 간주, 정산에 포함, 균등 분배
- `currency !== 'KRW'`: 개인 외화 결제, 정산에 미포함

### 5. Contribution.amount_krw 누적

**모임 생성 시:**
```typescript
Contribution.amount_krw = 초기 기여금
```

**공금 추가 시:**
```typescript
const foreignPerMember = foreignAmount / memberCount;
const amountKRWPerMember = foreignPerMember * currentExchangeRate;
Contribution.amount_krw += amountKRWPerMember;  // 누적
```

**총 모은 공금:**
```typescript
const totalCollected = contributions.reduce((sum, c) => 
  sum + c.amount_krw, 0
);
```

---

## 계산 예시

### 예시 1: 모임 생성 및 공금 추가

**초기 설정:**
- 멤버: A, B, C (3명)
- 초기 공금: 각 100,000 KRW (총 300,000 KRW)
- 환율: 50 KRW/TWD
- 초기 외화: 6,000 TWD

**공금 추가:**
- 추가 금액: TWD 300
- 현재 환율: 46.5 KRW/TWD
- 멤버당 추가: 300 / 3 = 100 TWD = 4,650 KRW

**결과:**
```
initial_gonggeum: 300,000 KRW (고정)
added_foreign: 300 TWD (누적)
totalCollected: 300,000 + (4,650 * 3) = 313,950 KRW
```

### 예시 2: 정산 계산

**상황:**
- 멤버 A: 공금 기여 145,000 KRW, 선결제 43,973 KRW
- 멤버 B: 공금 기여 145,000 KRW, 선결제 0 KRW
- 공금 결제: TWD 600 (original_price: 600, 환율: 46.5)
- 선결제: 43,973 KRW (A가 결제, 3명 참여)

**계산:**
```typescript
// 공금 결제 분담
paymentKRW = 600 * 46.5 = 27,900 KRW
perPersonAmount = 27,900 / 3 = 9,300 KRW
// A, B, C 각각 9,300 KRW 부담

// 선결제 분담
perPersonAmount = 43,973 / 3 = 14,657.67 KRW
// A, B, C 각각 14,657.67 KRW 부담

// 멤버 A 정산
totalPaid = 145,000 + 43,973 = 188,973 KRW
totalDebit = 9,300 + 14,657.67 = 23,957.67 KRW
settlementAmount = 188,973 - 23,957.67 = 165,015.33 KRW
direction = 'RECEIVE'  // 받아야 함
```

---

## 코드 위치

- **파일**: `supabase/functions/meeting/index.ts`
- **엔드포인트별 라인**:
  - `POST /trip`: 1778-2100라인
  - `POST /:meeting_id/budget`: 4162-4312라인
  - `GET /trip-page`: 940-1200라인
  - `GET /:meeting_id/dashboard`: 3230-3500라인
  - `GET /share/trip`: 1320-1600라인
  - `GET /:meeting_id/result/trip`: 3536-3900라인

---

## 주의사항

1. **`initial_gonggeum`은 절대 변경하지 않음**
   - 모임 생성 시 설정한 값으로 고정
   - 공금 추가 시에도 변경되지 않음

2. **`added_foreign`은 외화 기준으로 누적**
   - 공금 추가 시 `foreignAmount`를 그대로 더함
   - KRW로 변환하지 않음

3. **정산 시 환율은 `manual_exchange_rate` 우선**
   - 수동 설정 환율이 있으면 무조건 사용
   - 없으면 현재 시장 환율 사용
   - `base_exchange_rate`는 사용하지 않음

4. **공금 결제는 항상 균등 분배**
   - 참여 멤버 수로 나눠서 분배
   - 불공평한 분배는 지원하지 않음

5. **`original_price` 우선 사용**
   - 결제 시 `original_price`를 저장하는 것이 중요
   - 없으면 `price / exchange_rate`로 역산 (부정확할 수 있음)

---

## 변경 이력

- 2026-01-15: 초기 문서 작성
  - 모든 엔드포인트 로직 정리
  - 환율 처리 로직 상세화
  - 공금 계산 로직 명확화
  - 정산 계산 로직 예시 추가

