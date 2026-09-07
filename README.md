# Screenshot Joiner

業務上のスクリーンショットを複数読み込み、順番と見た目を調整して1枚の画像へ結合し、クリップボードへコピーまたは端末へ保存するWebツールです。スクリーンショットを保存・変換する手間をかけずに、貼り付けて並べてすぐJira、Backlog、GitHub、Slack、Teamsなどの業務ツールへ転記できることを目指しています。

サーバーへ画像やZIPを送信することは一切なく、すべての処理はブラウザ内で完結します(Next.jsの`output: "export"`による静的サイトです)。

## 主な機能

- **画像入力**: PNG/JPEG/WebPの複数選択、ドラッグ＆ドロップ、クリップボード貼り付け(`Ctrl+V`/`Cmd+V`)
- **ZIP入力**: 非暗号化ZIPをブラウザ内のWeb Workerで展開し、画像ファイルだけを自然順で取り込み
- **並べ替え**: ドラッグハンドルまたはキーボードで画像順を変更、結合プレビューへ即時反映
- **トリミング・回転**: 画像ごとに自由比率のトリミングと90度単位の回転
- **リサイズ**: 原寸/幅揃え/高さ揃え/指定サイズから選択、縦横比は維持
- **結合設定**: 縦結合/横結合、画像間隔、背景色を指定
- **書き出し**: 結合結果をPNGとしてクリップボードへコピー、またはPNG/JPEGとしてダウンロード(JPEGは品質指定可)

詳細な仕様は[docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)を参照してください。

## 開発コマンド

```bash
npm install       # 依存関係のインストール
npm run dev       # 開発サーバー起動
npm test          # テスト実行(Jest)
npm run typecheck # 型チェック
npm run lint      # Lint
npm run build     # 静的サイトのビルド
```

## 設計方針

- 画像・ZIP・ファイル名はブラウザメモリ内のみで扱い、サーバー・DB・外部ストレージ・分析ツールへは一切送信しません。
- API Routes、Server Actions、SSRは使用しません。

## ドキュメント

- [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) — プロダクト要件
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 設計
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — 実装フェーズ・順序
- [docs/ACCEPTANCE_CRITERIA.md](docs/ACCEPTANCE_CRITERIA.md) — 受け入れ基準
- [docs/TDD_WORKFLOW.md](docs/TDD_WORKFLOW.md) — TDD運用プロトコル
- [docs/TDD_LOG.md](docs/TDD_LOG.md) — 開発ログ
