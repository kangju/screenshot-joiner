### 2026-09-09 — ZIP処理中の「すべて削除」で画像が後から再出現する(Codex CLI批判的レビューで発見)

- Wrong assumption: `handleClear`(`src/app/page.tsx`)は現在の`state.items`を
  空にすれば「一覧を空にする」という操作として完結すると仮定していた。実際
  には、ZIP展開・デコード中の非同期処理(`handleAddZip`のWorkerキュー、
  `addImages`のコミット順序待ち)は`handleClear`と一切連動しておらず、進行
  中の処理がクリア後に決着すると、その結果がそのまま一覧へ追加されてし
  まっていた。
- Minimal repro: 画像を1枚追加→大きめのZIP(展開に時間がかかるもの)を
  選択→展開処理中に「すべて削除」を押す。一覧は一旦空になるが、数秒後に
  ZIP由来の画像が再出現する。専用の「キャンセル」ボタンでは正しく停止でき
  る(この経路は別)。
- Root cause: `handleClear`が進行中のZIP展開(`zipCancelRef.current`)を一切
  キャンセルせず、`addImages`(ファイル/貼り付け/ZIP共通のコミット経路)も
  クリア後にコミットされた結果を弾く仕組みを持っていなかったこと。
- Permanent fix: `clearGenerationRef`(世代カウンタ)を新設し、`handleClear`
  で加算。`addImages`は呼び出し開始時点(最初のawait前)で世代を捕まえ、
  コミット直前(`mountedRef`の既存チェックと同じ箇所)に世代がずれていない
  かを確認し、ずれていれば決着済みのbitmapをcloseして何もコミットしない。
  `handleAddZip`もZIPキュー登録時点で世代を捕まえ、Worker起動前・
  `arrayBuffer()`読込後・展開完了後の各チェックポイントで同様に判定する。
  `handleClear`は`zipCancelRef.current?.()`も呼び、専用キャンセルと同じ経路
  で実行中のWorkerも実際に停止させる(世代だけでは既に投げた
  postMessageの処理自体は止まらないため)。
- Regression test: `tests/unit/page.test.tsx`に3ケース追加。(1) Worker展開中
  にクリア→キャンセル経由で結果が解決しても画像が追加されない、(2)
  ZIP展開完了後・`addImages`内のデコード中にクリア→デコード完了後も
  追加されず、決着したbitmapがcloseされる、(3) 2件目のZIPがキューで待機中
  にクリア→1件目の処理完了後も2件目のWorker(`extractZipFile`)が実際には
  起動されない。3ケースとも、実装前に一時的に修正を外して意図した理由で
  RED(前者2件は「すべて削除」ボタンが一覧空時に無効化される仕様を見落と
  し、既存画像を1枚先に追加するテスト側の修正も要した)であることを確認
  済み。実機確認(`browser-check`、Playwright MCP)は、30枚のZIPで正常な
  追加・クリア・専用キャンセルには問題ないことを確認したが、自動操作の
  往復遅延により実際の競合ウィンドウを確実に狙うことはできず、競合条件
  そのものの再現・検証はユニットテスト(deferred Promiseで各非同期段階を
  制御)側でのみ確定的に行った。
