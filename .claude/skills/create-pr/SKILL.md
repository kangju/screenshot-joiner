---
name: create-pr
description: Push the current branch and open (or update) a GitHub pull request for screenshot-joiner, with the title and body written in Japanese. Use whenever the user asks to push and open/create a PR, submit a PR, or update an existing one ("プッシュしてPR作って" etc).
---

# PR作成 (screenshot-joiner)

このプロジェクトのPRは**タイトル・本文ともに日本語**で書く(コミット
メッセージも同様に日本語 — AGENTS.md参照)。コード識別子を英語のままに
する規則(同じくAGENTS.md参照)はコードそのものの話であり、PR本文の
地の文には関係しない。

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
   進む(ローカル`main`に分岐したコミットが残っていてマージコミットが
   作られないよう、fast-forwardのみに限定する):
   ```bash
   git checkout main && git pull --ff-only origin main && git checkout -
   ```
   fast-forwardできない場合(ローカル`main`が独自に進んでいる場合)は、
   自動でマージせずユーザーに確認する。
   **これを飛ばすと事故る**(古いローカル`main`との差分に既マージ分の
   ファイルが紛れ込んだ実例あり)。`git diff "$(git merge-base main HEAD)"..HEAD --stat`は必ず
   このステップの後に確認する。

3. **`full-check`スキルを実行する。** test/typecheck/lint/buildが全て
   greenであることを確認してからPRを開く(CLAUDE.mdの「Done」基準)。
   赤い状態でPRを出さない。

4. **このブランチだけの差分を確認する。** `git diff "$(git merge-base main HEAD)"..HEAD --stat`
   で、意図した変更だけが含まれているか(無関係なファイルが混ざって
   いないか)を目視する。

5. **push する。**
   ```bash
   git push -u origin <branch>   # 初回
   git push                       # 2回目以降
   ```
   force pushやmainへの直接pushは、共有履歴を書き換えたり他者の作業を
   壊しうる操作であるため、ユーザーの明示的な指示がない限り行わない。

6. **`gh pr create`でPRを作成する。** まず`gh pr view`(引数なし。現在
   チェックアウトしているブランチに紐づくPRを見る)でPRの有無・状態を
   確認する。存在しない、またはマージ/クローズ済みの場合のみ新しいPRを
   作成する。タイトルは70文字目安、詳細は本文に書く。

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
  する(撤回された指摘があれば明記)。
- 帰属表記はPR本文側では上記テンプレートの`🤖 Generated with [Claude Code]`
  行のみ(コミット側の`Co-Authored-By:`はPR本文に含めない)。

## gh pr create の書き方

本文は一時ファイルに書き出してから`--body-file`で渡す(長い日本語本文を
インラインHEREDOCで`--body`に渡すより、引用・改行の壊れる余地が少ない)。
固定パスだと既存ファイルの上書きや消し忘れが起きるため、`mktemp`で都度
作成し、使い終わったら削除する:

```bash
pr_body="$(mktemp)"
cat > "$pr_body" <<'EOF'
<上記テンプレートで書いた本文>
EOF
gh pr create --title "<日本語タイトル>" --body-file "$pr_body"
rm -f "$pr_body"
```

## 完了後の報告

PRのURLをユーザーに伝える。プッシュ・PR作成は「共有状態に影響する操作」
なので、実行前にユーザーの指示が実際に「push して PR を出す」ことを
求めているか(単なる確認依頼ではないか)を都度確認する。
