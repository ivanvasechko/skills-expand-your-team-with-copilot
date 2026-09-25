const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appScript = fs.readFileSync(
  path.join(__dirname, "..", "src", "static", "app.js"),
  "utf8"
);

class ClassList {
  constructor(initial = []) {
    this.classes = new Set(initial);
  }

  add(...names) {
    names.forEach((name) => this.classes.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.classes.delete(name));
  }

  toggle(name, force) {
    if (force === true) {
      this.classes.add(name);
      return true;
    }

    if (force === false) {
      this.classes.delete(name);
      return false;
    }

    if (this.classes.has(name)) {
      this.classes.delete(name);
      return false;
    }

    this.classes.add(name);
    return true;
  }

  contains(name) {
    return this.classes.has(name);
  }
}

function createElement({ id = "", classNames = [], dataset = {} } = {}) {
  const listeners = {};
  let className = classNames.join(" ");

  const element = {
    id,
    dataset: { ...dataset },
    style: {},
    children: [],
    innerHTML: "",
    textContent: "",
    value: "",
    disabled: false,
    title: "",
    attributes: {},
    classList: new ClassList(classNames),
    addEventListener(type, listener) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(listener);
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return this.attributes[name] ?? null;
    },
    click() {
      (listeners.click || []).forEach((listener) =>
        listener({ target: this, preventDefault() {} })
      );
    },
    reset() {
      this.value = "";
    },
  };

  Object.defineProperty(element, "className", {
    get() {
      return className;
    },
    set(value) {
      className = value;
    },
  });

  return element;
}

function createStorage({ values = {}, failGet = false, failSet = false } = {}) {
  const store = { ...values };

  return {
    getItem(key) {
      if (failGet) {
        throw new Error("Storage unavailable");
      }

      return Object.prototype.hasOwnProperty.call(store, key)
        ? store[key]
        : null;
    },
    setItem(key, value) {
      if (failSet) {
        throw new Error("Storage unavailable");
      }

      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
  };
}

async function loadApp({
  storageValues = {},
  failGet = false,
  failSet = false,
  prefersDarkMode = false,
} = {}) {
  const elements = {
    "activities-list": createElement({ id: "activities-list" }),
    message: createElement({ id: "message", classNames: ["hidden", "message"] }),
    "registration-modal": createElement({
      id: "registration-modal",
      classNames: ["modal", "hidden"],
    }),
    "modal-activity-name": createElement({ id: "modal-activity-name" }),
    "signup-form": createElement({ id: "signup-form" }),
    activity: createElement({ id: "activity" }),
    "activity-search": createElement({ id: "activity-search" }),
    "search-button": createElement({ id: "search-button" }),
    "login-button": createElement({ id: "login-button" }),
    "user-info": createElement({ id: "user-info", classNames: ["hidden"] }),
    "display-name": createElement({ id: "display-name" }),
    "logout-button": createElement({ id: "logout-button" }),
    "login-modal": createElement({
      id: "login-modal",
      classNames: ["modal", "hidden"],
    }),
    "login-form": createElement({ id: "login-form" }),
    "login-message": createElement({
      id: "login-message",
      classNames: ["hidden", "message"],
    }),
    username: createElement({ id: "username" }),
    password: createElement({ id: "password" }),
    email: createElement({ id: "email" }),
    "theme-toggle": createElement({ id: "theme-toggle" }),
    "theme-toggle-icon": createElement({ id: "theme-toggle-icon" }),
    "theme-toggle-text": createElement({ id: "theme-toggle-text" }),
  };

  const closeModal = createElement({ classNames: ["close-modal"] });
  const closeLoginModal = createElement({ classNames: ["close-login-modal"] });
  const activeCategory = createElement({
    classNames: ["category-filter", "active"],
    dataset: { category: "all" },
  });
  const activeDay = createElement({
    classNames: ["day-filter", "active"],
    dataset: { day: "" },
  });
  const activeTime = createElement({
    classNames: ["time-filter", "active"],
    dataset: { time: "" },
  });

  const querySelectors = {
    ".close-modal": closeModal,
    ".close-login-modal": closeLoginModal,
    ".day-filter.active": activeDay,
    ".time-filter.active": activeTime,
  };

  const querySelectorAllMap = {
    ".category-filter": [activeCategory],
    ".day-filter": [activeDay],
    ".time-filter": [activeTime],
  };

  const documentListeners = {};
  const body = createElement();
  const document = {
    body,
    addEventListener(type, listener) {
      documentListeners[type] = listener;
    },
    getElementById(id) {
      return elements[id] || null;
    },
    querySelector(selector) {
      return querySelectors[selector] || null;
    },
    querySelectorAll(selector) {
      return querySelectorAllMap[selector] || [];
    },
    createElement() {
      return createElement();
    },
  };

  const storage = createStorage({
    values: storageValues,
    failGet,
    failSet,
  });

  const windowListeners = {};
  const windowObject = {
    document,
    localStorage: storage,
    console,
    addEventListener(type, listener) {
      windowListeners[type] = listener;
    },
    matchMedia(query) {
      return {
        matches: prefersDarkMode && query === "(prefers-color-scheme: dark)",
      };
    },
  };

  const context = {
    window: windowObject,
    document,
    localStorage: storage,
    console,
    fetch: async () => ({
      ok: true,
      json: async () => ({}),
    }),
    setTimeout(callback) {
      callback();
      return 0;
    },
    clearTimeout() {},
    encodeURIComponent,
  };

  vm.runInNewContext(appScript, context);
  documentListeners.DOMContentLoaded();
  await Promise.resolve();
  await Promise.resolve();

  return { windowObject, document, elements };
}

test("saved dark theme initializes the page in dark mode", async () => {
  const { document, elements } = await loadApp({
    storageValues: { preferredTheme: "dark" },
  });

  assert.equal(document.body.classList.contains("dark-mode"), true);
  assert.equal(elements["theme-toggle-text"].textContent, "Light mode");
  assert.equal(elements["theme-toggle"].getAttribute("aria-pressed"), "true");
  assert.equal(elements["theme-toggle"].getAttribute("aria-label"), "Light mode");
});

test("storage read failures fall back without breaking initialization", async () => {
  const { document, elements, windowObject } = await loadApp({ failGet: true });

  assert.equal(document.body.classList.contains("dark-mode"), false);
  assert.equal(elements["theme-toggle-text"].textContent, "Dark mode");
  assert.ok(windowObject.activityFilters);
});

test("system preference is used when no saved theme exists", async () => {
  const { document, elements } = await loadApp({ prefersDarkMode: true });

  assert.equal(document.body.classList.contains("dark-mode"), true);
  assert.equal(elements["theme-toggle-text"].textContent, "Light mode");
});

test("theme toggle still updates the page when saving fails", async () => {
  const { document, elements } = await loadApp({ failSet: true });

  elements["theme-toggle"].click();

  assert.equal(document.body.classList.contains("dark-mode"), true);
  assert.equal(elements["theme-toggle-text"].textContent, "Light mode");
});
