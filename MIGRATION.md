# 원본 코드 이관 내역

- 원본 저장소: `rnwodud9/smartfarms`
- 원본 커밋: `6de9d1d654f9c2245e1495a4b879b5c8456f3de8`
- 대상: `bmr-apps/smartfarm` / https://apps.bmrschool.net/smartfarm/

원본 배포 번들과 스타일을 복사했습니다. 화면의 API 호출은 앱 범위의 `window.smartfarmFetch`를 통해 학교 서버 함수로 전달합니다.
Next.js 서버·Cloudflare KV 의존성은 학교 Supabase 함수·트랜잭션 저장소로 옮겼습니다.
브라우저 로그인은 학교에서 제공한 Supabase Auth를 사용하므로 이전 사이트 계정·승인 기록과 별도로 관리됩니다.
원본의 pH·EC·온도·습도 및 펌프는 시뮬레이션이고, 물량 API만 장치 실측을 받습니다.
기존 배포나 장치 설정은 변경하지 않습니다.

원본의 전체 기록·비밀값·서버 측 환경변수는 가져오지 않았습니다.
Google Chat을 사용하려면 학교 셀프서비스에 `SMARTFARM_GOOGLE_CHAT_WEBHOOK_URL`을 설정해야 합니다.
