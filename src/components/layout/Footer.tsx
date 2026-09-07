import { Code2, ScrollText } from "lucide-react";

import styles from "./Footer.module.css";

const REPOSITORY_URL = "https://github.com/kangju/screenshot-joiner";

// 別タブで開くリンクである旨をスクリーンリーダー利用者にも伝えるための補足文。
// 同一タブで/terms/へ遷移するとpage.tsxのin-memory編集状態が失われるため、
// 規約リンク・ソースコードリンクはどちらもtarget="_blank"にしている。
const NEW_TAB_HINT = "(別タブで開きます)";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.links}>
        <a
          href="/terms/"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.footerLink}
        >
          <ScrollText size={16} aria-hidden="true" />
          利用規約・プライバシー
          <span className="visually-hidden">{NEW_TAB_HINT}</span>
        </a>
        <a
          href={REPOSITORY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.footerLink}
        >
          <Code2 size={16} aria-hidden="true" />
          ソースコード(GitHub)
          <span className="visually-hidden">{NEW_TAB_HINT}</span>
        </a>
      </div>
      <p className={styles.copyright}>© {new Date().getFullYear()} Screenshot Joiner</p>
    </footer>
  );
}
