### 2026-09-09 — 初期サイズモードがFR-06と不一致(Codex CLI批判的レビューで発見、docs/Question.mdの未確定事項をユーザー確認で解決)

- Requirement: FR-06「縦結合の初期値は幅揃え、横結合の初期値は高さ揃えとする」(`docs/REQUIREMENTS.md:66`)。
- Wrong assumption: `docs/Question.md`は、FR-06のこの一文が「アプリ初回起動時のデフォルト値」を指すのか「結合方向を切り替えるたびに追従する」を指すのか未確定として、暫定的にどちらも実装せず`sizeMode`の初期値を`"original"`のままにしていた。この暫定判断自体は妥当だったが、ユーザーへの確認が長らく未回答のまま残っていた。
- Change: Codex CLIによる批判的レビューでこの未実装状態がFR-06との乖離(Major相当)として指摘され(GitHub Issue #64)、ユーザーに解釈を確認した。結果、(a)「初回起動時のデフォルト値」の解釈(Option A)で確定: `createInitialEditorState`(`src/types/editor.ts`)の`sizeMode`初期値を、初期`direction`(`"vertical"`)に対応する`"fitWidth"`に変更した。結合方向の切り替え(`settings/direction`)への自動追従(b)は導入しない(ユーザーが直前に手動で選んだサイズモードを上書きしないため)。`docs/Question.md`の該当セクションをこの決定で更新し、FR-06の残り2つの未確定事項(基準サイズ、カスタムモードの軸)は今回のスコープ外として未確定のまま残した。
- Verification: `tests/unit/editor-state.test.ts`の初期状態テストを更新(GREEN確認済み)。`tests/unit/page.test.tsx`側で、旧デフォルト(`"original"`)を前提にしていた7件のテストを、新デフォルト(`"fitWidth"`)を前提にする形へ更新(うち2件は「元のサイズ」を明示的に選択してから検証する形に修正し、原寸モード自体の回帰カバレッジは維持)。`full-check`(test 253件/typecheck/lint/build)全てgreen。実機確認(`browser-check`、Playwright MCP)で、画像追加直後に何もクリックせず幅揃えの出力サイズが正しく表示されること、方向切替後もサイズモードの選択が保持されること(Option A)、コンソールエラー0件を確認した。
- Residual risk: FR-06の残り2つの未確定事項(`docs/Question.md`)は引き続き未解決。`docs/TDD_LOG_STATUS.md`の該当箇所を、3件のうち1件が解決した状態に更新済み。
