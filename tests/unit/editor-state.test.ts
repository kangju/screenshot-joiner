import {
  createInitialEditorState,
  editorReducer,
  type ImageItem,
} from "@/types/editor";

const createImageItem = (id: string, rotation: ImageItem["rotation"]): ImageItem => ({
  id,
  name: `${id}.png`,
  source: "file",
  blob: new Blob([id], { type: "image/png" }),
  bitmap: {} as ImageBitmap,
  originalWidth: 1280,
  originalHeight: 720,
  crop: { x: 10, y: 20, width: 640, height: 360 },
  rotation,
  targetWidth: 800,
});

const withItems = (items: ImageItem[]) =>
  items.reduce(
    (state, item) => editorReducer(state, { type: "items/add", item }),
    createInitialEditorState(),
  );

describe("editor state", () => {
  it("creates the documented initial state", () => {
    expect(createInitialEditorState()).toEqual({
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
  });

  it("adds image items in order without changing their metadata", () => {
    const first = createImageItem("first", 90);
    const second = createImageItem("second", 270);

    const withFirst = editorReducer(createInitialEditorState(), {
      type: "items/add",
      item: first,
    });
    const withSecond = editorReducer(withFirst, {
      type: "items/add",
      item: second,
    });

    expect(withSecond.items).toEqual([first, second]);
  });

  it("removes only the targeted item, keeping the order of the rest", () => {
    const first = createImageItem("first", 0);
    const second = createImageItem("second", 90);
    const third = createImageItem("third", 180);
    const withThree = [first, second, third].reduce(
      (state, item) => editorReducer(state, { type: "items/add", item }),
      createInitialEditorState(),
    );

    const withSecondRemoved = editorReducer(withThree, {
      type: "items/remove",
      id: "second",
    });

    expect(withSecondRemoved.items).toEqual([first, third]);
  });

  it("does nothing when removing an id that is not present", () => {
    const first = createImageItem("first", 0);
    const withFirst = editorReducer(createInitialEditorState(), {
      type: "items/add",
      item: first,
    });

    const result = editorReducer(withFirst, { type: "items/remove", id: "missing" });

    expect(result.items).toEqual([first]);
  });

  it("clears every item at once", () => {
    const first = createImageItem("first", 0);
    const second = createImageItem("second", 90);
    const withTwo = [first, second].reduce(
      (state, item) => editorReducer(state, { type: "items/add", item }),
      createInitialEditorState(),
    );

    const cleared = editorReducer(withTwo, { type: "items/clear" });

    expect(cleared.items).toEqual([]);
  });

  it("switches the join direction without changing anything else", () => {
    const state = createInitialEditorState();

    const horizontal = editorReducer(state, {
      type: "settings/direction",
      direction: "horizontal",
    });

    expect(horizontal).toEqual({ ...state, direction: "horizontal" });
  });

  it("moves the active item to sit where the target item was, shifting the rest back", () => {
    const first = createImageItem("first", 0);
    const second = createImageItem("second", 90);
    const third = createImageItem("third", 180);
    const state = withItems([first, second, third]);

    const reordered = editorReducer(state, {
      type: "items/reorder",
      activeId: "first",
      overId: "third",
    });

    expect(reordered.items).toEqual([second, third, first]);
  });

  it("moves the active item earlier when the target comes before it", () => {
    const first = createImageItem("first", 0);
    const second = createImageItem("second", 90);
    const third = createImageItem("third", 180);
    const state = withItems([first, second, third]);

    const reordered = editorReducer(state, {
      type: "items/reorder",
      activeId: "third",
      overId: "first",
    });

    expect(reordered.items).toEqual([third, first, second]);
  });

  it("does nothing when reordering with an unknown id", () => {
    const first = createImageItem("first", 0);
    const second = createImageItem("second", 90);
    const state = withItems([first, second]);

    const reordered = editorReducer(state, {
      type: "items/reorder",
      activeId: "first",
      overId: "missing",
    });

    expect(reordered.items).toEqual([first, second]);
  });

  it("does nothing when the active and target ids are the same", () => {
    const first = createImageItem("first", 0);
    const second = createImageItem("second", 90);
    const state = withItems([first, second]);

    const reordered = editorReducer(state, {
      type: "items/reorder",
      activeId: "second",
      overId: "second",
    });

    expect(reordered.items).toEqual([first, second]);
  });

  it("counts overlapping in-flight batches instead of a plain flag", () => {
    const state = createInitialEditorState();

    const oneRunning = editorReducer(state, { type: "processing/start" });
    const twoRunning = editorReducer(oneRunning, { type: "processing/start" });
    const oneRunningAgain = editorReducer(twoRunning, { type: "processing/end" });
    const noneRunning = editorReducer(oneRunningAgain, { type: "processing/end" });

    expect(oneRunning.processing).toBe(1);
    expect(twoRunning.processing).toBe(2);
    expect(oneRunningAgain.processing).toBe(1);
    expect(noneRunning.processing).toBe(0);
  });

  it("does not let processing go below zero", () => {
    const state = createInitialEditorState();

    const result = editorReducer(state, { type: "processing/end" });

    expect(result.processing).toBe(0);
  });
});
