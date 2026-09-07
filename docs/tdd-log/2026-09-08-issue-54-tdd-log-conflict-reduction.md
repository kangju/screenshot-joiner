### 2026-09-08 — Issue #54 docs/TDD_LOG.mdのマージコンフリクト対応

- Requirement: `docs/TDD_LOG.md`が常時インプレース更新される「Current
  status」節と、追記専用のはずが⚠️ Correction例外を持つ日付別エントリを
  同じファイルに同居させているために起きるマージコンフリクトを、無関係な
  変更同士が同じ行域を触らない構造へ変えること。issue本文で確定していた
  方針(Current statusの分離・新規エントリの1エントリ1ファイル化・
  既存ログの凍結)をそのまま採用し、issue作成後に本セッションのissue #53
  作業で`docs/TDD_LOG.md`へ52行追記されたことによる内部行番号のズレを
  実測し直した上で実行した
- Change: `docs/TDD_LOG_STATUS.md`を新規作成し、旧「Current status」節
  (Completed/Open residual risks/Last full-check result)を移設。
  「Completed」は要件ID/Issue番号ごとの独立した箇条書き項目に分割し、
  「Last full-check result」は検証対象のコミットSHA(`76a38ea`)と
  参照エントリを明記する形に変更。`docs/tdd-log/`ディレクトリと
  `docs/tdd-log/README.md`(命名規則・ファイル名衝突対策・通常サイクル/
  重大インシデントテンプレート・⚠️ Correctionのリンク先明確化規約・
  横断検索コマンド)を新規作成。`docs/TDD_LOG.md`の1〜143行目
  (旧冒頭説明・Current status・Entry template)を短いポインタ段落へ
  置き換え、144行目以降の70件の日付別エントリはバイト単位で無変更のまま
  凍結。`AGENTS.md`(`CLAUDE.md`はsymlinkのため自動反映)・
  `docs/TDD_WORKFLOW.md`(commanderの担当ファイル、直列化ルールの一般化、
  ログ粒度・mermaid図・今後のログ参照先の文言)・`README.md`・
  `.claude/skills/full-check/SKILL.md`のTDD_LOG.md参照を新方式に更新。
  実装計画自体は事前に`codex-review`スキルでCodex CLIに設計批評を依頼し、
  「分割方針は妥当」との結論の上でファイル名衝突対策の強化(書き込み前の
  パス予約、cross-branch衝突時はadd/addのファイル名衝突として両方
  残す)・直列化規則の一般化(同一ファイルへの書き込みのみ直列化)・
  「凍結」の定義の明文化・Correctionのリンク先明確化(日付だけでなく
  具体的なファイル名/見出しを明示)を反映した
- Verification: 移行前後で`docs/TDD_LOG.md`の144行目以降(既存70件の
  エントリ)を`sha256sum`でハッシュ比較し、完全一致を確認
  (`1c35bde6ca1008769502e807da1dd49673be2373ffae455dae1f021a99dbb29e`)。
  `agent-docs-lint`スキルで`AGENTS.md`/`CLAUDE.md`・
  `docs/TDD_WORKFLOW.md`・`README.md`・`.claude/skills/full-check/SKILL.md`
  間の相互参照の整合性を確認。`grep -rn "TDD_LOG" --include="*.md" .`で
  更新対象外ファイルに旧記述が残っていないことを確認。
  `rg -n "Issue #53" docs/TDD_LOG.md docs/tdd-log/`で凍結済みエントリと
  本エントリの両方がヒットすることを確認。ドキュメントのみの変更のため
  `full-check`(test/typecheck/lint/build)は必須要件ではないが
  (issue記載どおり)、参照整合性の確認は上記のとおり実施した
- Residual risk: 既存70件のエントリを`docs/tdd-log/`へ遡って移行する
  作業は意図的に見送り(issue記載どおり)。同一ファイル
  (`docs/TDD_LOG_STATUS.md`の同じ項目、または凍結ファイル内の同じ過去
  エントリへの⚠️ Correction)を複数ブランチが同時に編集した場合の
  コンフリクトはGitの通常の動作として引き続き起こりうる(意味のある
  衝突であり、今回解消したい「無関係な変更を巻き込む」種類の衝突とは別)
- Commit: (このコミット)
