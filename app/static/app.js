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

const todayCopyButtons = [
  { key: "baidu_url", label: "百度", tone: "baidu" },
  { key: "quark_url", label: "夸克", tone: "quark" },
  { key: "xunlei_url", label: "迅雷", tone: "xunlei" },
];

const queryInput = document.querySelector("#query");
const list = document.querySelector("#list");
const count = document.querySelector("#count");
const errorBox = document.querySelector("#error");
const toast = document.querySelector("#toast");
const refreshBtn = document.querySelector("#refresh");
const todayBtn = document.querySelector("#today");
const todayModal = document.querySelector("#today-modal");
const todayList = document.querySelector("#today-list");

let items = [];
let filter = "all";
let toastTimer = 0;
let loading = false;

function loose(value) {
  return value.toLowerCase().replace(/[\s《》【】[\]()（）·,，.。!！?？:：\-—_]/g, "");
}

function filled(item, key) {
  return String(item[key] || "").trim().length > 0;
}

function linkCount(item) {
  return pans.filter((pan) => filled(item, pan.key)).length;
}

function cleanCopyName(name) {
  return String(name || "")
    .replace(/#完结/g, "")
    .replace(/#\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function progressPills(item) {
  const finished = Boolean(item.finished);
  const latest = item.latest_episode;
  const pills = [];
  if (finished) {
    pills.push({ text: "完结", tone: "done" });
    if (latest != null) pills.push({ text: `${latest} 集`, tone: "episode" });
  } else if (latest != null) {
    pills.push({ text: "更新中", tone: "airing" });
    pills.push({ text: `至 ${latest} 集`, tone: "episode" });
  }
  return pills;
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

function shanghaiDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isTodayUpdated(item) {
  if (item.previous_episode == null || item.latest_episode == null) return false;
  if (item.previous_episode === item.latest_episode) return false;
  if (!item.updated_at) return false;
  return shanghaiDateKey(item.updated_at) === shanghaiDateKey(new Date());
}

function episodeLabel(value) {
  return value == null ? "—" : `${value}`;
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
  count.textContent = loading ? "正在读取" : `共 ${visible.length} 部资源`;
  list.replaceChildren();
  if (loading) return;
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
    const meta = document.createElement("div");
    meta.className = "card-meta";
    const title = document.createElement("h2");
    title.textContent = item.name.trim() || "未填写名称";
    meta.append(title);
    const pills = progressPills(item);
    if (pills.length) {
      const row = document.createElement("div");
      row.className = "progress";
      for (const pill of pills) {
        const mark = document.createElement("span");
        mark.className = `pill pill-${pill.tone}`;
        mark.textContent = pill.text;
        row.append(mark);
      }
      meta.append(row);
    }
    const copyAll = document.createElement("button");
    copyAll.type = "button";
    copyAll.className = "copy-all";
    copyAll.textContent = "复制全部";
    const lines = copyLabels
      .filter(([, key]) => filled(item, key))
      .map(([label, key]) => `${label}：${item[key].trim()}`);
    copyAll.disabled = lines.length === 0;
    copyAll.addEventListener("click", () => void copyText(lines.join("\n")));
    head.append(badge, meta, copyAll);

    const row = document.createElement("div");
    row.className = "pans";
    for (const pan of pans) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = pan.label;
      const url = String(item[pan.key] || "").trim();
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

function renderTodayModal() {
  const rows = items.filter(isTodayUpdated).sort((left, right) => {
    const leftKey = Number.parseInt(left.prefix, 10);
    const rightKey = Number.parseInt(right.prefix, 10);
    if (Number.isFinite(leftKey) && Number.isFinite(rightKey) && leftKey !== rightKey) {
      return leftKey - rightKey;
    }
    return String(left.prefix).localeCompare(String(right.prefix), "zh-CN");
  });
  todayList.replaceChildren();
  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "today-empty";
    empty.textContent = "今天还没有集数更新。";
    todayList.append(empty);
    return;
  }
  for (const item of rows) {
    const row = document.createElement("div");
    row.className = "today-row";

    const main = document.createElement("div");
    main.className = "today-main";

    const prefix = document.createElement("span");
    prefix.className = "today-prefix";
    prefix.textContent = item.prefix;

    const title = document.createElement("div");
    title.className = "today-title";
    title.textContent = cleanCopyName(item.name) || "未填写名称";

    const change = document.createElement("div");
    change.className = "today-change";
    const prev = document.createElement("span");
    prev.className = "today-ep today-ep-old";
    prev.textContent = episodeLabel(item.previous_episode);
    const arrow = document.createElement("span");
    arrow.className = "today-arrow";
    arrow.textContent = "→";
    const next = document.createElement("span");
    next.className = "today-ep today-ep-new";
    next.textContent = episodeLabel(item.latest_episode);
    change.append(prev, arrow, next);

    main.append(prefix, title, change);

    const actions = document.createElement("div");
    actions.className = "today-actions";
    for (const pan of todayCopyButtons) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = pan.label;
      const url = String(item[pan.key] || "").trim();
      if (url) {
        button.className = pan.tone;
        button.addEventListener("click", () => void copyText(url));
      } else {
        button.disabled = true;
      }
      actions.append(button);
    }
    const copyAll = document.createElement("button");
    copyAll.type = "button";
    copyAll.className = "all";
    copyAll.textContent = "全部复制";
    const lines = copyLabels
      .filter(([, key]) => filled(item, key))
      .map(([label, key]) => `${label}：${item[key].trim()}`);
    copyAll.disabled = lines.length === 0;
    copyAll.addEventListener("click", () => void copyText(lines.join("\n")));
    actions.append(copyAll);

    row.append(main, actions);
    todayList.append(row);
  }
}

function openTodayModal() {
  renderTodayModal();
  todayModal.hidden = false;
}

function closeTodayModal() {
  todayModal.hidden = true;
}

async function loadItems() {
  loading = true;
  refreshBtn.disabled = true;
  refreshBtn.textContent = "正在刷新";
  errorBox.hidden = true;
  render();
  try {
    const response = await fetch("/api/items");
    if (!response.ok) throw new Error("暂时无法读取资源");
    items = await response.json();
    errorBox.hidden = true;
  } catch (caught) {
    items = [];
    errorBox.hidden = false;
    errorBox.textContent = caught instanceof Error ? caught.message : "暂时无法读取资源";
  } finally {
    loading = false;
    refreshBtn.disabled = false;
    refreshBtn.textContent = "刷新";
    render();
    if (!todayModal.hidden) renderTodayModal();
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
refreshBtn.addEventListener("click", () => void loadItems());
todayBtn.addEventListener("click", openTodayModal);
todayModal.querySelectorAll("[data-close='today']").forEach((node) => {
  node.addEventListener("click", closeTodayModal);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !todayModal.hidden) closeTodayModal();
});

void loadItems();
