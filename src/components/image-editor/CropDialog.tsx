"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type Cropper from "cropperjs";

import type { CropRect, ImageItem } from "@/types/editor";

import styles from "./CropDialog.module.css";

type CropDialogProps = {
  item: ImageItem;
  onConfirm: (id: string, crop: CropRect) => void;
  onCancel: () => void;
  onReset: (id: string) => void;
};

// ダイアログ内で画像を表示する最大の一辺(これより大きい画像は縮小して表示する)
const DISPLAY_MAX_DIMENSION = 480;

// 自由比率のトリミングUI。cropperjsが持つ実際のポインター/ピンチ操作を
// そのまま利用する。
//
// 注意: cropperjsの<cropper-canvas>は自身のDOM上の親要素の幅いっぱいに
// 広がる仕様で、渡したcanvasの解像度(width/height属性)には追従しない。
// そのため、渡すcanvas(を包むラッパーdiv)自体を「画像を表示スケールで
// 収めたときのCSSピクセルサイズ」にあらかじめ固定して初めて、
// CropperSelectionのx/y/width/heightが「表示座標」として一貫した意味を持つ。
// この表示座標は元画像のピクセル座標とは倍率(displayScale)だけ異なるので、
// 決定時・再オープン時にその倍率で変換する。
//
// 狭い画面では.canvasWrapperのmax-width:100%等により、指定した幅がその
// まま反映されず縮小されることがある。そのため、CSSで指定した意図どおりの
// 値ではなく、実際にレンダリングされた幅をgetBoundingClientRect()で測定し、
// そこからdisplayScaleを逆算する(計算値を信用せず、実測値を信用する)。
type NaturalRect = { x: number; y: number; width: number; height: number };

