import * as jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// .env 파일 로드 (모듈이 먼저 로드될 수 있으므로)
dotenv.config();

/**
 * JWT Token Utility
 * Python의 base/security.py의 Token 클래스와 동일한 역할
 */
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;

if (!JWT_SECRET_KEY) {
  throw new Error('JWT_SECRET_KEY environment variable is not set');
}

// 타입 단언: 위에서 체크했으므로 항상 string
const secretKey: string = JWT_SECRET_KEY;

/**
 * Python: def create_token_by_user_id(user_id)
 */
export function createTokenByUserId(userId: number): string {
  // Python: payload = {"id": user_id, "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30)}
  const payload = {
    id: userId,
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30일
  };
  // Python: token = jwt.encode(payload, secret_key)
  return jwt.sign(payload, secretKey, { algorithm: 'HS256' });
}

/**
 * Python: def get_user_id_by_token(token)
 */
export function getUserIdByToken(token: string): number {
  try {
    // Python: token_info = jwt.decode(token, secret_key, algorithms="HS256")
    const tokenInfo = jwt.verify(token, secretKey, { algorithms: ['HS256'] });
    if (typeof tokenInfo === 'string') {
      throw new Error('Invalid token format');
    }
    if (typeof tokenInfo === 'object' && tokenInfo !== null && 'id' in tokenInfo) {
      const payload = tokenInfo as { id: number };
      return payload.id;
    }
    throw new Error('Invalid token payload');
  } catch (error) {
    throw new Error('유효하지 않은 인증 토큰입니다.');
  }
}

