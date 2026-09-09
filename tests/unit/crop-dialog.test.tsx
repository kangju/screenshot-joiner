import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CropDialog } from "@/components/image-editor/CropDialog";
import type { ImageItem } from "@/types/editor";

// cropperjsは実際のポインタージオメトリ(getBoundingClientRect等)に依存しており、
// jsdomでは正しく動作しない。P2のdnd-kitモックと同じ前例に倣い、選択範囲の
// x/y/width/heightだけを持つ最小限のフェイクに差し替えて、CropDialog自身の
// 開く・決定・キャンセル・リセット・座標変換の配線だけを検証する(実際の
// ドラッグ操作は別途headless Chromeでのブラウザ確認で検証する)。
//
// bitmapを1200x800(長辺1200)にしているのは、CropDialogが表示用に長辺480に
// 収まるよう縮小して表示するため(scale=480/1200=0.4)。この縮小率を通した
// 座標変換(表示座標<->元画像のピクセル座標)が正しいことを検証するには、
// scaleが1にならない(=縮小が実際に発生する)サイズが必要。
// 実際のCropperSelectionはEventTargetを継承しており、ドラッグ・キーボード
// 操作のたびに"change"イベントを発火する。CropDialogはこのイベントを購読して
// 数値入力欄を同期するため、モックも実際にイベントを発火できる必要がある。
//
// 重要: 実際のcropperjs(cropper.esm.jsのCropperSelection.$change実装)は、
// 新しい値をevent.detailに入れて"change"を発火した「後」でx/y/width/height
// プロパティを更新する(プロパティ更新が先ではない)。この順序を誤って
// テストすると、CropDialog側の実装ミス(プロパティを直接読んでしまう古い
// 実装)を検出できない偽陽性テストになるため、$changeと同じ順序を再現する。
class FakeCropperSelection extends EventTarget {
  x = 20;
  y = 40;
  width = 80;
  height = 120;
  keyboard = false;
}

const selectionState = new FakeCropperSelection();

// cropperjsの実際のドラッグ・キーボード操作をシミュレートする: 新しい値を
// detailに持つ"change"イベントを先に発火し、その後でプロパティを更新する
// (実際のCropperSelection.$changeと同じ順序)
const simulateSelectionChange = (patch: Partial<Pick<FakeCropperSelection, "x" | "y" | "width" | "height">>) => {
  act(() => {
    const detail = {
      x: patch.x ?? selectionState.x,
      y: patch.y ?? selectionState.y,
      width: patch.width ?? selectionState.width,
      height: patch.height ?? selectionState.height,
    };
    selectionState.dispatchEvent(new CustomEvent("change", { detail }));
    Object.assign(selectionState, patch);
  });
};
const imageState = {
  scalable: true,
  translatable: true,
  rotatable: true,
  skewable: true,
};
const cropperCanvasElement = { style: {} as CSSStyleDeclaration };
let lastCropperInstance: { destroy: jest.Mock } | null = null;

const waitForCropperReady = () => waitFor(() => expect(lastCropperInstance).not.toBeNull());

jest.mock("cropperjs", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      const instance = {
        getCropperSelection: () => selectionState,
        getCropperImage: () => imageState,
        getCropperCanvas: () => cropperCanvasElement,
        destroy: jest.fn(),
      };
      lastCropperInstance = instance;
      return instance;
    }),
  };
});

const makeItem = (crop: ImageItem["crop"] = null): ImageItem => ({
  id: "first",
  name: "first.png",
  source: "file",
  blob: new Blob(["first"], { type: "image/png" }),
  bitmap: { width: 1200, height: 800, close: jest.fn() } as unknown as ImageBitmap,
  originalWidth: 1200,
  originalHeight: 800,
  crop,
  rotation: 0,
  targetWidth: null,
});

const makeExtremeItem = (
  width: number,
  height: number,
  crop: ImageItem["crop"] = null,
): ImageItem => ({
  id: "thin",
  name: "thin.png",
  source: "file",
  blob: new Blob(["thin"], { type: "image/png" }),
  bitmap: { width, height, close: jest.fn() } as unknown as ImageBitmap,
  originalWidth: width,
  originalHeight: height,
  crop,
  rotation: 0,
  targetWidth: null,
});

const rectOf = (width: number, height: number) => ({
  width,
  height,
  top: 0,
  left: 0,
  right: width,
  bottom: height,
  x: 0,
  y: 0,
  toJSON: () => ({}),
});

