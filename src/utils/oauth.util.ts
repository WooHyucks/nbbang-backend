import axios from 'axios';
import * as querystring from 'querystring';

/**
 * OAuth Utility
 * Python의 base/security.py의 OAuth 메서드들과 동일한 역할
 */

const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID;
const KAKAO_REDIRECT_URL = process.env.KAKAO_REDIRECT_URL;
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const NAVER_STATE = process.env.NAVER_STATE;

/**
 * Python: def get_user_name_and_platform_id_by_google_oauth(token)
 */
export async function getUserNameAndPlatformIdByGoogleOAuth(token: string): Promise<[string, string]> {
  const response = await axios.get(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${token}`);
  const googleUserData = response.data;
  const name = googleUserData.name;
  const platformId = String(googleUserData.id);
  return [name, platformId];
}

/**
 * Python: def get_user_name_and_platform_id_by_kakao_oauth(token)
 */
export async function getUserNameAndPlatformIdByKakaoOAuth(token: string): Promise<[string, string]> {
  // Python: def _get_user_access_token_by_kakao_oauth(token)
  const accessToken = await _getUserAccessTokenByKakaoOAuth(token);
  
  const response = await axios.get('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  const kakaoUserData = response.data;
  const platformId = String(kakaoUserData.id);
  const name = kakaoUserData.kakao_account.profile.nickname;
  return [name, platformId];
}

async function _getUserAccessTokenByKakaoOAuth(code: string): Promise<string> {
  const data = {
    grant_type: 'authorization_code',
    client_id: KAKAO_CLIENT_ID,
    redirect_uri: KAKAO_REDIRECT_URL,
    code: code,
  };
  
  const response = await axios.post('https://kauth.kakao.com/oauth/token', querystring.stringify(data), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  
  return response.data.access_token;
}

/**
 * Python: def get_user_name_and_platform_id_by_naver_oauth(token)
 */
export async function getUserNameAndPlatformIdByNaverOAuth(token: string): Promise<[string, string]> {
  // Python: def _get_user_access_token_by_naver_oauth(token)
  const accessToken = await _getUserAccessTokenByNaverOAuth(token);
  
  const response = await axios.get('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  const naverUserData = response.data;
  const platformId = String(naverUserData.response.id);
  const name = naverUserData.response.name;
  return [name, platformId];
}

async function _getUserAccessTokenByNaverOAuth(code: string): Promise<string> {
  const url = `https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=${NAVER_CLIENT_ID}&client_secret=${NAVER_CLIENT_SECRET}&code=${code}&state=${NAVER_STATE}`;
  const response = await axios.post(url);
  return response.data.access_token;
}

