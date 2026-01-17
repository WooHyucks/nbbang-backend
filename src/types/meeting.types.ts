/**
 * Meeting 관련 타입 정의
 * Python의 meeting/schema.py와 동일
 */

export interface MeetingRequest {
  name?: string;
  date?: string;
}

export interface SimpleMeetingRequest extends MeetingRequest {
  simplePrice?: number;
  simpleMemberCount?: number;
}

export interface DepositInformationRequest {
  bank?: string;
  accountNumber?: string;
  kakaoDepositId?: string;
}



