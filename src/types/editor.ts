// クロップ範囲(元画像上のピクセル座標)。crop/rotation/targetWidthは
// 描画されるまで確定値を持たないメタデータとして保持する。
export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImageItem = {
  id: string;
  name: string;
  // 画像がどの経路で追加されたか(ファイル選択/クリップボード貼り付け/ZIP展開)
  source: "file" | "paste" | "zip";
  blob: Blob;
  // デコード済みビットマップ。使い終わったら明示的にclose()して解放する必要がある
  bitmap: ImageBitmap;
  originalWidth: number;
  originalHeight: number;
  crop: CropRect | null;
  rotation: 0 | 90 | 180 | 270;
  targetWidth: number | null;
};

export type AppError = {
  code: string;
  message: string;
};

export type EditorState = {
  items: ImageItem[];
  direction: "vertical" | "horizontal";
  sizeMode: "original" | "fitWidth" | "fitHeight" | "custom";
  customSize: number | null;
  gap: number;
  background: string;
  format: "png" | "jpeg";
  jpegQuality: number;
  // 実行中の非同期処理(画像追加など)の件数。0より大きい間はローディング表示になる
  processing: number;
  error: AppError | null;
};

export type EditorAction =
  | { type: "items/add"; item: ImageItem }
  | { type: "items/remove"; id: string }
  | { type: "items/clear" }
  | { type: "settings/direction"; direction: EditorState["direction"] }
  | { type: "items/reorder"; activeId: string; overId: string }
  | { type: "processing/start" }
  | { type: "processing/end" };

export const createInitialEditorState = (): EditorState => ({
  items: [],
  direction: "vertical",
  sizeMode: "original",
  customSize: null,
  gap: 0,
  background: "#ffffff",
  format: "png",
  jpegQuality: 0.92,
  processing: 0,
  error: null,
});

export const editorReducer = (
  state: EditorState,
  action: EditorAction,
): EditorState => {
  switch (action.type) {
    case "items/add":
      return { ...state, items: [...state.items, action.item] };
    case "items/remove":
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.id),
      };
    case "items/clear":
      return { ...state, items: [] };
    case "settings/direction":
      return { ...state, direction: action.direction };
    case "items/reorder": {
      const { activeId, overId } = action;

      if (activeId === overId) {
        return state;
      }

      const activeIndex = state.items.findIndex((item) => item.id === activeId);
      const overIndex = state.items.findIndex((item) => item.id === overId);

      // ドラッグ元またはドロップ先が既に一覧から消えていた場合は何もしない
      if (activeIndex === -1 || overIndex === -1) {
        return state;
      }

      const items = [...state.items];
      const [moved] = items.splice(activeIndex, 1);
      items.splice(overIndex, 0, moved);

      return { ...state, items };
    }
    case "processing/start":
      return { ...state, processing: state.processing + 1 };
    // 多重に走る非同期処理が独立してstart/endするため、カウントは0未満にしない
    case "processing/end":
      return { ...state, processing: Math.max(0, state.processing - 1) };
    default:
      return state;
  }
};
