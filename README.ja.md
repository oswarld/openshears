# ✂️ OpenShears

[English](README.md) · [한국어](README.ko.md) · **日本語** · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md)

**どの AI エージェントも GitHub への権限を求めてきた。あなたは全部に「はい」と答えた。**

Claude、ChatGPT と Codex、Cursor、Grok、Copilot のエージェント、Meta の Muse、ある午後に一度だけ試した MCP サーバー。どれもが GitHub、Gmail、Drive、カレンダー、Notion、Figma へのアクセスを求め、「Authorize」は 2 秒で終わりました。後で戻って取り消す人はいません。自分のアカウントを初めて監査したとき、GitHub アカウント 1 つに **45 個のアプリ**、Google アカウント 1 つに **122 個のリンク済みアプリ** が残っていて、そのほとんどは接続したことすら忘れていたエージェントやツールでした。

OpenShears はその「取り消し」ボタンです。アカウントにまだアクセス権を持つアプリとエージェントをすべて一覧にし、本当に使っているものだけを選ばせ、残りを一度に取り消します。7 つの設定ページを回る必要はありません。

```bash
npx openshears audit                                      # どこに何が接続されているか、読み取り専用
npx openshears prune github --keep "Claude" --dry-run     # プレビュー: GitHub の残りがすべて取り消される予定
npx openshears prune github --keep "Claude"               # 確認のうえ取り消し
```

## クイックスタート

```bash
npx openshears audit local      # このマシンのエージェントとそれらが保持する認証情報、サインイン不要
npx openshears audit github     # Chrome ウィンドウで一度サインインすると、アカウントの全アプリを一覧
```

プロバイダーを指定せずに `npx openshears audit` を実行すると、すべてのプロバイダーを監査し、まだサインインしていないサービスごとにサインインウィンドウを開きます。監査は読み取り専用で、`prune` と確認なしには何も取り消されません。

監査結果の例（実際のアカウント、2026 年 11 月）:

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

これが要点です。GitHub アカウント 1 つに 45 個、Google アカウント 1 つに 122 個、そのほとんどが忘れられていました。

