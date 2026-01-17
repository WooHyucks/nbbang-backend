#!/bin/bash
# Supabase Edge Function 배포 스크립트

echo "🚀 Supabase Edge Function 배포를 시작합니다..."

# Supabase 로그인 확인
if ! supabase projects list &>/dev/null; then
    echo "⚠️  Supabase CLI에 로그인이 필요합니다."
    echo "다음 명령어를 실행하세요:"
    echo "  supabase login"
    exit 1
fi

# Meeting 함수 배포
echo "📦 Meeting Edge Function 배포 중..."
supabase functions deploy meeting --no-verify-jwt

if [ $? -eq 0 ]; then
    echo "✅ 배포가 완료되었습니다!"
else
    echo "❌ 배포 중 오류가 발생했습니다."
    exit 1
fi
