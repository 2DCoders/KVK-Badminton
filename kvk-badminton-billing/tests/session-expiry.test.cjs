const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const axios = require("axios");

const source = fs.readFileSync(path.join(__dirname, "../src/services/session-expiry.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: false, target: ts.ScriptTarget.ES2022 },
}).outputText;

function setup(accountKey = "cashier") {
  const client = axios.create();
  const storage = new Map([["admin", "admin-session"], ["cashier", "cashier-session"], ["dayEndData", "day-session"], ["preferences", "keep"]]);
  const redirects = [];
  const moduleOutput = { exports: {} };
  new Function("require", "module", "exports", "localStorage", "window", compiled)(
    () => ({ default: client }), moduleOutput, moduleOutput.exports,
    { removeItem: (key) => storage.delete(key) },
    { location: { replace: (url) => redirects.push(url) } },
  );
  const session = moduleOutput.exports;
  session.installSessionExpiryHandler(accountKey);
  const fail = (status, url = "/protected") => {
    client.defaults.adapter = (config) => Promise.reject(new axios.AxiosError(
      "Request failed", "ERR_BAD_RESPONSE", config, null,
      { status, data: {}, headers: {}, statusText: "Error", config },
    ));
    return client.get(url);
  };
  return { client, session, storage, redirects, fail };
}

test("protected 401 expires the cashier session, preserves unrelated data, and rejects the request", async () => {
  const { fail, session, storage } = setup();
  let notifications = 0;
  session.subscribeToSessionExpiry(() => { notifications++; });
  await assert.rejects(fail(401), (error) => error.response.status === 401);
  assert.equal(session.getSessionExpired(), true);
  assert.equal(notifications, 1);
  assert.equal(storage.has("cashier"), false);
  assert.equal(storage.has("dayEndData"), false);
  assert.equal(storage.get("preferences"), "keep");
  assert.equal(storage.get("admin"), "admin-session");
});

test("admin expiration removes only admin credentials", async () => {
  const { fail, storage } = setup("admin");
  await assert.rejects(fail(401));
  assert.equal(storage.has("admin"), false);
  assert.equal(storage.get("cashier"), "cashier-session");
  assert.equal(storage.get("dayEndData"), "day-session");
});

test("parallel unauthorized responses show one session-expiry notification", async () => {
  const { fail, session } = setup();
  let notifications = 0;
  session.subscribeToSessionExpiry(() => { notifications++; });
  await Promise.allSettled([fail(401), fail(401), fail(401)]);
  assert.equal(notifications, 1);
});

test("invalid login credentials do not expire the session", async () => {
  const { fail, session, storage } = setup();
  for (const url of ["https://api.example/identity-m/auth/staff/login", "/staff/login/", "/staff/login?module=Gym"]) {
    await assert.rejects(fail(401, url));
  }
  assert.equal(session.getSessionExpired(), false);
  assert.equal(storage.get("cashier"), "cashier-session");
});

test("403, server errors, and network errors preserve the session", async () => {
  const { fail, client, session } = setup();
  for (const status of [403, 404, 500]) await assert.rejects(fail(status));
  client.defaults.adapter = () => Promise.reject(new axios.AxiosError("Network error", "ERR_NETWORK"));
  await assert.rejects(client.get("/protected"));
  assert.equal(session.getSessionExpired(), false);
});

test("successful responses pass through unchanged", async () => {
  const { client, session } = setup();
  client.defaults.adapter = async (config) => ({ data: { ok: true }, status: 200, statusText: "OK", headers: {}, config });
  assert.deepEqual((await client.get("/protected")).data, { ok: true });
  assert.equal(session.getSessionExpired(), false);
});

test("installation is idempotent and unsubscribed listeners are not called", async () => {
  const { client, session, fail } = setup();
  session.installSessionExpiryHandler("cashier");
  assert.equal(client.interceptors.response.handlers.filter(Boolean).length, 1);
  let notifications = 0;
  const unsubscribe = session.subscribeToSessionExpiry(() => { notifications++; });
  unsubscribe();
  await assert.rejects(fail(401));
  assert.equal(notifications, 0);
});

test("login action replaces history with the app's login route", () => {
  const { session, redirects } = setup();
  session.redirectToLogin();
  assert.deepEqual(redirects, ["/"]);
});

function loadBoundary(expired) {
  const React = require("react");
  const effects = [];
  const redirects = [];
  const dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  const componentSource = fs.readFileSync(path.join(__dirname, "../src/components/session-expiry/index.tsx"), "utf8");
  const componentCode = ts.transpileModule(componentSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: false, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", componentCode)((name) => {
    if (name === "react") return {
      ...React,
      useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
      useRef: () => ({ current: dialog }),
      useEffect: (effect) => effects.push(effect),
    };
    if (name === "../../services/session-expiry") return {
      getSessionExpired: () => expired,
      subscribeToSessionExpiry: () => () => {},
      redirectToLogin: () => redirects.push("/"),
    };
    if (name === "lucide-react") return { LockKeyhole: () => null };
    return require(name);
  }, loaded, loaded.exports);
  return { Boundary: loaded.exports.default, effects, redirects, dialog };
}

test("the boundary preserves the app while authenticated", () => {
  const { Boundary } = loadBoundary(false);
  const children = require("react").createElement("main", null, "Protected app");
  assert.equal(Boundary({ children }), children);
});

test("expired sessions replace protected content with an accessible modal and login action", () => {
  const { Boundary, effects, redirects, dialog } = loadBoundary(true);
  const element = Boundary({ children: "Protected app" });
  const html = require("react-dom/server").renderToStaticMarkup(element);
  assert.match(html, /<dialog/);
  assert.match(html, /Session expired/);
  assert.match(html, /aria-labelledby="session-expired-title"/);
  assert.match(html, /aria-describedby="session-expired-description"/);
  assert.doesNotMatch(html, /Protected app/);
  const cleanup = effects[0]();
  assert.equal(dialog.open, true);
  cleanup();
  assert.equal(dialog.open, false);
  const button = element.props.children.find((child) => child.type === "button");
  assert.equal(button.props.autoFocus, true);
  button.props.onClick();
  assert.deepEqual(redirects, ["/"]);
});

test("Escape sends the user to login instead of dismissing the expired-session modal", () => {
  const { Boundary, redirects } = loadBoundary(true);
  let prevented = false;
  Boundary({ children: null }).props.onCancel({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(redirects, ["/"]);
});