OpenShears の名前は、ロブスターを解体するときに使うハサミに由来します。もともと [OpenClaw](https://github.com/openclaw/openclaw) のアンインストーラーとして始まり、その機能は `openshears openclaw` としてそのまま残っています。

## 仕組み

ほとんどのサービスは、_ユーザー自身が_ 承認したサードパーティアプリを一覧・取り消しするための API を提供していません。GitHub は 2020 年に OAuth Authorizations API を廃止し、承認は設定ページにしか表示されません。そこで OpenShears は、すでにインストール済みのブラウザー（Google Chrome または Microsoft Edge、ダウンロード不要）で同じ設定ページを操作します。ただし `~/.openshears/browser` 配下の **専用プロファイル** を使います。見えるウィンドウで一度サインインすれば、以降の実行はそのセッションをヘッドレスで再利用します。OpenShears は入力内容を読まず、パスワードを保存せず、普段使いのブラウザープロファイルには触れません。

Node.js 20 以上が必要で、ブラウザー型プロバイダーには Chrome か Edge が必要です。別の Chromium 実行ファイルを使うには `OPENSHEARS_BROWSER` を設定してください。

## コマンド

| コマンド                                         | 動作                                                                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `openshears audit [provider...]`                 | すべて（または指定した）プロバイダーの接続を一覧。読み取り専用。`--json` でレポート、`--headed` でブラウザーを表示。 |
| `openshears prune <provider> --keep <name...>`   | 残す名前に一致しない取り消し可能な接続をすべて取り消す。計画を表示して確認を求める。                                 |
| `openshears prune <provider> --revoke <name...>` | 一致する接続だけを取り消す。                                                                                         |
| `openshears prune <provider>`                    | 対話モード: チェックリストから残す接続を選ぶ（既定ではすべて残す）。                                                 |
| `openshears login <provider>`                    | ブラウザープロファイルを開いてサインインする。                                                                       |
| `openshears logout`                              | 保存されたブラウザーセッションを削除する。                                                                           |
| `openshears providers`                           | プロバイダーを一覧する。                                                                                             |
| `openshears inspect <provider>`                  | プロバイダーのページ（見出し・リンク・ボタン）を読み取り専用でダンプする。レシピの作成・修正用。                     |
| `openshears openclaw`                            | 元の OpenClaw アンインストーラー（後述）。                                                                           |

パターンは接続の名前または id に大文字小文字を区別せず一致し、`*` をワイルドカードとして使えます（`"Claude*"` はすべての Claude アプリを残します）。どれにも一致しないパターンがあると取り消し前に実行を中止するので、`--keep` のタイプミスで全部が消えることはありません。

`--dry-run` と `--json` は決して取り消しません。ターミナルがない場合、`prune` には明示的な `--keep`/`--revoke`/`--all` と `--yes` が必要です。Ctrl-C、Esc、否定の回答はキャンセルです。

例: GitHub で Claude と Cursor だけ残して残りを切る。まずプレビュー:

```bash
npx openshears prune github --keep "Claude" "Cursor" --dry-run
```

```bash
npx openshears prune github --keep "Claude" "Cursor"
```

## プロバイダー

| プロバイダー | 対象                                                                                                                                          | 取り消し                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `github`     | github.com 設定の Authorized OAuth Apps、Authorized GitHub Apps、Installed GitHub Apps                                                        | OAuth アプリと GitHub App 認可。インストールは手動削除用リンク付きで一覧。実アカウントで検証済み。                  |
| `google`     | Linked apps: Google アカウントのデータ（Gmail、Drive、Calendar など）にアクセスするアプリ、Sign in with Google のアプリ、リンク済みアカウント | アプリごとの「Delete all」。監査と取り消しを実アカウントで検証済み（ツールで実際にアプリを削除）。                  |
| `notion`     | Notion ワークスペースに接続されたアプリ（設定 → コネクト → 接続済み）                                                                         | アプリごとに接続解除。監査は実アカウントで検証済み（英語/韓国語 UI）、解除はフィクスチャで検証。                    |
| `stripe`     | Stripe アカウントのインストール済みアプリとサードパーティプラットフォーム（Apps overview → Installed）                                        | アプリごとにアクセス取り消し。ページとサインインは実アカウントで検証済み、行構造はアプリ入りアカウント待ち。        |
| `figma`      | Figma アカウントに接続されたサードパーティアプリ（設定 → セキュリティ → 接続済みアプリ）                                                      | アプリごとにアクセス取り消し。監査は実アカウントで検証済み（英語/韓国語 UI）、確認はフィクスチャで検証。            |
| `vercel`     | Vercel チームにインストール済みのインテグレーション（Dashboard → Integrations）                                                               | インテグレーション削除。一覧と Remove ボタンは実アカウントで検証済み、確認はフィクスチャで検証。                    |
| `slack`      | Slack ワークスペースにインストール済みのアプリ（Manage apps → Installed apps）                                                                | 読み取り専用の一覧、実アカウントで検証済み。削除はワークスペースのポリシー次第で、アプリの Configuration タブから。 |
| `local`      | このマシンのエージェントの認証情報ストアと MCP 設定（Claude、Codex、Gemini、Cursor、Windsurf、VS Code、OpenClaw、GitHub CLI）                 | 読み取り専用インベントリ。MCP サーバーの _名前_ だけを読み、トークンやコマンドは読み戻しません。                    |

各取り消しはアプリの詳細ページを開き、確認ダイアログを承認し、一覧を再読み込みしてアプリが消えたことを検証します。まだ残っていればそのアプリは失敗として報告し、残りを続行します。

## 検証済みの範囲、正直に

設定ページは安定した API ではありません。レシピはマークアップのクラスではなくアクセシブルな名前とリンク構造を使い、ページネーションを辿り、すべてのレシピにはテストスイート内に一覧と取り消しを最後まで実行するローカルの模擬サイトがあります。そのうえで:

- **実アカウントでの監査** は GitHub、Google、Notion、Figma、Vercel、Slack について 2026-11-03 に実行し、取り消しボタンの位置も実際のページで確認しました。
- **ツールによる実際の取り消し** は Google で実施済みです（「Delete all」フロー、一覧の再読み込みで検証）。GitHub、Notion、Figma、Vercel の最終確認クリックは今のところ模擬サイトでのみ実行しています。それらでの最初の実取り消しは、`--revoke "<使い捨てアプリ 1 つ>"` と `--headed` で見守りながら行ってください。
- **Slack** は読み取り専用の一覧で、**Stripe** の行構造はアプリがインストールされたアカウントで実行するまで未検証です。
- ラベルはアカウントの UI 言語に従います。必要な箇所は英語と韓国語をカバーしており、他の言語は `src/providers/` の正規表現を拡張する必要があります。

フローごとの完全な状況は [docs/providers.md](docs/providers.md) にあります。サイトがページを変更したら、`openshears inspect <provider>` がレシピの手がかりになる要素を表示します。

## OpenClaw の削除

`openshears openclaw` は macOS と Linux/WSL のローカル OpenClaw インストールを検査して削除します。`--dry-run` または `--json` でプレビューし、`--keep-data` は状態とワークスペースを保持し、`--include-workspaces` は外部ワークスペースも削除します。削除は永久的で、状態ディレクトリには認証情報、セッション、メモリが含まれます。動作、境界、互換性は [docs/openclaw-compatibility.md](docs/openclaw-compatibility.md) に記載しています。

## 開発

```bash
git clone https://github.com/oswarld/openshears.git
cd openshears
npm ci
npm run build
npm test
npm run lint
node dist/index.js audit local
```

テストは一時ディレクトリ、モックのプロバイダー、各サービスの設定ページを模したローカル HTTP フィクスチャを使い、実際のアカウントにサインインしたり何かを取り消したりはしません。フィクスチャテストはヘッドレス Chrome がインストールされている場合に実行され、なければスキップされます。

## コントリビュート: 切りたいサービスを追加してください

あらゆる SaaS に「接続済みアプリ」ページがあり、そのための API はほぼありません。OpenShears は現在 GitHub、Google、Notion、Stripe、Figma、Vercel、Slack をカバーしています。**使っているサービスを追加してください。** Discord、Linear、Dropbox、Microsoft、Atlassian、Zoom、Hugging Face、X、LinkedIn、Shopify はいずれもそのページがあり、同じモデルに当てはまります。

プロバイダーは `src/providers/<service>.ts` の `WebRecipe` です。設定ページの URL、行の見つけ方（リンクのプレフィックスまたは行セレクター）、アクセシブルなロールとラベルで指定した取り消しクリック。サービス固有のコードは不要です。

1. 一度サインイン: `openshears login <service>`（または `baseUrl`、`loginPath`、`signedOutPaths` だけのレシピを先に追加）。
2. 接続済みアプリのページで `openshears inspect <service>` を実行。レシピの手がかりになる見出し・リンク・ボタン・繰り返しコンテナを読み取り専用で出力します。
3. `lists` と `revoke` を埋め、`openshears audit <service>` と、使い捨てアプリ 1 つに対する `openshears prune <service> --revoke "<name>"` で検証します。
4. ページ構造を模した小さなフィクスチャサイトを `tests/fixtures/` に追加し（GitHub、Google、Notion、Figma、Vercel のものを参照）、それに対して監査と取り消しを行うテストを追加します。
5. 検証日とロケール固有のラベルを [docs/providers.md](docs/providers.md) に記録します。

監査は読み取り専用に保ち、すべての取り消しを一覧の再読み込みで検証し、トークンやフォームの内容は決してログに残さないでください。新しいレシピのプルリクエストが、このプロジェクトにとって最も有用な貢献です。

## ライセンス

MIT。[LICENSE](LICENSE) を参照。