beforeEach(() => {
  selectionState.x = 20;
  selectionState.y = 40;
  selectionState.width = 80;
  selectionState.height = 120;
  selectionState.keyboard = false;
  imageState.scalable = true;
  imageState.translatable = true;
  imageState.rotatable = true;
  imageState.skewable = true;
  lastCropperInstance = null;
  cropperCanvasElement.style = {} as CSSStyleDeclaration;
  HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
    drawImage: jest.fn(),
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  // 既定では「意図した計算値どおりにレンダリングされた」広い画面を再現する
  // (1200x800のテスト用bitmapに対し、長辺480に収める0.4倍 = 幅480px)
  jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 480,
    height: 320,
    top: 0,
    left: 0,
    right: 480,
    bottom: 320,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
});

describe("CropDialog", () => {
  it("renders as an accessible dialog naming the image being cropped", async () => {
    render(<CropDialog item={makeItem()} onConfirm={jest.fn()} onCancel={jest.fn()} onReset={jest.fn()} />);

    expect(screen.getByRole("dialog", { name: "トリミング: first.png" })).toBeInTheDocument();
    await waitForCropperReady();
  });

  it("moves focus into the dialog on open, and restores it to the previously-focused element on close", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "トリミング: first.png";
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = render(
      <CropDialog item={makeItem()} onConfirm={jest.fn()} onCancel={jest.fn()} onReset={jest.fn()} />,
    );

    expect(document.activeElement).toBe(screen.getByRole("dialog"));

    unmount();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("calls onConfirm with the selection rect converted from display scale to the source image's natural pixel scale", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();

    render(<CropDialog item={makeItem()} onConfirm={onConfirm} onCancel={jest.fn()} onReset={jest.fn()} />);
    // cropperjsはNext.jsのサーバー側モジュール評価を壊さないよう動的importで
    // 読み込んでいるため、インスタンス化はマイクロタスク1回分遅れる
    await waitForCropperReady();

    await user.click(screen.getByRole("button", { name: "切り抜きを適用" }));

    // 表示は0.4倍(長辺1200を480に収める)されているため、選択範囲(表示座標)を
    // 0.4で割った値が元画像のピクセル座標になる
    expect(onConfirm).toHaveBeenCalledWith("first", { x: 50, y: 100, width: 200, height: 300 });
  });

  it("positions the initial selection from existing crop metadata, converted to display scale", async () => {
    render(
      <CropDialog
        item={makeItem({ x: 50, y: 100, width: 200, height: 300 })}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
        onReset={jest.fn()}
      />,
    );

    await waitForCropperReady();

    expect(selectionState).toMatchObject({ x: 20, y: 40, width: 80, height: 120 });
  });

  it("explicitly sizes the cropper-canvas element to 100% of its wrapper (cropperjs's own default has no height:100% rule, only a 100px min-height floor)", async () => {
    render(<CropDialog item={makeItem()} onConfirm={jest.fn()} onCancel={jest.fn()} onReset={jest.fn()} />);

    await waitForCropperReady();

    expect(cropperCanvasElement.style.width).toBe("100%");
    expect(cropperCanvasElement.style.height).toBe("100%");
    // 縦横比が極端な画像ではmin-width:200px/min-height:100pxが同じ問題を
    // 再発させるため、これらも明示的に上書きする必要がある
    expect(cropperCanvasElement.style.minWidth).toBe("0");
    expect(cropperCanvasElement.style.minHeight).toBe("0");
  });

  it("disables image pan/zoom/rotate so the display scale used for coordinate conversion stays valid", async () => {
    render(<CropDialog item={makeItem()} onConfirm={jest.fn()} onCancel={jest.fn()} onReset={jest.fn()} />);

    await waitForCropperReady();

    expect(imageState).toEqual({
      scalable: false,
      translatable: false,
      rotatable: false,
      skewable: false,
    });
  });

  it("enables keyboard control of the crop selection (all operations must be keyboard-reachable)", async () => {
    render(<CropDialog item={makeItem()} onConfirm={jest.fn()} onCancel={jest.fn()} onReset={jest.fn()} />);

    await waitForCropperReady();

    expect(selectionState.keyboard).toBe(true);
  });

  it("derives displayScale from the actually-rendered width, not the intended CSS value, when a narrow viewport clips it (e.g. via max-width:100%)", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    // 320px幅の画面で、意図した480pxではなく240pxしか実際には確保できなかった
    // 状況を再現する(max-width:100%等による縮小)
    jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 240,
      height: 160,
      top: 0,
      left: 0,
      right: 240,
      bottom: 160,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    render(<CropDialog item={makeItem()} onConfirm={onConfirm} onCancel={jest.fn()} onReset={jest.fn()} />);
    await waitForCropperReady();

    await user.click(screen.getByRole("button", { name: "切り抜きを適用" }));

    // 実測幅240pxから逆算した倍率は240/1200=0.2。選択範囲(表示座標)をその
    // 実測倍率で割った値が元画像のピクセル座標になる(0.4だと誤った値になる)
    expect(onConfirm).toHaveBeenCalledWith("first", { x: 100, y: 200, width: 400, height: 600 });
  });

  it("shows the initial crop rect in natural-pixel-coordinate number inputs (cropperjs's own keyboard support only moves, never resizes, the selection)", async () => {
    render(<CropDialog item={makeItem()} onConfirm={jest.fn()} onCancel={jest.fn()} onReset={jest.fn()} />);

    await waitForCropperReady();

    // 表示座標(20,40,80,120)を0.4で割った元画像ピクセル座標
    expect(screen.getByLabelText("左から(px)")).toHaveValue(50);
    expect(screen.getByLabelText("上から(px)")).toHaveValue(100);
    expect(screen.getByLabelText("幅(px)")).toHaveValue(200);
    expect(screen.getByLabelText("高さ(px)")).toHaveValue(300);
  });

  it("lets the width/height/position be changed via keyboard-accessible number inputs, applied to the selection and confirmed", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();

    render(<CropDialog item={makeItem()} onConfirm={onConfirm} onCancel={jest.fn()} onReset={jest.fn()} />);
    await waitForCropperReady();

    const widthInput = screen.getByLabelText("幅(px)");
    await user.clear(widthInput);
    await user.type(widthInput, "500");

    // 入力(元画像ピクセル座標)は表示スケール(0.4)を掛けて選択範囲に反映される
    expect(selectionState.width).toBeCloseTo(200);

    await user.click(screen.getByRole("button", { name: "切り抜きを適用" }));

    expect(onConfirm).toHaveBeenCalledWith("first", { x: 50, y: 100, width: 500, height: 300 });
  });

  it("does not write a zero width/height to the live selection while typing, and refuses to confirm a zero-size crop", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();

    render(<CropDialog item={makeItem()} onConfirm={onConfirm} onCancel={jest.fn()} onReset={jest.fn()} />);
    await waitForCropperReady();

    const widthInput = screen.getByLabelText("幅(px)");
    await user.clear(widthInput);

    // 入力欄の表示は0になるが、実際の選択範囲(Cropper側)には反映されない
    expect(widthInput).toHaveValue(0);
    expect(selectionState.width).toBe(80);

    await user.click(screen.getByRole("button", { name: "切り抜きを適用" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("有効な範囲を指定してください");
  });

  it("refuses to confirm a crop rect that extends beyond the source image's bounds", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    // 表示座標(既定値 x=20,y=40,w=80,h=120)を0.4で割った元画像座標
    // (x=50,y=100,w=200,h=300)。画像は1200x800なので、xを1100に変更すると
    // 1100+200=1300 > 1200ではみ出す
    render(<CropDialog item={makeItem()} onConfirm={onConfirm} onCancel={jest.fn()} onReset={jest.fn()} />);
    await waitForCropperReady();

    const xInput = screen.getByLabelText("左から(px)");
    await user.clear(xInput);
    await user.type(xInput, "1100");

    await user.click(screen.getByRole("button", { name: "切り抜きを適用" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("有効な範囲を指定してください");
  });

  it("keeps the number inputs synced with drag/keyboard changes made directly on the selection (not just typed input)", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();

    render(<CropDialog item={makeItem()} onConfirm={onConfirm} onCancel={jest.fn()} onReset={jest.fn()} />);
    await waitForCropperReady();

    expect(screen.getByLabelText("左から(px)")).toHaveValue(50);

    // ドラッグやキーボード矢印キーでの操作をシミュレートする(数値入力欄を
    // 経由しない、Cropper内部からの直接的な変更)
    simulateSelectionChange({ x: 40, y: 40, width: 80, height: 120 });

    await waitFor(() => expect(screen.getByLabelText("左から(px)")).toHaveValue(100));

    await user.click(screen.getByRole("button", { name: "切り抜きを適用" }));

    expect(onConfirm).toHaveBeenCalledWith("first", { x: 100, y: 100, width: 200, height: 300 });
  });

  it("calls onCancel without calling onConfirm when cancelled", async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    const onConfirm = jest.fn();

    render(<CropDialog item={makeItem()} onConfirm={onConfirm} onCancel={onCancel} onReset={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onReset with the item id and not onConfirm when reset", async () => {
    const user = userEvent.setup();
    const onReset = jest.fn();
    const onConfirm = jest.fn();

    render(<CropDialog item={makeItem()} onConfirm={onConfirm} onCancel={jest.fn()} onReset={onReset} />);

    await user.click(screen.getByRole("button", { name: "トリミングを解除" }));

    expect(onReset).toHaveBeenCalledWith("first");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("destroys the cropper instance on unmount", async () => {
    const { unmount } = render(
      <CropDialog item={makeItem()} onConfirm={jest.fn()} onCancel={jest.fn()} onReset={jest.fn()} />,
    );

    await waitForCropperReady();
    const destroySpy = lastCropperInstance?.destroy;

    unmount();

    expect(destroySpy).toHaveBeenCalled();
  });

  it("orders the numeric fields as 左から → 上から → 幅 → 高さ (2列×2段のレイアウト意図の間接的な確認)", async () => {
    render(<CropDialog item={makeItem()} onConfirm={jest.fn()} onCancel={jest.fn()} onReset={jest.fn()} />);

    await waitForCropperReady();

    // DOM順に取得したspinbutton群が、意図した並び(左から/上から/幅/高さ)と
    // 同じ要素を同じ順序で指しているかを確認する
    expect(screen.getAllByRole("spinbutton")).toEqual([
      screen.getByLabelText("左から(px)"),
      screen.getByLabelText("上から(px)"),
      screen.getByLabelText("幅(px)"),
      screen.getByLabelText("高さ(px)"),
    ]);
  });

  it("shows guidance text telling the user to drag the selection to choose the area to keep", async () => {
    render(<CropDialog item={makeItem()} onConfirm={jest.fn()} onCancel={jest.fn()} onReset={jest.fn()} />);

    await waitForCropperReady();

    expect(screen.getByText("枠を動かして、残す範囲を選んでください")).toBeInTheDocument();
  });

  it("traps focus inside the dialog: Tab on the last focusable element wraps to the first", async () => {
    const user = userEvent.setup();

    render(<CropDialog item={makeItem()} onConfirm={jest.fn()} onCancel={jest.fn()} onReset={jest.fn()} />);
    await waitForCropperReady();

    const firstInput = screen.getByLabelText("左から(px)");
    const confirmButton = screen.getByRole("button", { name: "切り抜きを適用" });

    confirmButton.focus();
    expect(confirmButton).toHaveFocus();

    await user.tab();

    expect(firstInput).toHaveFocus();
  });

  it("traps focus inside the dialog: Shift+Tab on the first focusable element wraps to the last", async () => {
    const user = userEvent.setup();

    render(<CropDialog item={makeItem()} onConfirm={jest.fn()} onCancel={jest.fn()} onReset={jest.fn()} />);
    await waitForCropperReady();

    const firstInput = screen.getByLabelText("左から(px)");
    const confirmButton = screen.getByRole("button", { name: "切り抜きを適用" });

    firstInput.focus();
    expect(firstInput).toHaveFocus();

    await user.tab({ shift: true });

    expect(confirmButton).toHaveFocus();
  });

  describe("extreme aspect ratios (Issue #63, confirmed via integration-spike against real cropperjs)", () => {
    // integration-spikeで実測: 1x10000のような極端なアスペクト比では、
    // 単一の比例縮小(commonScale)のまま丸めると短辺がMath.roundで0pxになり、
    // ドラッグ操作も数値入力による座標変換も破綻する。短辺だけ
    // MIN_WRAPPER_DIMENSION(24px)を満たす独立した倍率(scaleX/scaleY)に
    // 切り替えることで、長辺は無歪みのまま短辺だけクリック可能なサイズを
    // 確保する。この2軸独立スケールの挙動を検証する。

    const originalInnerHeightDescriptor = Object.getOwnPropertyDescriptor(window, "innerHeight");

    afterEach(() => {
      jest.restoreAllMocks();

      // window.innerHeightはObject.definePropertyで上書きしており、
      // jest.restoreAllMocks()では戻らないため、元のプロパティ記述子を
      // 明示的に復元する(他テストへ影響を残さないため)
      if (originalInnerHeightDescriptor) {
        Object.defineProperty(window, "innerHeight", originalInnerHeightDescriptor);
      }
    });

    it("floors only the degenerate width axis for a very thin (1x10000) image, keeping the height axis proportional", async () => {
      Object.defineProperty(window, "innerHeight", { configurable: true, value: 640 });
      // 1回目(availableWidthの見積もり、まだスタイル未設定時点): 480
      // 2回目(wrapper.style設定後の実測): 24x384(=10000*(384/10000)を丸めた値)
      jest
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockReturnValueOnce(rectOf(480, 320))
        .mockReturnValueOnce(rectOf(24, 384));

      render(
        <CropDialog item={makeExtremeItem(1, 10000)} onConfirm={jest.fn()} onCancel={jest.fn()} onReset={jest.fn()} />,
      );
      await waitForCropperReady();

      const wrapper = document.querySelector("canvas")?.parentElement as HTMLElement;

      expect(wrapper.style.width).toBe("24px");
      // 高さはcommonScale(384/10000)のまま、24pxという下限には影響されない
      expect(wrapper.style.height).toBe("384px");
    });

    it("converts existing crop metadata to display coordinates using independent per-axis scale, not one shared scale", async () => {
      Object.defineProperty(window, "innerHeight", { configurable: true, value: 640 });
      jest
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockReturnValueOnce(rectOf(480, 320))
        .mockReturnValueOnce(rectOf(24, 384));

      // 元画像ピクセル座標(1x10000の範囲内): x=0,width=1(幅は1しかありえない)、
      // y=5000,height=2000
      render(
        <CropDialog
          item={makeExtremeItem(1, 10000, { x: 0, y: 5000, width: 1, height: 2000 })}
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
          onReset={jest.fn()}
        />,
      );
      await waitForCropperReady();

      // displayScale.x = 24/1 = 24、displayScale.y = 384/10000 = 0.0384
      // (1軸だけの共有スケールだと、この2つの倍率は一致してしまい
      // 期待値からズレる)
      expect(selectionState.x).toBeCloseTo(0);
      expect(selectionState.width).toBeCloseTo(24);
      expect(selectionState.y).toBeCloseTo(192);
      expect(selectionState.height).toBeCloseTo(76.8);
    });

    it("floors only the degenerate height axis for a very wide (10000x1) image, and round-trips keyboard-entered natural pixel values through the correct per-axis scale", async () => {
      const user = userEvent.setup();
      const onConfirm = jest.fn();
      Object.defineProperty(window, "innerHeight", { configurable: true, value: 640 });
      // 幅は480(DISPLAY_MAX_DIMENSIONで頭打ち)、高さは24(下限)
      jest
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockReturnValueOnce(rectOf(480, 320))
        .mockReturnValueOnce(rectOf(480, 24));

      render(
        <CropDialog item={makeExtremeItem(10000, 1)} onConfirm={onConfirm} onCancel={jest.fn()} onReset={jest.fn()} />,
      );
      await waitForCropperReady();

      const wrapper = document.querySelector("canvas")?.parentElement as HTMLElement;

      expect(wrapper.style.width).toBe("480px");
      expect(wrapper.style.height).toBe("24px");

      // 高さ1pxの画像なのでyは0固定でなければならない(既定値40は表示座標の
      // ままだと元画像座標に換算した際に範囲外になり、確定が拒否されてしまう)
      const yInput = screen.getByLabelText("上から(px)");
      await user.clear(yInput);
      await user.type(yInput, "0");

      // displayScale.x = 480/10000 = 0.048、displayScale.y = 24/1 = 24
      const widthInput = screen.getByLabelText("幅(px)");
      await user.clear(widthInput);
      await user.type(widthInput, "5000");
      // 幅の入力(元画像ピクセル)にはscaleX(0.048)が使われる。scaleY(24)を
      // 誤用すると120000のようなあり得ない値になってしまう
      expect(selectionState.width).toBeCloseTo(240);

      const heightInput = screen.getByLabelText("高さ(px)");
      await user.clear(heightInput);
      await user.type(heightInput, "1");
      // 高さの入力にはscaleY(24)が使われる
      expect(selectionState.height).toBeCloseTo(24);

      await user.click(screen.getByRole("button", { name: "切り抜きを適用" }));

      expect(onConfirm).toHaveBeenCalledWith(
        "thin",
        expect.objectContaining({ width: 5000, height: 1 }),
      );
    });
  });

  it("traps focus inside the dialog: Shift+Tab right after opening (panel itself still focused) wraps to the last element instead of leaking to the background", async () => {
    const user = userEvent.setup();

    render(<CropDialog item={makeItem()} onConfirm={jest.fn()} onCancel={jest.fn()} onReset={jest.fn()} />);
    await waitForCropperReady();

    const dialog = screen.getByRole("dialog");
    const confirmButton = screen.getByRole("button", { name: "切り抜きを適用" });

    // 開いた直後はtabIndex={-1}のパネル自身にフォーカスがあり、focusableの
    // 一覧には含まれない。この状態を起点にShift+Tabしても背景へ漏れず、
    // 末尾要素へ折り返すことを検証する
    expect(dialog).toHaveFocus();

    await user.tab({ shift: true });

    expect(confirmButton).toHaveFocus();
  });
});
