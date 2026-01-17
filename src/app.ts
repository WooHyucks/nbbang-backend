import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { errorHandler } from './middlewares/error.middleware';

// Routes
import userRoutes from './routes/user.routes';
import meetingRoutes from './routes/meeting.routes';
import memberRoutes from './routes/member.routes';
import paymentRoutes from './routes/payment.routes';
import commonRoutes from './routes/common.routes';

dotenv.config();

const app: Express = express();

/**
 * Express App 설정
 * Python의 main.py와 동일한 설정
 */

// CORS 설정
// Python: origins = ["*"]
// 개발 환경에서는 localhost 도메인들을 허용
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000', 'https://rad-platypus-b8f020.netlify.app'];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // origin이 없으면 (같은 도메인 요청) 허용
    if (!origin) {
      return callback(null, true);
    }
    // 허용된 origin 목록에 있거나 CORS_ORIGIN이 '*'이면 허용
    if (process.env.CORS_ORIGIN === '*' || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['*'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Security
// CORS와 충돌하지 않도록 Helmet 설정 조정
app.use(helmet({
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }, // 브라우저 기본값과 동일
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false, // 개발 환경에서 CSP 비활성화 (필요시)
}));

// Rate Limiting
// 개발 환경에서는 더 관대한 제한 적용
const isDevelopment = process.env.NODE_ENV !== 'production' && process.env.SERVICE_ENV !== 'prod';
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || (isDevelopment ? '60000' : '900000')), // 개발: 1분, 프로덕션: 15분
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || (isDevelopment ? '1000' : '100')), // 개발: 1000, 프로덕션: 100
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie Parser
app.use(cookieParser());

// OPTIONS 요청 처리 (CORS preflight)
// Python: @app.options("/{rest_of_path:path}")
app.options('*', cors(corsOptions), (_req: Request, res: Response) => {
  res.status(204).end();
});

// Health Check
// Python: @app.get("/", status_code=200)
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json(true);
});

// Routes
// Python: app.include_router(UserPresentation.router)
app.use('/user', userRoutes);
app.use('/meeting', meetingRoutes);
app.use('/meeting/:meeting_id/member', memberRoutes);
app.use('/meeting/:meeting_id/payment', paymentRoutes);
app.use('/common', commonRoutes);

// Error Handler (마지막에 위치)
app.use(errorHandler);

export default app;

