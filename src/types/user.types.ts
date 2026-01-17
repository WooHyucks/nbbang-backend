/**
 * User 관련 타입 정의
 * Python의 user/schemas.py와 동일
 */

export interface LoginData {
  identifier: string;
  password: string;
  name?: string;
}

export interface OauthData {
  token?: string;
  platform?: string;
  platformId?: string;
  name?: string;
  agreement?: boolean;
}

export interface DepositInformationData {
  bank?: string;
  accountNumber?: string;
  kakaoDepositId?: string;
}

export interface GuestUpdateData {
  loginData?: LoginData;
  oauthData?: OauthData;
}

export interface GuestUpdateDataRequest {
  login_data?: LoginData;
  oauth_data?: OauthData;
}

// Python 스타일 요청 (snake_case)
export interface OauthDataRequest {
  token?: string;
  platform?: string;
  platform_id?: string;
  name?: string;
  agreement?: boolean;
}

