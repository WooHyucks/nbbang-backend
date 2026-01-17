import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Supabase 클라이언트 설정
 * 
 * Python 백엔드의 database_connector.py를 대체하는 역할
 * - 기존: PostgreSQL 직접 연결 (SQLAlchemy)
 * - 현재: Supabase 클라이언트를 통한 접근
 */

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file'
  );
}

/**
 * 일반 클라이언트 (Row Level Security 적용)
 * 프론트엔드에서 사용하거나, 사용자 권한으로 접근할 때 사용
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false, // 서버 사이드에서는 세션을 유지하지 않음
  },
}) as SupabaseClient;

/**
 * 서비스 역할 클라이언트 (Row Level Security 우회)
 * 서버 사이드에서 관리자 권한으로 접근할 때 사용
 * 주의: SUPABASE_SERVICE_ROLE_KEY는 절대 클라이언트에 노출되면 안 됨
 */
export const supabaseAdmin: SupabaseClient | null = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

/**
 * 환경 변수에서 SERVICE_ENV 가져오기
 * Python 코드: service_env = os.environ.get("SERVICE_ENV")
 * 테이블명에 prefix로 사용 (예: dev_user, production_user)
 */
export const serviceEnv: string = process.env.SERVICE_ENV || 'dev';

/**
 * 테이블명 생성 헬퍼
 * Python 코드의 f"{service_env}_user" 패턴과 동일
 * 
 * @param tableName - 기본 테이블명 (예: "user", "meeting")
 * @returns 환경별 prefix가 붙은 테이블명 (예: "dev_user")
 */
export function getTableName(tableName: string): string {
  return `${serviceEnv}_${tableName}`;
}

/**
 * Supabase 클라이언트 헬퍼
 * Prisma를 사용하므로 직접 Supabase 클라이언트를 사용할 일은 적지만,
 * 인증이나 실시간 기능이 필요할 때 사용
 */
export default {
  supabase,
  supabaseAdmin,
  serviceEnv,
  getTableName,
};