export function CropDialog({ item, onConfirm, onCancel, onReset }: CropDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cropperRef = useRef<Cropper | null>(null);
  const displayScaleRef = useRef(1);
  // ポインター操作(ドラッグ)だけでは範囲の幅・高さを変更する手段がキーボードに
  // 無い(cropperjsの既定のキーボード操作は移動のみ)ため、元画像のピクセル
  // 座標で直接入力できる数値フィールドを用意し、キーボードだけで完結できる
  // ようにする(「すべての操作をキーボードで到達・実行できる」という要件のため)。
  const [naturalRect, setNaturalRect] = useState<NaturalRect>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // ダイアログを開いたときにフォーカスをダイアログ内へ移し、閉じたときに
  // 開く前にフォーカスしていた要素(一覧のトリミングボタン等)へ戻す。
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    return () => {
      previouslyFocused?.focus();
    };
  }, []);

  // パネル内でTabキーによるフォーカス移動を循環させる(背景要素へ
  // フォーカスが漏れないようにするフォーカストラップ)。上記の初期フォーカス・
  // 復帰処理とは独立した別の関心事のため、別のuseEffectとして分離する。
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }

      const panel = panelRef.current;

      if (!panel) {
        return;
      }

      const focusable = Array.from(
        panel.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLElement>(
          'button, input, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !("disabled" in element && element.disabled));

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        // 開いた直後はtabIndex={-1}のパネル自身にフォーカスがあり(上の
        // useEffect参照)、これはfocusableの一覧に含まれない。この状態から
        // Shift+Tabすると素通りして背景へフォーカスが漏れるため、パネル自身も
        // 「先頭にいる」ものとして扱い、末尾要素へ折り返す
        if (document.activeElement === first || document.activeElement === panel) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;

    if (!canvas || !wrapper) {
      return;
    }

    // .canvasWrapperのCSSはmax-width:100%とmax-height:60vhを別々に持つため、
    // 単純に長辺をDISPLAY_MAX_DIMENSIONに収める計算だけだと、狭い画面では
    // 幅だけが(高さは変わらずに)CSSで縮小され、コンテナのアスペクト比が
    // 元画像とズレてしまう(cropperjsの<cropper-canvas>はそのアスペクト比の
    // 崩れたコンテナをそのまま使うため、画像が中央にレターボックス表示され、
    // 表示座標<->元画像座標の変換が崩れる)。
    //
    // 「親要素の幅からpaddingを引いて…」のような手計算は親のCSSが変われば
    // 簡単にズレるため、それをせずに済む方法をとる: wrapperにまだ明示的な
    // 幅を指定していない時点(ブロック要素として親のコンテント幅いっぱいに
    // 広がっている状態)でgetBoundingClientRect()を測り、それをそのまま
    // 「実際に使える幅」として使う。
    const availableWidth = Math.min(DISPLAY_MAX_DIMENSION, wrapper.getBoundingClientRect().width || DISPLAY_MAX_DIMENSION);
    // 高さ方向はブロック要素の自然な高さが0になってしまい同じ方法が使えないため、
    // CSSの`max-height: 60vh`と同じ計算式で近似する(この定数はCropDialog.module.cssの
    // .canvasWrapperと合わせる必要がある)
    const availableHeight = Math.min(DISPLAY_MAX_DIMENSION, window.innerHeight * 0.6);
    const intendedScale =
      item.bitmap.width === 0 || item.bitmap.height === 0
        ? 1
        : Math.min(1, availableWidth / item.bitmap.width, availableHeight / item.bitmap.height);

    wrapper.style.width = `${Math.round(item.bitmap.width * intendedScale)}px`;
    wrapper.style.height = `${Math.round(item.bitmap.height * intendedScale)}px`;

    // 上記の見積もりが何らかの理由で外れていた場合の保険として、指定した
    // 意図どおりの値ではなく実測値からdisplayScaleを求める
    const measuredWidth = wrapper.getBoundingClientRect().width;
    const displayScale = item.bitmap.width === 0 || measuredWidth === 0
      ? intendedScale
      : measuredWidth / item.bitmap.width;
    displayScaleRef.current = displayScale;

    canvas.width = item.bitmap.width;
    canvas.height = item.bitmap.height;
    canvas.getContext("2d")?.drawImage(item.bitmap, 0, 0);

    // cropperjsはモジュール評価時にHTMLElementを参照するため、Next.jsの
    // サーバー側モジュール評価(静的書き出しのプリレンダリングを含む)を
    // 壊さないよう、クライアントの実行時にのみ動的importする
    let cancelled = false;
    let cropper: Cropper | null = null;
    let removeSelectionListener: (() => void) | undefined;

    void import("cropperjs").then(({ default: CropperImpl }) => {
      if (cancelled) {
        return;
      }

      cropper = new CropperImpl(canvas, {});
      cropperRef.current = cropper;

      // cropperjsの<cropper-canvas>はshadow DOM側の既定スタイルが
      // `min-width: 200px; min-height: 100px`のみで`width/height: 100%`を
      // 持たないため、幅は親要素(canvasWrapper)いっぱいに広がる一方、高さは
      // 中身の内容次第で自動計算され(実質0になり)100pxの下限に張り付いて
      // しまう。wrapper側でどれだけ正しく元画像のアスペクト比に合わせて
      // サイズを計算しても、この既定のままでは<cropper-canvas>自体が正しい
      // 高さにならず、画像が中央にレターボックス表示されて表示座標<->元画像
      // 座標の変換が崩れる。そのため明示的に親要素いっぱいに広がるよう指定する。
      //
      // 縦横比が極端な画像(例: 幅100x高さ2000で長辺を480に収めるとラッパーは
      // 24x480になる)では、幅24pxがmin-width:200pxを下回ってしまい、同じ
      // レターボックス問題が再発する。min-width/min-heightも明示的に0へ
      // 上書きする(親要素のサイズだけを唯一の基準にする)。
      const cropperCanvasElement = cropper.getCropperCanvas();

      if (cropperCanvasElement) {
        cropperCanvasElement.style.width = "100%";
        cropperCanvasElement.style.height = "100%";
        cropperCanvasElement.style.minWidth = "0";
        cropperCanvasElement.style.minHeight = "0";
      }

      // 画像自体の拡大縮小・移動・回転を無効化する。有効なままだと、
      // ピンチ操作等で画像の表示位置・倍率が変わり、あらかじめ計算した
      // displayScaleでの座標変換(表示座標<->元画像ピクセル座標)が
      // 成り立たなくなる(ユーザーが選んだ範囲と保存される範囲がずれる)
      const cropperImage = cropper.getCropperImage();

      if (cropperImage) {
        cropperImage.scalable = false;
        cropperImage.translatable = false;
        cropperImage.rotatable = false;
        cropperImage.skewable = false;
      }

      const selection = cropper.getCropperSelection();

      if (selection) {
        // 「すべての操作をキーボードで到達・実行できる」というアクセシビリティ
        // 要件のため、選択範囲のキーボード操作(矢印キーでの移動・リサイズ)を
        // 明示的に有効化する(デフォルトでは無効)
        selection.keyboard = true;

        // 既存のcropメタデータ(元画像のピクセル座標)があれば、表示座標に
        // 変換したうえで前回の選択範囲から編集を再開する
        if (item.crop) {
          selection.x = item.crop.x * displayScale;
          selection.y = item.crop.y * displayScale;
          selection.width = item.crop.width * displayScale;
          selection.height = item.crop.height * displayScale;
        }

        // ドラッグやキーボード矢印キーでの操作(cropperjs側の内部状態変化)を
        // 数値入力欄にも反映する。これが無いと、ドラッグ後に数値欄が古い値の
        // ままになり、ユーザーが数値欄を見て確定しても実際に保存される範囲と
        // 食い違ってしまう。
        //
        // 注意: cropperjsの$change()は、selection.x/y/width/heightを実際に
        // 更新する「前」に新しい値をevent.detailへ入れて"change"イベントを
        // 発火する(cropper.esm.jsのCropperSelection.$change実装で確認済み)。
        // そのためこのハンドラでselection.x等を直接読むと、更新前の古い値を
        // 読んでしまう。必ずevent.detailから新しい値を読む必要がある。
        const syncFromSelection = (event: Event) => {
          const detail = (event as CustomEvent<{ x: number; y: number; width: number; height: number }>).detail;

          setNaturalRect({
            x: Math.round(detail.x / displayScale),
            y: Math.round(detail.y / displayScale),
            width: Math.round(detail.width / displayScale),
            height: Math.round(detail.height / displayScale),
          });
        };

        // 初期表示は(まだ変更イベントが発火していないため)selectionの現在値を
        // そのまま使ってよい
        setNaturalRect({
          x: Math.round(selection.x / displayScale),
          y: Math.round(selection.y / displayScale),
          width: Math.round(selection.width / displayScale),
          height: Math.round(selection.height / displayScale),
        });
        selection.addEventListener("change", syncFromSelection);
        removeSelectionListener = () => selection.removeEventListener("change", syncFromSelection);
      }
    });

    return () => {
      cancelled = true;
      removeSelectionListener?.();
      cropper?.destroy();
      cropperRef.current = null;
    };
  }, [item.bitmap, item.crop]);

  const handleRectFieldChange = (field: keyof NaturalRect, event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);

    if (!Number.isFinite(value) || value < 0) {
      return;
    }

    // 入力中(空欄にした直後など)は表示だけを更新し、幅・高さが0以下の
    // 間は実際の選択範囲(Cropper側)へは反映しない。0を反映するとCropper
    // 内部の状態が壊れうるうえ、そのまま確定されると幅・高さ0のcanvas
    // 描画につながる(handleConfirmでも最終防御として検証する)
    setNaturalRect((previous) => ({ ...previous, [field]: value }));

    if ((field === "width" || field === "height") && value <= 0) {
      return;
    }

    const selection = cropperRef.current?.getCropperSelection();

    if (selection) {
      selection[field] = value * displayScaleRef.current;
    }
  };

  const handleConfirm = () => {
    // naturalRectを確定に使う(Cropper側の生の選択範囲ではなく)。書き込み時に
    // 0以下の値をCropper側へ反映しないようガードしているため、両者は通常
    // 一致するが、数値入力欄に「現在表示されている値」をそのまま確定させる
    // (WYSIWYG)ほうが、ユーザーが見ている内容と保存内容を一致させやすい
    const rect = naturalRect;

    // 幅・高さが0以下、または元画像の範囲外になるクロップは確定させない
    const isWithinBounds =
      rect.width > 0 &&
      rect.height > 0 &&
      rect.x >= 0 &&
      rect.y >= 0 &&
      rect.x + rect.width <= item.bitmap.width &&
      rect.y + rect.height <= item.bitmap.height;

    if (!isWithinBounds) {
      setConfirmError("有効な範囲を指定してください(幅・高さは1px以上、画像の範囲内)");
      return;
    }

    setConfirmError(null);
    onConfirm(item.id, rect);
  };

  const titleId = `crop-dialog-title-${item.id}`;

  return (
    <div className={styles.overlay}>
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId} className={styles.title}>
          トリミング: {item.name}
        </h2>
        <p className={styles.guidance}>枠を動かして、残す範囲を選んでください</p>
        <div ref={wrapperRef} className={styles.canvasWrapper}>
          <canvas ref={canvasRef} className={styles.canvas} />
        </div>
        <div className={styles.coordInputs}>
          <label className={styles.coordInputLabel}>
            左から(px)
            <input
              type="number"
              min={0}
              className={styles.coordInput}
              value={naturalRect.x}
              onChange={(event) => handleRectFieldChange("x", event)}
            />
          </label>
          <label className={styles.coordInputLabel}>
            上から(px)
            <input
              type="number"
              min={0}
              className={styles.coordInput}
              value={naturalRect.y}
              onChange={(event) => handleRectFieldChange("y", event)}
            />
          </label>
          <label className={styles.coordInputLabel}>
            幅(px)
            <input
              type="number"
              min={0}
              className={styles.coordInput}
              value={naturalRect.width}
              onChange={(event) => handleRectFieldChange("width", event)}
            />
          </label>
          <label className={styles.coordInputLabel}>
            高さ(px)
            <input
              type="number"
              min={0}
              className={styles.coordInput}
              value={naturalRect.height}
              onChange={(event) => handleRectFieldChange("height", event)}
            />
          </label>
        </div>
        {confirmError && (
          <p role="alert" className={styles.confirmErrorMessage}>
            {confirmError}
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.resetButton} onClick={() => onReset(item.id)}>
            トリミングを解除
          </button>
          <button type="button" className={styles.cancelButton} onClick={onCancel}>
            キャンセル
          </button>
          <button type="button" className={styles.confirmButton} onClick={handleConfirm}>
            切り抜きを適用
          </button>
        </div>
      </div>
    </div>
  );
}
