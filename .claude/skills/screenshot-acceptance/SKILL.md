---
name: screenshot-acceptance
description: Pick the acceptance-verification scenarios and observation points for a screenshot-joiner change that touches UI, image processing, or limits/async handling. Use during planning, before test_writer starts. Not for documentation-only changes.
---

# 受け入れ検証シナリオの選定

UI・画像処理・制限や非同期処理に触れる変更を計画する際、必要な受け入れ検証と観測点を選ぶ。文書だけの変更には適用しない。

## UI変更

320px幅とデスクトップ幅の両方の対象状態を確認する。加えて、初期フォーカス位置からTab/Shift+Tabを実際に操作し、キーボードだけで到達・操作できることを確認する(見た目の確認だけで済ませない)。

## 画像処理変更

既知の寸法を持つ合成データ(色分けした画像など)を使い、実際の描画結果(寸法・ピクセル)をサンプリングして確認する。モックの戻り値がそのまま伝播しただけを「実ライブラリ・処理全体の挙動を確認した」としない。

## 制限・非同期処理変更

上限を超えた入力が、重い確保(canvas確保やWorker起動)の前に拒否されること、実行中の処理が実際に停止すること(Worker終了等)、確保済みリソースが実際に解放されること(`bitmap.close()`、`URL.revokeObjectURL()`等)を確認する。

## 共通のルール

- サードパーティUIライブラリや未知の外部データ形式が絡む場合は、先に`integration-spike`で実挙動を確認してから選定する。
- 実行できない検証は「未実施」と理由を明記する。モックだけで実ライブラリ・処理全体の挙動を確認したことにしない。
- 選んだシナリオと観測点は`test_writer`/`implementer`/`reviewer`への引き継ぎに含める。
