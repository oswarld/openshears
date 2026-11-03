# ✂️ OpenShears

[English](README.md) · **한국어** · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md)

**AI 에이전트마다 GitHub 권한을 달라고 했고, 당신은 전부 승인했습니다.**

Claude, ChatGPT와 Codex, Cursor, Grok, Copilot의 에이전트들, Meta의 Muse, 그리고 어느 오후에 한 번 써 본 MCP 서버까지. 하나하나가 GitHub, Gmail, Drive, 캘린더, Notion, Figma 권한을 요구했고 "Authorize" 버튼은 2초면 끝났습니다. 다시 돌아가 끊는 사람은 없습니다. 제 계정을 처음 감사해 보니 GitHub 계정 하나에 **앱 45개**, Google 계정 하나에 **연결된 앱 122개**가 남아 있었고, 대부분 연결했다는 사실조차 잊은 에이전트와 도구였습니다.

OpenShears는 그 실행 취소 버튼입니다. 계정에 아직 접근 권한을 가진 앱과 에이전트를 전부 나열하고, 실제로 쓰는 것만 고르게 한 뒤, 나머지를 한 번에 끊습니다. 설정 페이지 일곱 군데를 돌아다닐 필요가 없습니다.

```bash
npx openshears audit                                      # 어디에 무엇이 연결돼 있는지, 읽기 전용
npx openshears prune github --keep "Claude" --dry-run     # 미리보기: GitHub에서 나머지가 전부 끊길 예정
npx openshears prune github --keep "Claude"               # 확인 후 실제 해제
```

## 빠른 시작

```bash
npx openshears audit local      # 이 컴퓨터의 에이전트와 그들이 보관한 자격증명, 로그인 불필요
npx openshears audit github     # Chrome 창에서 한 번 로그인하면 계정의 모든 앱을 나열
```

프로바이더 없이 `npx openshears audit`를 실행하면 모든 프로바이더를 점검하고, 아직 로그인하지 않은 서비스마다 로그인 창을 엽니다. 감사는 읽기 전용이며, `prune`과 확인 없이는 아무것도 해제되지 않습니다.

감사 결과는 이렇게 보입니다(실제 계정, 2026년 11월):

```
Audit: GitHub (oswarld)
  [OAuth app] GitHub CLI (by github) — Last used within the last week
  [OAuth app] Notion (by integration-notion) — Last used within the last 4 months
  [App authorization] ChatGPT Codex Connector (by openai) — Last used within the last week
  [App authorization] Claude (by anthropics) — Last used within the last 2 weeks
  [App authorization] Cursor (by cursor) — Last used within the last week
  [App authorization] Grok (by xAI) (by xai-org) — Last used within the last week
  [App authorization] Meta Muse AI (by meta) — Never used
  … 45 connections

Audit: Google
  [OAuth app] Claude for Gmail
  [OAuth app] Claude for Google Drive
  [Sign-in] ChatGPT
  [Sign-in] Pickle
  … 122 linked apps
```

핵심은 이것입니다. GitHub 계정 하나에 45개, Google 계정 하나에 122개, 대부분 잊힌 연결이었습니다.

