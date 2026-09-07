import { render, screen } from "@testing-library/react";
import { Footer } from "@/components/layout/Footer";

describe("Footer", () => {
  it("links to the terms page in a new tab with an accessible new-tab hint", () => {
    render(<Footer />);

    const termsLink = screen.getByRole("link", { name: /利用規約・プライバシー/ });
    expect(termsLink).toHaveAttribute("href", "/terms/");
    expect(termsLink).toHaveAttribute("target", "_blank");
    expect(termsLink).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(termsLink).toHaveAccessibleName(/別タブで開きます/);
  });

  it("links to the GitHub source repository in a new tab", () => {
    render(<Footer />);

    const sourceLink = screen.getByRole("link", { name: /ソースコード/ });
    expect(sourceLink).toHaveAttribute("href", "https://github.com/kangju/screenshot-joiner");
    expect(sourceLink).toHaveAttribute("target", "_blank");
    expect(sourceLink).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(sourceLink).toHaveAccessibleName(/別タブで開きます/);
  });

  it("shows a copyright line without attributing a specific individual", () => {
    render(<Footer />);

    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`©\\s*${year}\\s*Screenshot Joiner`))).toBeInTheDocument();
  });

  it("renders as a footer landmark with 44px-minimum touch targets for its links", () => {
    render(<Footer />);

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    for (const link of screen.getAllByRole("link")) {
      // jsdomはCSSの実レイアウトを計算しないため、44px相当のクラス(min-height: var(--target-min))が
      // 付与されていることをクラス存在ベースで確認する(実際の描画確認はbrowser-checkで行う)
      expect(link).toHaveClass("footerLink");
    }
  });
});
