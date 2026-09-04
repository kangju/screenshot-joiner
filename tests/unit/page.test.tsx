import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("project scaffold", () => {
  it("states that images are processed on the device", () => {
    render(<Home />);

    expect(
      screen.getByText("画像は端末内だけで処理されます。"),
    ).toBeInTheDocument();
  });
});

