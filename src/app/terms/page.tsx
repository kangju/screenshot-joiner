import type { Metadata } from "next";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "利用規約・プライバシー | Screenshot Joiner",
  description: "Screenshot Joinerの利用規約とプライバシーについての説明",
};

const LAST_REVISED_DATE = "2026年9月7日";
const ISSUES_URL = "https://github.com/kangju/screenshot-joiner/issues";

export default function TermsPage() {
  return (
    <main>
      <h1 className={styles.title}>利用規約・プライバシー</h1>
      <p className={styles.lead}>
        本ページは、Screenshot Joiner(以下「本サービス」)の利用条件とプライバシーの取り扱いを定めます。本サービスは個人開発者が無償で提供する、利用者登録不要のWebツールです。
      </p>

      <section className={styles.section}>
        <h2 className={styles.heading}>サービスの説明</h2>
        <p>
          本サービスは、複数のスクリーンショット画像を1枚に結合するためのWebツールです。画像・ZIPファイルの読み込み、並べ替え、トリミング、回転、リサイズ、結合、書き出しの各処理は、すべてお使いのブラウザ内で完結し、外部のサーバーへ送信されません。
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>免責事項</h2>
        <p>
          本サービスは現状有姿(as is)で提供され、動作の完全性、正確性、特定目的への適合性、継続的な提供を保証しません。本サービスの利用により生じた損害について、運営者は法令上免除が認められる範囲で責任を負いません。ただし、法令により運営者の責任を免除できないとされる事項については、この限りではありません。
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>プライバシー</h2>
        <ul className={styles.list}>
          <li>入力した画像・ZIPファイル・ファイル名・結合結果は、運営者のサーバーへ送信しません。処理はすべてお使いのブラウザ内で完結します。</li>
          <li>入力した画像・ZIPファイル・結合結果は、運営者側で保存・永続化しません。</li>
          <li>編集内容(画像の並び順、トリミング、回転などの設定)はブラウザのタブを閉じる、またはページを再読み込みすると失われます。自動保存機能はないため、必要な結果は都度ダウンロードまたはコピーしてください。</li>
          <li>本サービスは配信基盤としてCloudflareを利用しています。Cloudflareは本サービスの配信のため、アクセス元のIPアドレスなどの通信情報を扱う場合があります。これは運営者による画像データの取り扱いとは別の、配信基盤の一般的な動作です。</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>禁止事項</h2>
        <p>利用者は、本サービスを次の目的で利用してはなりません。</p>
        <ul className={styles.list}>
          <li>法令または公序良俗に違反する目的</li>
          <li>第三者の権利(著作権、プライバシー等)を侵害する目的</li>
          <li>本サービスの運営を妨げる目的(過度な負荷をかける行為等)</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>知的財産権</h2>
        <p>
          本サービスのソースコードに関する権利は運営者(または各コードの権利者)に帰属します。一方、利用者が本サービスに読み込ませた画像、および結合して作成した画像について、運営者は何らの権利も取得しません。元画像に関する第三者の権利(著作権等)は、本サービスの利用によって変動しません。
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>提供の変更・停止・終了</h2>
        <p>
          運営者は、利用者への事前の個別通知なく、本サービスの内容を変更し、または提供を停止・終了することがあります。これによって利用者に生じた損害についても、前項までの免責事項の範囲で運営者は責任を負いません。
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>規約の変更</h2>
        <p>
          本規約の内容は変更されることがあります。変更する場合は、変更後の内容と適用開始日を本ページに掲載します。
        </p>
        <p className={styles.revisedDate}>最終改定日: {LAST_REVISED_DATE}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>準拠法・連絡先</h2>
        <p>本規約の解釈には日本法を準拠法とします。</p>
        <p>
          本サービスに関するお問い合わせは、
          <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
            GitHub Issues
          </a>
          のみで受け付けます。投稿内容は公開されます。機密情報や個人情報、非公開にしたい画像等を含めないでください。
        </p>
      </section>
    </main>
  );
}
