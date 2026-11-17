# 지하 스마트팜 대시보드

기존 `rnwodud9/smartfarms`의 화면과 센서·펌프 시뮬레이션을 학교 앱에 옮겼습니다.

- 앱: https://apps.bmrschool.net/smartfarm/
- 원본: https://github.com/rnwodud9/smartfarms/tree/6de9d1d654f9c2245e1495a4b879b5c8456f3de8
- 화면: `public/site/app.js` 원본 번들, `src/dashboard*.css` 원본 스타일
- 서버: `supabase/functions/smartfarm-fn/` (학교 Supabase, `smartfarm` 스키마)
- main에 push하면 GitHub Pages와 서버 함수가 각각 자동 배포됩니다.

## 현재 동작

pH·EC·온도·습도 그래프, 200L 기준 물탱크, 기준 이탈 팝업, 알림 센터, 펌프 시뮬레이션, 운영 시작·중지, 설정 저장, 관리자 승인·초대, CSV 다운로드를 포함합니다.
원본과 같이 **센서와 펌프는 기본적으로 시뮬레이션**입니다. 실제 장치의 물량 데이터가 들어오면 물량만 실측으로 전환합니다. 원본 사이트의 DB 기록이나 비밀값을 복사하지 않습니다.

## 로그인

학교 BMR APPS의 이메일·비밀번호 또는 Google 계정을 사용합니다.
기본 최고 관리자는 제공된 담당자 계정 `1104@bmrschool.org`입니다.
다른 계정은 로그인 후 관리자 신청이 생성되며, 최고 관리자가 승인해야 설정이나 펌프를 조작할 수 있습니다.
최고 관리자 변경이 필요하면 함수 비밀값 `SMARTFARM_OWNER_EMAIL`을 설정하세요.
초대는 기존 학교 앱 계정에 권한을 부여하고 허브 메일로 앱 주소를 안내합니다.

## 서버 저장소

서버 함수는 허브가 관리하는 `SMARTFARM_DB_URL`로 앱 전용 DB 계정에 접속합니다.
최초 `/health` 또는 API 요청에서 `smartfarm.dashboard_state` 표를 만들고 RLS를 켜며, 브라우저 역할의 직접 접근을 차단합니다.
설정·운영 상태·관리자·물량·이상 기록은 이 표에 저장합니다. 트랜잭션과 DB 잠금으로 여러 화면의 동시 변경을 조정합니다.
`auth.users`나 다른 앱의 표는 사용하지 않습니다. 기존 `documents` 표는 유지됩니다.

## Google Chat

허브 → 내 서비스 → 스마트팜 → 개발자 셀프서비스에서
`SMARTFARM_GOOGLE_CHAT_WEBHOOK_URL` 비밀값에 Google Chat 웹훅 URL을 저장하세요.
이름만 저장소에 있고 값은 서버에서만 읽습니다. 연결 테스트는 승인된 관리자만 할 수 있습니다.
원본의 빈 POST 본문도 허용하여 `Invalid JSON body` 오류를 피합니다.
팝업은 웹훅 설정과 독립적으로 동작합니다. 자동 전송은 대시보드 조회 중 이루어지며 별도 상시 감시 작업은 없습니다.

## 초음파 물량 센서

장치용 비밀값 `SMARTFARM_ESP32_DEVICE_TOKEN`을 32자 이상으로 설정하고,
장치에서 아래 주소로 `Authorization: Bearer <장치 토큰>`과 JSON `{"distanceCm":25}`를 보냅니다.
측정 실패는 `{"distanceCm":null}`입니다.

`https://psupfmarnyxontorftio.supabase.co/functions/v1/smartfarm-fn/device/water`

200L / 50cm 탱크의 물량은 높이에 비례하며 설정에서 용량·높이·설치 높이를 조정합니다.
측정값을 받지 못한 지 5분이 지나면 마지막 값을 현재값처럼 표시하지 않고 수신 지연을 표시합니다.
펌프 제어는 계속 시뮬레이션이며, 이 주소를 실제 펌프 제어용으로 사용하면 안 됩니다.

## 개발·검사

```bash
npm ci
npm run dev
npm test
npm run build
```

공개 Supabase 주소·공개 키는 기본값이 있으며 `.env.local`의 VITE 설정으로 덮어쓸 수 있습니다.
DB 비밀번호는 브라우저 실행이나 빌드에 필요하지 않습니다.
단위 검사는 실제 서버 계산 모듈(수위 환산, 펌프 주기, 알림 중복 방지, 운영 중지, 기준값)과 API 연결을 검증합니다.
브랜치 push에서 대시보드 빌드와 서버 함수 타입을 검사하고, main 배포 빌드에서도 단위 검사를 실행합니다.

## 공용 주소 규칙

앱 경로는 `/smartfarm/`, 로그인 저장 칸은 `bmr-app-smartfarm-auth`, 경고창 저장 이름은 `smartfarm:` 접두사를 씁니다.
다른 앱의 fetch나 저장소를 바꾸지 않습니다. 로그아웃은 `scope: 'local'`로 수행합니다.
외부 스크립트를 실행하지 않으며 원본 번들을 이 저장소에서 제공합니다.
원본 웹폰트와 동적 스타일을 위해 CSP의 스타일·폰트 목록만 조정했습니다.

학교 개발 환경의 전체 안내는 [BMR APPS 안내](docs/BMR-APPS-GUIDE.md)를 참고하세요.
