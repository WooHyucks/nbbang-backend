# 여행 정산 결과 페이지 (final_settlement) 계산 로직

## 개요

`GET /:meeting_id/result/trip` 엔드포인트에서 반환하는 `final_settlement` 배열의 계산 로직을 정리한 문서입니다.

## 계산 흐름

### 1. 환율 결정 (finalExchangeRate)

정산에 사용할 최종 환율을 결정합니다.

**우선순위:**
1. `manual_exchange_rate` (수동 설정 환율) - 있으면 우선 사용
2. `currentMarketRate` (현재 시장 환율) - DailyExchangeRate 테이블에서 조회

```typescript
const finalExchangeRate = (meeting.manual_exchange_rate && meeting.manual_exchange_rate > 0) 
  ? meeting.manual_exchange_rate 
  : currentMarketRate;
```

**중요:** `base_exchange_rate`는 사용하지 않습니다. 항상 현재 환율 또는 수동 설정 환율을 사용합니다.

### 2. 멤버별 실제 사용량 계산 (memberDebitMap)

각 멤버가 실제로 사용한 금액을 계산합니다. 모든 금액은 **KRW 기준**으로 계산됩니다.

#### 2.1 공금 결제 (publicPayments) 처리

공금으로 결제한 내역을 처리합니다.

**외화 결제 처리:**
- `original_price`가 있으면: `paymentKRW = original_price * finalExchangeRate`
- `original_price`가 없으면: 
  1. `estimatedOriginalPrice = price / exchange_rate` (역산)
  2. `paymentKRW = estimatedOriginalPrice * finalExchangeRate`

**KRW 결제 처리:**
- `paymentKRW = price` (그대로 사용)

**인당 금액 분배:**
```typescript
const perPersonAmount = paymentKRW / attendCount;
attendMemberIds.forEach((memberId: number) => {
  const currentDebit = memberDebitMap.get(memberId) || 0;
  memberDebitMap.set(memberId, currentDebit + perPersonAmount);
});
```

#### 2.2 개인 선결제 (advancePayments) 처리

개인 선결제는 이미 KRW이므로 그대로 사용합니다.

```typescript
const perPersonAmount = paymentPrice / attendCount;
// memberDebitMap에 동일하게 추가
```

### 3. 멤버별 정산 계산 (finalSettlement)

각 멤버별로 정산 금액을 계산합니다.

#### 3.1 지불한 금액 (total_paid)

**paid_contribution (공금 기여):**
```typescript
const contribution = contributions.find((c: any) => c.member_id === member.id);
const paidContribution = contribution?.amount_krw || 0;
```

**paid_individual (개인 선결제):**
```typescript
const memberAdvancePayments = advancePayments.filter((p: any) => p.payer_id === member.id);
const paidIndividual = memberAdvancePayments.reduce((sum: number, p: any) => sum + (p.price || 0), 0);
```

**total_paid:**
```typescript
const totalPaid = paidContribution + paidIndividual;
```

#### 3.2 사용한 금액 (total_debit)

```typescript
const totalDebit = memberDebitMap.get(member.id) || 0;
```

`memberDebitMap`에서 해당 멤버의 실제 사용량을 가져옵니다. 이 값은 위에서 계산한 모든 공금 결제와 개인 선결제의 인당 금액 합계입니다.

#### 3.3 정산 금액 (settlement_amount)

```typescript
const settlementAmount = totalPaid - totalDebit;
```

- **양수 (RECEIVE):** 받아야 할 금액 (다른 멤버들이 더 많이 사용함)
- **음수 (SEND):** 보내야 할 금액 (본인이 더 많이 사용함)
- **0 (NONE):** 정산 완료

#### 3.4 송금 링크 생성

**토스 송금 링크:**
```typescript
if (absAmount > 0 && managerInfo.bank && managerInfo.account_number) {
  const params = new URLSearchParams({
    amount: absAmount.toString(),
    bank: managerInfo.bank,
    accountNo: managerInfo.account_number,
  });
  tossLink = `supertoss://send?${params.toString()}`;
}
```

**카카오페이 송금 링크:**
```typescript
if (absAmount > 0 && managerInfo.kakao_deposit_id) {
  const toHexValue = (value: number): string => {
    return (value * 524288).toString(16);
  };
  const hexAmount = toHexValue(absAmount);
  kakaoLink = `https://qr.kakaopay.com/${managerInfo.kakao_deposit_id}${hexAmount}`;
}
```

## 응답 형식

```typescript
{
  final_settlement: [
    {
      member_id: number,
      name: string,
      paid_contribution: number,      // 공금 기여 금액 (KRW)
      paid_individual: number,         // 개인 선결제 금액 (KRW)
      total_paid: number,              // 총 지불 금액 (KRW)
      total_debit: number,              // 총 사용 금액 (KRW)
      settlement_amount: number,       // 정산 금액 (KRW)
      direction: 'RECEIVE' | 'SEND' | 'NONE',
      deposit_copy_text: string | null, // 계좌 이체용 텍스트
      links: {
        toss: string | undefined,
        kakao: string | undefined,
      },
    },
    // ... 다른 멤버들
  ]
}
```

## 계산 예시

### 예시 1: 외화 결제가 있는 경우

**상황:**
- 공금 결제: TWD 1000원 (original_price: 1000, currency: 'TWD')
- 참여 멤버: A, B, C (3명)
- finalExchangeRate: 45 (1 TWD = 45 KRW)

**계산:**
1. `paymentKRW = 1000 * 45 = 45,000 KRW`
2. `perPersonAmount = 45,000 / 3 = 15,000 KRW`
3. A, B, C 각각의 `memberDebitMap`에 15,000 추가

### 예시 2: 정산 계산

**멤버 A:**
- `paid_contribution`: 600,000 KRW
- `paid_individual`: 1,800,000 KRW
- `total_paid`: 2,400,000 KRW
- `total_debit`: 637,500 KRW (memberDebitMap에서 가져옴)
- `settlement_amount`: 2,400,000 - 637,500 = 1,762,500 KRW
- `direction`: 'RECEIVE' (양수이므로 받아야 함)

**멤버 B:**
- `paid_contribution`: 600,000 KRW
- `paid_individual`: 0 KRW
- `total_paid`: 600,000 KRW
- `total_debit`: 637,900 KRW
- `settlement_amount`: 600,000 - 637,900 = -37,900 KRW
- `direction`: 'SEND' (음수이므로 보내야 함)

## 중요 사항

1. **모든 계산은 KRW 기준으로 수행됩니다.**
   - 외화 결제는 `original_price * finalExchangeRate`로 변환
   - KRW 결제는 그대로 사용

2. **환율은 항상 현재 환율을 사용합니다.**
   - `base_exchange_rate`는 사용하지 않음
   - `manual_exchange_rate`가 있으면 우선 사용
   - 없으면 DailyExchangeRate 테이블에서 최신 환율 조회

3. **인당 금액은 균등 분배됩니다.**
   - `perPersonAmount = paymentKRW / attendCount`
   - 모든 참여 멤버에게 동일한 금액이 분배됨

4. **정산 금액 계산:**
   - `settlement_amount = total_paid - total_debit`
   - 양수: 받아야 할 금액
   - 음수: 보내야 할 금액

## 코드 위치

- 파일: `supabase/functions/meeting/index.ts`
- 엔드포인트: `GET /:meeting_id/result/trip`
- 시작 라인: 약 3477라인
- 주요 계산 로직: 3620-3806라인

