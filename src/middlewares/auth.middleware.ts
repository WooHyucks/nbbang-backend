import { Request, Response, NextFunction } from 'express';
import { getUserIdByToken } from '../utils/jwt.util';
import { InvalidTokenException, MissingTokenException } from '../exceptions/custom.exceptions';

/**
 * Auth Middleware
 * Python의 base/security.py의 Token.get_token_by_authorization과 동일한 역할
 */
export interface AuthRequest extends Request {
  userId?: number;
}

export function authMiddleware(req: AuthRequest, _res: Response, next: NextFunction): void {
  try {
    // Python: Authorization: Optional[HTTPAuthorizationCredentials] = Security(HTTPBearer(auto_error=False))
    // Python: authorization: Optional[str] = Header(default=None)
    let token: string | undefined;

    // 1. 쿠키에서 토큰 확인 (우선순위)
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // 2. Bearer 토큰 확인 (하위 호환성)
    else {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (req.headers.authorization) {
        token = req.headers.authorization;
      }
    }

    if (!token) {
      throw new MissingTokenException();
    }

    // Python: user_id = Token.get_user_id_by_token(token=Authorization)
    const userId = getUserIdByToken(token);
    req.userId = userId;
    next();
  } catch (error) {
    if (error instanceof MissingTokenException || error instanceof InvalidTokenException) {
      next(error);
    } else {
      next(new InvalidTokenException());
    }
  }
}

