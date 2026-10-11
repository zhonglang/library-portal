const pans = [
  { key: "quark_url", label: "夸克网盘", tone: "quark" },
  { key: "baidu_url", label: "百度网盘", tone: "baidu" },
  { key: "xunlei_url", label: "迅雷网盘", tone: "xunlei" },
];

const copyLabels = [
  ["渡", "baidu_url"],
  ["跨", "quark_url"],
  ["汛", "xunlei_url"],
];

const queryInput = document.querySelector("#query");
const list = document.querySelector("#list");
const count = document.querySelector("#count");
const errorBox = document.querySelector("#error");
const toast = document.querySelector("#toast");

let items = [];
let filter = "all";
let toastTimer = 0;

function loose(value) {
  return value.toLowerCase().replace(/[\s《》【】[\]()（）·,，.。!！?？:：\-—_]/g, "");
}

function filled(item, key) {
  return item[key].trim().length > 0;
}

function linkCount(item) {
  return pans.filter((pan) => filled(item, pan.key)).length;
}

function matches(item) {
  if (filter === "complete" && linkCount(item) !== pans.length) return false;
  if (filter === "quark" && !filled(item, "quark_url")) return false;
  if (filter === "baidu" && !filled(item, "baidu_url")) return false;
  if (filter === "xunlei" && !filled(item, "xunlei_url")) return false;
  const needle = loose(queryInput.value.trim());
  if (!needle) return true;
  return loose(item.name).includes(needle) || item.prefix.includes(queryInput.value.trim());
}

function showToast(message) {
  toast.hidden = false;
  toast.textContent = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 1800);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("已复制");
  } catch {
    showToast("复制失败");
  }
}

function render() {
  const visible = items.filter(matches);
  count.textContent = `共 ${visible.length} 部资源`;
  list.replaceChildren();
  if (visible.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = items.length === 0 ? "还没有资源" : "没有符合条件的资源。";
    list.append(empty);
    return;
  }
  for (const item of visible) {
    const card = document.createElement("article");
    card.className = "card";

    const head = document.createElement("div");
    head.className = "card-head";
    const badge = document.createElement("span");
    badge.className = "prefix";
    badge.textContent = item.prefix;
    const title = document.createElement("h2");
    title.textContent = item.name.trim() || "未填写名称";
    const copyAll = document.createElement("button");
    copyAll.type = "button";
    copyAll.className = "copy-all";
    copyAll.textContent = "复制全部";
    const lines = copyLabels
      .filter(([, key]) => filled(item, key))
      .map(([label, key]) => `${label}：${item[key].trim()}`);
    copyAll.disabled = lines.length === 0;
    copyAll.addEventListener("click", () => void copyText(lines.join("\n")));
    head.append(badge, title, copyAll);

    const row = document.createElement("div");
    row.className = "pans";
    for (const pan of pans) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = pan.label;
      const url = item[pan.key].trim();
      if (url) {
        button.className = pan.tone;
        button.addEventListener("click", () => void copyText(url));
      } else {
        button.disabled = true;
      }
      row.append(button);
    }

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "点网盘名即复制";
    card.append(head, row, hint);
    list.append(card);
  }
}

document.querySelectorAll(".filters button").forEach((button) => {
  button.addEventListener("click", () => {
    filter = button.dataset.filter;
    document.querySelectorAll(".filters button").forEach((item) => {
      item.classList.toggle("is-on", item === button);
    });
    render();
  });
});

queryInput.addEventListener("input", render);

fetch("/api/items")
  .then(async (response) => {
    if (!response.ok) throw new Error("暂时无法读取资源");
    return response.json();
  })
  .then((rows) => {
    items = rows;
    render();
  })
  .catch((caught) => {
    count.textContent = "共 0 部资源";
    errorBox.hidden = false;
    errorBox.textContent = caught instanceof Error ? caught.message : "暂时无法读取资源";
  });
