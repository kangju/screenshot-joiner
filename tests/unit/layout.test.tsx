import { render, screen } from "@testing-library/react";
import RootLayout from "@/app/layout";

// RootLayoutは<html>/<body>を返すため、そのままrender()すると既存のdocument.body配下に
// 二重にhtml/bodyがネストされる。テストではchildrenがFooterと一緒に描画されることだけを
// 確認したいので、返り値のうちbodyの中身を直接確認する
describe("RootLayout", () => {
  it("renders the footer alongside the page content on every route", () => {
    const { container } = render(
      <RootLayout>
        <p>page content</p>
      </RootLayout>,
    );

    expect(container).toHaveTextContent("page content");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /利用規約・プライバシー/ })).toBeInTheDocument();
  });
});
