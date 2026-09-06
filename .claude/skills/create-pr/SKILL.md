---
name: create-pr
description: Push the current branch and open (or update) a GitHub pull request for screenshot-joiner, with the title and body written in Japanese. Use whenever the user asks to push and open/create a PR, submit a PR, or update an existing one ("プッシュしてPR作って" etc).
---

# PR作成 (screenshot-joiner)

このプロジェクトのPRは**タイトル・本文ともに日本語**で書く。コミット
メッセージやコード識別子の英語ルール(AGENTS.md参照)はPR本文には適用
しない。

## 手順

1. **作業ツリーを確認する。** `git status` でクリーンであること。未コミット
   の変更があれば、先にユーザーに確認するかコミットする(無断でコミット
   しない)。

2. **ローカルの`main`を最新化する。**
   ```bash
   git fetch origin --prune
   git log --oneline origin/main -1
   git log --oneline main -1
   ```
   ローカル`main`が`origin/main`より遅れていたら、必ず追従してから次に
   進む:
   ```bash
   git checkout main && git pull origin main && git checkout -
   ```
   **これを飛ばすと事故る。** 実際にあった事故: ローカル`main`が直前の
   PRのマージ前のまま残っていたため、新しいブランチとの差分を取ったら
   既にマージ済みの34ファイルが紛れ込んだ。`git diff main..HEAD --stat`
   は必ずこのステップの後に確認する。

3. **`full-check`スキルを実行する。** test/typecheck/lint/buildが全て
   greenであることを確認してからPRを開く(CLAUDE.mdの「Done」基準)。
   赤い状態でPRを出さない。

4. **このブランチだけの差分を確認する。** `git diff main..HEAD --stat`
   で、意図した変更だけが含まれているか(無関係なファイルが混ざって
   いないか)を目視する。

5. **push する。**
   ```bash
   git push -u origin <branch>   # 初回
   git push                       # 2回目以降
   ```
   force pushやmainへの直接pushは、既存のgit safety protocol通りユーザー
   の明示的な指示がない限り行わない。

6. **`gh pr create`でPRを作成する。** 既に同じブランチでPRが存在し
   マージ/クローズ済みの場合(`gh pr view <番号> --json state`で確認)は
   新しいPRになる。タイトルは70文字目安、詳細は本文に書く。

## PR本文テンプレート(日本語)

```markdown
## 概要
- <変更点を箇条書きで。「何を」より「なぜ」を中心に>
- <複数コミットにまたがる場合は、まとめて要約する>

## テスト
- [x] `npm test -- --runInBand` (n件)
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run build`
- [x] <実ブラウザ確認・Codexレビューなど行った場合のみ追記>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- Codexレビュー(`codex-review`スキル)を経ている場合は、「## Codexレビュー
  での指摘」のような見出しを追加し、指摘内容・スコアの変化・対応を要約
  する(撤回された指摘があれば、それも明記する)。
  コミットメッセージ末尾の`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
  はコミット側の話であり、PR本文には含めない。PR本文側の帰属表記は
  上記テンプレートの`🤖 Generated with [Claude Code](https://claude.com/claude-code)`
  のみでよい。

## gh pr create の書き方

本文は必ずHEREDOCで渡す(改行・日本語が壊れないように):

```bash
gh pr create --title "<日本語タイトル>" --body "$(cat <<'EOF'
<上記テンプレートで書いた本文>
EOF
)"
```

## 完了後の報告

PRのURLをユーザーに伝える。プッシュ・PR作成は「共有状態に影響する操作」
なので、実行前にユーザーの指示が実際に「push して PR を出す」ことを
求めているか(単なる確認依頼ではないか)を都度確認する。
