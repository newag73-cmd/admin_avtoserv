(() => {
  const script = document.currentScript;
  if (!script || document.querySelector("[data-ai-business-widget-root]")) return;
  const widgetUrl = script.dataset.widgetUrl || new URL("/widget", script.src).toString();
  const root = document.createElement("div");
  root.dataset.aiBusinessWidgetRoot = "";
  const shadow = root.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `:host{all:initial;position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:system-ui,sans-serif}.launcher{border:0;border-radius:28px;padding:13px 18px;background:#1f4e79;color:white;box-shadow:0 5px 20px #0003;cursor:pointer;font:600 14px system-ui}.panel{display:none;position:fixed;right:20px;bottom:82px;width:380px;height:600px;max-height:calc(100vh - 110px);border:1px solid #ccd5de;border-radius:16px;overflow:hidden;background:white;box-shadow:0 12px 50px #12243a30}.panel[data-open=true]{display:block}.panel[data-position=top-left]{top:82px;left:20px;right:auto;bottom:auto}.panel[data-position=top-right]{top:82px;right:20px;left:auto;bottom:auto}.panel[data-position=bottom-left]{bottom:82px;left:20px;right:auto;top:auto}iframe{border:0;width:100%;height:100%;display:block}@media(max-width:600px){:host{right:14px;bottom:14px}.panel{inset:0;width:100vw;height:100dvh;max-height:none;border-radius:0!important}}`;
  const panel = document.createElement("div"); panel.className = "panel"; panel.dataset.open = "false";
  const frame = document.createElement("iframe"); frame.src = widgetUrl; frame.title = script.dataset.title || "Чат с администратором"; frame.loading = "lazy";
  const button = document.createElement("button"); button.className = "launcher"; button.type = "button"; button.textContent = script.dataset.label || "Задать вопрос"; button.setAttribute("aria-expanded", "false");
  fetch(new URL("/api/widget-config", widgetUrl).toString(), { mode: "cors" }).then(r => r.ok ? r.json() : null).then(data => { if (!data?.widget) return; button.textContent = data.widget.button_label; button.style.background = data.widget.accent_color; frame.title = data.widget.title; panel.dataset.position = data.widget.position || "bottom-right"; const pos = data.widget.position || "bottom-right"; root.style.left = pos.endsWith("left") ? "20px" : "auto"; root.style.right = pos.endsWith("right") ? "20px" : "auto"; root.style.top = pos.startsWith("top") ? "20px" : "auto"; root.style.bottom = pos.startsWith("bottom") ? "20px" : "auto"; });
  button.addEventListener("click", () => { const opened = panel.dataset.open !== "true"; panel.dataset.open = String(opened); button.setAttribute("aria-expanded", String(opened)); if (opened && !panel.contains(frame)) panel.append(frame); });
  window.addEventListener("message", event => { if (event.source === frame.contentWindow && event.data?.type === "ai-business-widget-close") { panel.dataset.open = "false"; button.setAttribute("aria-expanded", "false"); button.focus(); } });
  panel.addEventListener("keydown", event => { if (event.key === "Escape") { panel.dataset.open = "false"; button.setAttribute("aria-expanded", "false"); button.focus(); } });
  shadow.append(style, panel, button); document.body.append(root);
})();
