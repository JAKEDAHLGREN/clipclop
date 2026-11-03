const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ClipboardStore = require("../store");

let tmpDir;
let filePath;
let store;
let uuidCounter;

function makeStore() {
  uuidCounter = 0;
  return new ClipboardStore({
    filePath,
    maxClips: 30,
    now: () => "2026-01-01T00:00:00.000Z",
    uuid: () => `uuid-${++uuidCounter}`,
    logger: { error: () => {} },
  });
}

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clipclop-test-"));
  filePath = path.join(tmpDir, "history.json");
  store = makeStore();
});

after(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_) {}
});

describe("ClipboardStore.add", () => {
  test("adds a new clip and prepends it", () => {
    const store = makeStore();
    const a = store.add("first");
    const b = store.add("second");
    assert.equal(store.getAll().length, 2);
    assert.equal(store.getAll()[0].content, "second");
    assert.equal(store.getAll()[1].content, "first");
    assert.equal(a.id, "uuid-1");
    assert.equal(b.id, "uuid-2");
    assert.equal(a.createdAt, "2026-01-01T00:00:00.000Z");
  });

  test("re-copying identical text moves it to the top without a duplicate", () => {
    const store = makeStore();
    store.add("hello");
    store.add("world");
    store.add("hello");
    const clips = store.getAll();
    assert.equal(clips.length, 2); // no duplicate
    assert.equal(clips[0].content, "hello"); // moved to top
    assert.equal(clips[0].id, "uuid-3"); // fresh id
    assert.equal(clips[1].content, "world");
  });

  test("enforces the max clip limit, evicting oldest", () => {
    const store = new ClipboardStore({
      filePath,
      maxClips: 3,
      now: () => "2026-01-01T00:00:00.000Z",
      uuid: () => `uuid-${++uuidCounter}`,
      logger: { error: () => {} },
    });
    store.add("1");
    store.add("2");
    store.add("3");
    store.add("4");
    const clips = store.getAll();
    assert.equal(clips.length, 3); // capped
    assert.equal(clips[0].content, "4");
    assert.equal(clips[2].content, "2"); // oldest "1" evicted
  });
});

describe("ClipboardStore persistence", () => {
  test("persists and reloads clips across instances", () => {
    store.clear();
    store.add("alpha");
    store.add("beta");

    const reloaded = makeStore();
    reloaded.load();
    const clips = reloaded.getAll();
    assert.equal(clips.length, 2);
    assert.equal(clips[0].content, "beta");
    assert.equal(clips[1].content, "alpha");
  });
});

describe("ClipboardStore.load recovery", () => {
  test("recovers from corrupted JSON by backing it up and starting empty", () => {
    fs.writeFileSync(filePath, "{corrupted json!!!", "utf-8");
    const store = makeStore();
    store.load();
    assert.deepEqual(store.getAll(), []);
    assert.ok(fs.existsSync(filePath + ".corrupt"), "corrupt backup created");
  });

  test("recovers when data is valid JSON but not an array", () => {
    fs.writeFileSync(filePath, JSON.stringify({ not: "an array" }), "utf-8");
    const store = makeStore();
    store.load();
    assert.deepEqual(store.getAll(), []);
    assert.ok(fs.existsSync(filePath + ".corrupt"));
  });

  test("drops malformed entries but keeps valid ones on load", () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify([
        { id: "ok-1", content: "valid", createdAt: "x" },
        { id: 123, content: "bad id" },
        { content: "missing id" },
        null,
        "garbage",
        { id: "ok-2", content: 42 },
        { id: "ok-3", content: "also valid" },
      ]),
      "utf-8"
    );
    const store = makeStore();
    store.load();
    const clips = store.getAll();
    assert.equal(clips.length, 2);
    assert.equal(clips[0].content, "valid");
    assert.equal(clips[1].content, "also valid");
  });
});

describe("ClipboardStore mutations", () => {
  test("deleteById removes an existing clip and persists", () => {
    const store = makeStore();
    const a = store.add("keep");
    store.add("remove");
    assert.equal(store.deleteById(a.id), true);
    // a is no longer found (it was oldest after 'remove' added)
    assert.equal(store.getAll().some((c) => c.id === a.id), false);
  });

  test("deleteById returns false and changes nothing for unknown id", () => {
    const store = makeStore();
    store.add("only");
    assert.equal(store.deleteById("nonexistent"), false);
    assert.equal(store.getAll().length, 1);
  });

  test("clear empties the store and persists", () => {
    const store = makeStore();
    store.add("x");
    store.clear();
    assert.deepEqual(store.getAll(), []);
    const reloaded = makeStore();
    reloaded.load();
    assert.deepEqual(reloaded.getAll(), []);
  });

  test("findById returns the correct clip or undefined", () => {
    const store = makeStore();
    const a = store.add("first");
    store.add("second");
    assert.equal(store.findById(a.id).content, "first");
    assert.equal(store.findById("missing"), undefined);
  });
});

describe("ClipboardStore.promote", () => {
  test("moves a lower clip to the top and refreshes its timestamp", () => {
    let t = "2026-01-01T00:00:00.000Z";
    const store = new ClipboardStore({
      filePath,
      now: () => t,
      uuid: (() => { let i = 0; return () => `p-${++i}`; })(),
      logger: { error: () => {} },
    });
    const a = store.add("a");
    store.add("b");
    store.add("c");
    t = "2026-02-02T00:00:00.000Z";
    const promoted = store.promote(a.id);
    assert.equal(promoted.id, a.id); // same clip, same id
    assert.deepEqual(store.getAll().map((c) => c.content), ["a", "c", "b"]);
    assert.equal(store.getAll()[0].createdAt, "2026-02-02T00:00:00.000Z");
    assert.equal(store.getAll().length, 3);
  });

  test("promoting the first clip keeps the order", () => {
    const store = makeStore();
    store.add("x");
    const y = store.add("y");
    store.promote(y.id);
    assert.deepEqual(store.getAll().map((c) => c.content), ["y", "x"]);
  });

  test("returns null for an unknown id", () => {
    const store = makeStore();
    store.add("x");
    assert.equal(store.promote("nope"), null);
    assert.equal(store.getAll().length, 1);
  });

  test("persists the new order", () => {
    const store = makeStore();
    const a = store.add("a");
    store.add("b");
    store.promote(a.id);
    const reloaded = makeStore();
    reloaded.load();
    assert.deepEqual(reloaded.getAll().map((c) => c.content), ["a", "b"]);
  });
});
