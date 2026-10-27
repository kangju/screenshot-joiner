### 2026-09-14 — 暗号化ZIPのフラグ検出が不十分(Codex CLI批判的レビューで発見、integration-spike実施)

- Requirement: FR-02「多重ZIPとパスワード付きZIPは展開せず、理由を表示する」
  (`docs/REQUIREMENTS.md:33`)。
- Wrong assumption: `fflate`(`unzipSync`)は読み込み側でZIPの汎用目的ビット
  フラグ(暗号化フラグ)を公開しておらず、暗号化・破損・非対応形式は個別に
  事前検出せず一律で展開失敗に委ねる方針を暫定採用していた(`docs/Question.md`
  P4-04)。これにより、暗号化フラグのみを立てたが実データは平文のままのZIPが
  1件の画像として取り込まれてしまい(Codex CLIの批判的レビューで発見、
  GitHub Issue #65)、実際のパスワード付きZIPも汎用的な「展開できません
  でした」にしかならなかった。
- Change: ユーザーに`docs/Question.md`P4-04の未確定事項を確認し、
  「セントラルディレクトリを自前パースして暗号化フラグを検出する」方針
  (推奨案)を選択した。実装前にCodex CLIのPlan/design consultationを実施し、
  当初案の設計欠陥(名前ベースのMap結合によるUTF-8/Latin-1デコード不一致、
  緩い境界検証、ZIP64を「サイズ上限があるので対象外」と誤って判断)が
  複数指摘され、反映した。新規`src/lib/zip-central-directory.ts`の
  `inspectZipEncryption`が、名前を一切使わないアーカイブ単位の集約結果
  (`{ok, hasEncryptedEntry}` / `{ok:false, reason:"malformed"}`)を返す。
  `fflate`の成否には依存しない(fail-closed): integration-spikeで、`fflate`
  自身は壊れたセントラルディレクトリでも例外を投げずに展開へ成功することを
  実測で確認したため。セントラルディレクトリ・ローカルヘッダー双方の
  フラグを突き合わせ、不一致は構造異常として拒否する。ZIP64は専用検出
  コードを持たず、境界検証の厳格さ(センチネル値0xFFFFFFFFがバッファ範囲外
  になる)で自然に拒否される設計とした。`src/workers/zip.worker.ts`は、
  圧縮サイズ上限チェックの直後・`fflate`のスキャンパスより前にこの検査を
  行い、`ZipExtractFailureReason`に新設の`"encrypted"`を追加、
  `src/app/page.tsx`の`ZIP_FAILURE_MESSAGE`に専用メッセージ
  (「パスワード保護されたZIPです」)を追加した。`docs/Question.md`P4-04は
  暗号化フラグ検出について解決済みに更新(CRC-32による破損検証は別懸念と
  して引き続き未実装のまま残した)。
- Verification: `tests/unit/zip-central-directory.test.ts`(新規、11ケース:
  通常ZIP・空ZIP・暗号化検出・非ASCII名・コメント付きZIP・CD/ローカル
  ヘッダー不一致・CD署名破損・非ZIPデータ・ZIP64センチネル・宣言件数超過・
  検査後もfflateで正常に展開できること)、`tests/unit/zip-worker.test.ts`
  (5ケース追加: 暗号化ZIPの拒否とstages未到達、暗号化+入れ子、暗号化+
  件数超過、暗号化された非画像ファイル、誤検知しないこと)、
  `tests/unit/page.test.tsx`(1ケース追加: 新メッセージの表示)。実装前に
  一時的に修正を戻し、意図した理由でREDになることを確認済み(RED→GREEN
  のサイクルを踏んだ)。`full-check`(test 270件/typecheck/lint/build)
  全てgreen。実機確認(`browser-check`、Playwright MCP)で、実際のZIP CLI
  で作成した本物のパスワード付きZIP(`zip -P`)と、Codexが発見した元の
  事例そのもの(フラグのみ設定・データは平文の合成ZIP)の両方が新しい
  メッセージで正しく拒否されること、通常ZIPは引き続き正常に取り込める
  こと、320px幅・コンソールエラー0件を確認した。加えて、`fflate`製
  ZIPだけでなく実際の`zip`CLI(複数ファイル+サブディレクトリ)で作成した
  通常ZIPでも自前パーサーが問題なく通過することを確認した(スコープ外だが
  互換性リスクを下げるための追加確認)。
- Residual risk: CRC-32による破損検証は引き続き未実装・未確認
  (`docs/Question.md`P4-04、`docs/TDD_LOG_STATUS.md`のOpen residual risks
  参照)。自前パーサーはfflateより厳格な構造検証を行うため、ごく稀に
  fflateなら展開できたはずの非標準構造のZIPを`malformed`として拒否する
  可能性が理論上残る(意図的な安全側への倒し方。`integration-spike`と
  今回の追加確認で実運用上の主要なケースでは問題ないことを確認済み)。
