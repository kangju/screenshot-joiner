# Screenshot Joiner — Codex TDD Starter

業務スクリーンショットを端末内だけで結合する、Next.js Static ExportプロジェクトのCodex用スターターです。

## このZIPに含まれるもの

- 完全なプロダクト要件とアーキテクチャ
- Codexが自動で読む`AGENTS.md`
- UT作成・製造・レビューの3つのカスタムエージェント
- RED → GREEN → REVIEWを直列で回すTDDループ
- Next.js、TypeScript、Jest、React Testing Libraryの最小スキャフォールド

## 開始方法

```bash
npm install
npm test
npm run dev
```

別ターミナルまたはCodexアプリで、このディレクトリをプロジェクトとして開きます。

```bash
codex
```

最初の指示は`prompts/START.md`をそのまま使用してください。

## 重要事項

- 画像とZIPをサーバーへ送信しません。
- API Routes、Server Actions、SSR、DB、外部ストレージを使用しません。
- 機能単位で必ずテストを先に作り、失敗を確認してから製造します。
- 3エージェントは同時にコードを書かず、順番に実行します。

