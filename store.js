const crypto = require("crypto");
const fs = require("fs");

class ClipboardStore {
  constructor({
    filePath,
    maxClips = 30,
    now = () => new Date().toISOString(),
    uuid = () => crypto.randomUUID(),
    logger = console,
  } = {}) {
    if (!filePath) throw new Error("filePath is required");
    this.filePath = filePath;
    this.maxClips = maxClips;
    this.now = now;
    this.uuid = uuid;
    this.logger = logger;
    this.clips = [];
  }

  load() {
    try {
      this._ensureDir();
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          this.clips = parsed.filter(
            (c) => c && typeof c.id === "string" && typeof c.content === "string"
          );
        } else {
          throw new Error("History data is not an array");
        }
      }
    } catch (err) {
      this.logger.error("Failed to load clips:", err.message);
      try {
        if (fs.existsSync(this.filePath)) {
          fs.copyFileSync(this.filePath, this.filePath + ".corrupt");
        }
      } catch (_) {}
      this.clips = [];
    }
    return this.clips;
  }

  save() {
    try {
      this._ensureDir();
      const tmp = this.filePath + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(this.clips, null, 2), "utf-8");
      fs.renameSync(tmp, this.filePath);
    } catch (err) {
      this.logger.error("Failed to save clips:", err.message);
    }
  }

  add(content) {
    this.clips = this.clips.filter((c) => c.content !== content);
    const clip = {
      id: this.uuid(),
      content,
      createdAt: this.now(),
    };
    this.clips.unshift(clip);
    while (this.clips.length > this.maxClips) {
      this.clips.pop();
    }
    this.save();
    return clip;
  }

  // Move an existing clip to the top (used when the user picks it from the list).
  promote(id) {
    const idx = this.clips.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const [clip] = this.clips.splice(idx, 1);
    clip.createdAt = this.now();
    this.clips.unshift(clip);
    this.save();
    return clip;
  }

  findById(id) {
    return this.clips.find((c) => c.id === id);
  }

  deleteById(id) {
    const idx = this.clips.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.clips.splice(idx, 1);
    this.save();
    return true;
  }

  clear() {
    this.clips = [];
    this.save();
  }

  getAll() {
    return this.clips;
  }

  _ensureDir() {
    const dir = require("path").dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

module.exports = ClipboardStore;
