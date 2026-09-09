### 2026-09-09 — 極端なアスペクト比の画像でクロップ枠が0幅になり操作不能(Codex CLI批判的レビューで発見、integration-spike実施)

- Wrong assumption: `CropDialog.tsx`は、wrapper(cropperjsのコンテナ)の縦横を
  常に単一の共有倍率(`displayScale`)で比例縮小すれば、画像を歪ませずに
  ダイアログへ収められると仮定していた。極端なアスペクト比(例: 幅1px×
  高さ10000px)では、共有倍率のまま丸めると短辺がMath.roundで0pxになり、
  クリック・ドラッグ操作もキーボード数値入力による座標変換も破綻する。
- Minimal repro: 1×10000pxの画像を追加し、トリミングを開く。cropper-canvas
  の実測幅が0になり、幅の数値入力欄も常に0を表示する(操作しても変化しない)。
- Root cause: `wrapper.style.width = Math.round(item.bitmap.width * intendedScale)`
  で、共有の`intendedScale`が極小(例: 0.0384)になると幅が0に丸まる。
- integration-spike実測結果(`~/.claude/skills/integration-spike`、実ブラウザ・
  実cropperjs 2.2.0で確認): (1) wrapperのCSS幅を後から(cropperjs初期化後に)
  変更しても、内部の`<cropper-image>`要素は初期化時点のサイズのまま追従せず
  0のままになる。正しいサイズは初期化前の1回の計算で確定させる必要がある。
  (2) 該当する軸だけ独立した最小フロア倍率(`MIN_WRAPPER_DIMENSION=24px`)に
  切り替えれば、`cropper-canvas`・`cropper-selection`(操作可能な選択範囲)は
  正しいサイズ・座標で機能する。ただし`<cropper-image>`自体(実際の画素表示)
  はcropperjs内部で元画像の縦横比を保ったまま描画されるため、フロアを
  適用した軸の画素プレビューは実質見えないままになる(1px幅の画像が
  持つ「見た目の情報」自体が元々存在しないため、実用上の支障は小さいと
  判断した)。詳細: `docs/ARCHITECTURE.md`の「Design rules」に1〜2行で記録。
- Permanent fix: `displayScaleRef`を単一の数値から`{x, y}`(軸ごとの倍率)に
  変更。通常は両軸で同じ`commonScale`を使い無歪みのまま、`Math.round(bitmap
  の該当辺 * commonScale) < MIN_WRAPPER_DIMENSION`の軸だけ、その軸単独で
  `MIN_WRAPPER_DIMENSION`を満たす倍率に切り替える。表示座標↔元画像座標の
  全変換箇所(初期selection設定、change イベント購読、数値入力の反映)を
  軸ごとの倍率を使うよう修正。`MIN_WRAPPER_DIMENSION=24px`は、44×44pxの
  タッチターゲット基準(FR-09)ではなく、稀な縮退ケースでの最小限の操作
  可能性を優先した意図的な妥協値(44pxにすると、より広いアスペクト比の
  画像でも視覚的な歪みが大きくなるトレードオフがある)。
- Regression test: `tests/unit/crop-dialog.test.tsx`に3ケース追加(極端に
  細い画像でのwrapperサイズのフロア、既存cropメタデータの軸別変換、
  極端に幅広い画像でのキーボード入力の往復変換)。実装前に一時的に修正を
  戻し、3ケースとも「0px/0pxに丸まる」という意図した理由でREDになる
  ことを確認済み。既存21ケースは無変更(通常のアスペクト比では
  scaleX===scaleY===commonScaleとなり、挙動は変わらない)。実機確認
  (Playwright MCP)で、1×10000pxと10000×1pxの両方について、実際に
  キーボードで幅・高さ・位置を入力→適用→一覧の寸法表示が意図どおりに
  更新されることを確認した(コンソールエラー0件)。