OpenShears라는 이름은 랍스터를 해체할 때 쓰는 가위에서 따왔습니다. 원래 [OpenClaw](https://github.com/openclaw/openclaw) 제거 도구로 시작했고, 그 기능은 `openshears openclaw`로 그대로 남아 있습니다.

## 동작 방식

대부분의 서비스는 _사용자가_ 자신이 승인한 서드파티 앱을 조회하거나 해제할 API를 제공하지 않습니다. GitHub는 2020년에 OAuth Authorizations API를 제거했고 승인 목록을 설정 페이지에서만 보여줍니다. 그래서 OpenShears는 이미 설치된 브라우저(Google Chrome 또는 Microsoft Edge, 별도 다운로드 없음)로 바로 그 설정 페이지를 조작하되, `~/.openshears/browser` 아래의 **전용 프로필**을 씁니다. 보이는 창에서 한 번 로그인하면 이후 실행은 그 세션을 창 없이 재사용합니다. OpenShears는 입력 내용을 읽지 않고, 비밀번호를 저장하지 않으며, 평소 쓰는 브라우저 프로필을 건드리지 않습니다.

Node.js 20 이상이 필요하고, 브라우저 기반 프로바이더에는 Chrome 또는 Edge가 필요합니다. 다른 Chromium 실행 파일을 쓰려면 `OPENSHEARS_BROWSER`를 설정하세요.

## 명령

| 명령                                             | 기능                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `openshears audit [provider...]`                 | 모든(또는 지정한) 프로바이더의 연결을 나열합니다. 읽기 전용. `--json`은 보고서, `--headed`는 브라우저 표시. |
| `openshears prune <provider> --keep <name...>`   | 남길 이름에 해당하지 않는 모든 해제 가능 연결을 끊습니다. 계획을 보여 주고 확인을 받습니다.                 |
| `openshears prune <provider> --revoke <name...>` | 패턴에 맞는 연결만 끊습니다.                                                                                |
| `openshears prune <provider>`                    | 대화형: 체크리스트에서 남길 연결을 고릅니다(기본값은 전부 유지).                                            |
| `openshears login <provider>`                    | 브라우저 프로필을 열고 로그인합니다.                                                                        |
| `openshears logout`                              | 저장된 브라우저 세션을 삭제합니다.                                                                          |
| `openshears providers`                           | 프로바이더 목록을 표시합니다.                                                                               |
| `openshears inspect <provider>`                  | 프로바이더 페이지의 제목·링크·버튼을 읽기 전용으로 덤프합니다. 레시피 작성·수정용.                          |
| `openshears openclaw`                            | 원래의 OpenClaw 제거 도구(아래 참고).                                                                       |

패턴은 연결 이름 또는 id에 대소문자 구분 없이 매칭되고 `*`를 와일드카드로 씁니다(`"Claude*"`는 모든 Claude 앱을 남깁니다). 아무것에도 매칭되지 않는 패턴이 있으면 해제 전에 실행을 중단하므로, `--keep`의 오타로 전부 끊기는 일은 없습니다.

`--dry-run`과 `--json`은 절대 해제하지 않습니다. 터미널이 없으면 `prune`에 명시적인 `--keep`/`--revoke`/`--all`과 `--yes`가 필요합니다. Ctrl-C, Esc, 부정 응답은 취소입니다.

예: GitHub에서 Claude와 Cursor만 남기고 나머지를 끊되, 먼저 미리보기:

```bash
npx openshears prune github --keep "Claude" "Cursor" --dry-run
```

```bash
npx openshears prune github --keep "Claude" "Cursor"
```

## 프로바이더

| 프로바이더 | 범위                                                                                                                             | 해제                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `github`   | github.com 설정의 Authorized OAuth Apps, Authorized GitHub Apps, Installed GitHub Apps                                           | OAuth 앱과 GitHub App 승인. 설치는 수동 제거용 링크와 함께 나열. 실계정 검증.                         |
| `google`   | Linked apps: Google 계정 데이터(Gmail, Drive, Calendar 등)에 접근하는 앱, Sign in with Google 앱, 연결된 계정                    | 앱별 "Delete all". 감사와 해제 모두 실계정 검증(도구로 실제 앱 제거).                                 |
| `notion`   | Notion 워크스페이스에 연결된 앱(설정 → 연결 → 연결됨)                                                                            | 앱별 연결 해제. 감사 실계정 검증(영어/한국어 UI); 해제는 fixture 검증.                                |
| `stripe`   | Stripe 계정의 설치된 앱과 서드파티 플랫폼(Apps overview → Installed)                                                             | 앱별 액세스 해제. 페이지와 로그인은 실계정 검증; 행 구조는 앱이 설치된 계정이 필요.                   |
| `figma`    | Figma 계정에 연결된 서드파티 앱(설정 → 보안 → 연결된 앱)                                                                         | 앱별 액세스 취소. 감사 실계정 검증(영어/한국어 UI); 확인 단계는 fixture 검증.                         |
| `vercel`   | Vercel 팀에 설치된 통합(Dashboard → Integrations)                                                                                | 통합 제거. 목록과 Remove 버튼은 실계정 검증; 확인 단계는 fixture 검증.                                |
| `slack`    | Slack 워크스페이스에 설치된 앱(Manage apps → Installed apps)                                                                     | 읽기 전용 목록, 실계정 검증. 제거는 워크스페이스 정책에 따라 다르므로 앱의 Configuration 탭에서 직접. |
| `local`    | 이 컴퓨터에 설치된 에이전트의 자격증명 저장소와 MCP 설정(Claude, Codex, Gemini, Cursor, Windsurf, VS Code, OpenClaw, GitHub CLI) | 읽기 전용 인벤토리. MCP 서버 *이름*만 읽고, 토큰과 명령은 읽지 않습니다.                              |

해제는 앱의 상세 페이지를 열고 확인 다이얼로그를 승인한 뒤 목록을 다시 읽어 앱이 사라졌는지 검증합니다. 여전히 남아 있으면 그 앱에 대한 실패로 보고하고 나머지를 계속 진행합니다.

## 무엇이 검증됐는지, 솔직하게

설정 페이지는 안정적인 API가 아닙니다. 레시피는 마크업 클래스 대신 접근성 이름과 링크 구조를 쓰고, 페이지네이션을 따라가며, 모든 레시피에는 테스트 스위트 안에 목록과 해제를 끝까지 실행하는 로컬 모사 사이트가 있습니다. 그 위에:

- **실계정 감사**는 GitHub, Google, Notion, Figma, Vercel, Slack에서 2026-11-03에 실행됐고, 해제 버튼의 위치도 실제 페이지에서 확인했습니다.
- **도구를 통한 실제 해제**는 Google에서 수행했습니다("Delete all" 흐름, 목록 재조회로 검증). GitHub, Notion, Figma, Vercel의 마지막 확인 클릭은 아직 모사 사이트에서만 실행됐습니다. 그 서비스에서의 첫 실제 해제는 `--revoke "<버려도 되는 앱 하나>"`와 `--headed`로 지켜보며 하세요.
- **Slack**은 읽기 전용 목록이고, **Stripe**의 행 구조는 앱이 설치된 계정으로 실행하기 전까지 미검증입니다.
- 라벨은 계정의 UI 언어를 따릅니다. 필요한 곳은 영어와 한국어를 다루며, 다른 언어는 `src/providers/`의 정규식을 확장해야 합니다.

흐름별 상태 전체는 [docs/providers.md](docs/providers.md)에 있습니다. 사이트가 페이지를 바꾸면 `openshears inspect <provider>`가 레시피가 붙잡을 수 있는 요소를 보여 줍니다.

## OpenClaw 제거

`openshears openclaw`는 macOS와 Linux/WSL의 로컬 OpenClaw 설치를 점검하고 제거합니다. `--dry-run` 또는 `--json`으로 미리 보고, `--keep-data`는 상태와 워크스페이스를 보존하며, `--include-workspaces`는 외부 워크스페이스까지 제거합니다. 제거는 영구적이며 상태 디렉터리에는 자격증명, 세션, 메모리가 들어 있습니다. 동작, 경계, 호환성은 [docs/openclaw-compatibility.md](docs/openclaw-compatibility.md)에 정리돼 있습니다.

## 개발

```bash
git clone https://github.com/oswarld/openshears.git
cd openshears
npm ci
npm run build
npm test
npm run lint
node dist/index.js audit local
```

테스트는 임시 디렉터리, 모의 프로바이더, 각 서비스의 설정 페이지를 본뜬 로컬 HTTP fixture를 사용하며, 실제 계정에 로그인하거나 무언가를 해제하지 않습니다. fixture 테스트는 headless Chrome이 설치돼 있을 때 실행되고, 없으면 건너뜁니다.

## 기여: 끊고 싶은 서비스를 추가해 주세요

모든 SaaS에는 "연결된 앱" 페이지가 있고, 거의 어디에도 그것을 위한 API는 없습니다. OpenShears는 현재 GitHub, Google, Notion, Stripe, Figma, Vercel, Slack을 다룹니다. **쓰시는 서비스를 추가해 주세요.** Discord, Linear, Dropbox, Microsoft, Atlassian, Zoom, Hugging Face, X, LinkedIn, Shopify 모두 그런 페이지가 있고 같은 모델에 맞습니다.

프로바이더는 `src/providers/<service>.ts`의 `WebRecipe`입니다. 설정 페이지 URL, 행을 찾는 방법(링크 접두사 또는 행 선택자), 접근성 역할과 라벨로 지정한 해제 클릭. 서비스별 코드는 필요 없습니다.

1. 한 번 로그인: `openshears login <service>` (또는 `baseUrl`, `loginPath`, `signedOutPaths`만 채운 레시피를 먼저 추가).
2. 연결된 앱 페이지에서 `openshears inspect <service>` 실행. 레시피가 붙잡을 수 있는 제목·링크·버튼·반복 컨테이너를 읽기 전용으로 출력합니다.
3. `lists`와 `revoke`를 채우고 `openshears audit <service>`로, 그리고 버려도 되는 앱 하나로 `openshears prune <service> --revoke "<name>"`을 실행해 검증합니다.
4. 페이지 구조를 본뜬 작은 fixture 사이트를 `tests/fixtures/`에 추가하고(GitHub, Google, Notion, Figma, Vercel 것 참고), 그것을 상대로 감사와 해제를 하는 테스트를 추가합니다.
5. 검증 날짜와 언어별 라벨을 [docs/providers.md](docs/providers.md)에 기록합니다.

감사는 읽기 전용으로 유지하고, 모든 해제는 목록 재조회로 검증하며, 토큰이나 폼 내용은 절대 로그에 남기지 마세요. 새 레시피 풀 리퀘스트가 이 프로젝트에 가장 큰 기여입니다.

## 라이선스

MIT. [LICENSE](LICENSE) 참고.
