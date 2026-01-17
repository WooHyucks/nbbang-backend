import { Request, Response, NextFunction } from 'express';
import { CustomException } from '../exceptions/custom.exceptions';

/**
 * Error Middleware
 * Python의 base/exceptions.py의 catch_exception과 동일한 역할
 */
export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Python: if issubclass(exce.__class__, CustomException):
  if (error instanceof CustomException) {
    res.status(error.statusCode).json({ detail: error.detail });
    return;
  }

  // Python: logging.error(f"\n===\nAn unexpected error occurred. : {exce}\ndetail : {traceback.format_exc()}===")
  // 개발 환경에서는 더 자세한 에러 정보 출력
  if (process.env.NODE_ENV === 'development' || process.env.SERVICE_ENV === 'dev') {
    
    // 개발 환경에서는 더 자세한 에러 메시지 반환
    res.status(500).json({
      detail: error.message || 'An internal server error occurred. If the problem persists, please contact our support team.',
      error: error.name,
      stack: error.stack,
    });
  } else {
    res.status(500).json({
      detail: 'An internal server error occurred. If the problem persists, please contact our support team.',
    });
  }
}

