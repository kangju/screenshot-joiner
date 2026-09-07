import { render, screen } from "@testing-library/react";
import TermsPage from "@/app/terms/page";

describe("TermsPage", () => {
  it("shows every required section heading", () => {
    render(<TermsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "利用規約・プライバシー" })).toBeInTheDocument();

    const expectedHeadings = [
      "サービスの説明",
      "免責事項",
      "プライバシー",
      "禁止事項",
      "知的財産権",
      "提供の変更・停止・終了",
      "規約の変更",
      "準拠法・連絡先",
    ];
    for (const heading of expectedHeadings) {
      expect(screen.getByRole("heading", { level: 2, name: heading })).toBeInTheDocument();
    }
  });

  it("explains input images are not transmitted or persisted, distinct from Cloudflare's delivery-level network handling", () => {
    render(<TermsPage />);

    expect(screen.getByText(/送信しません/)).toBeInTheDocument();
    expect(screen.getByText(/永続化しません/)).toBeInTheDocument();
    expect(screen.getByText(/Cloudflare/)).toBeInTheDocument();
  });

  it("does not attribute the service to a named individual operator", () => {
    render(<TermsPage />);

    expect(screen.getByText(/個人開発者/)).toBeInTheDocument();
  });

  it("directs contact to GitHub Issues only, with a note that posts are public", () => {
    render(<TermsPage />);

    expect(screen.getByRole("link", { name: /GitHub Issues/ })).toHaveAttribute(
      "href",
      "https://github.com/kangju/screenshot-joiner/issues",
    );
    expect(screen.getByText(/公開されます/)).toBeInTheDocument();
  });
});
