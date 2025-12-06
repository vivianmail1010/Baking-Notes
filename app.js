// app.js
// --- 資料 model ---
let recipes = [];
let logs = [];
let refRecipes = [];   // 參考食譜
let labNotes = [];     // 實驗筆記

// 新增 / 編輯食譜頁面用的暫存材料 & 器材
let tempIngredients = [];
let baselineIngredientId = null;
let tempEquipment = [];

// 目前是否在編輯模式（儲存要更新哪一筆）
let editingRecipeId = null;

const STORAGE_KEY = "baking-notes-v1";

// ===== 流程庫刪除確認用 =====
let stepModuleIdPendingDelete = null;

function openStepDeleteConfirm(id) {
  stepModuleIdPendingDelete = id;
  const backdrop = document.getElementById("step-confirm-backdrop");
  const dialog = document.getElementById("step-confirm-dialog");
  if (backdrop) backdrop.classList.add("show");
  if (dialog) dialog.classList.add("show");
}

function closeStepDeleteConfirm() {
  stepModuleIdPendingDelete = null;
  const backdrop = document.getElementById("step-confirm-backdrop");
  const dialog = document.getElementById("step-confirm-dialog");
  if (backdrop) backdrop.classList.remove("show");
  if (dialog) dialog.classList.remove("show");
}

// --------- 預設會出現在 App 裡的食譜（基底配方 / 常用配方） ---------
const defaultRecipes = [
  {
    id: "base-butter-cookie-dough",    // 固定 ID，避免重複
    name: "基本奶油餅乾麵糊",
    category: "基底配方",
    sourceType: "personal",
    serving: "",
    steps: `奶油回溫打發到顏色變淺。
分次加入糖粉與蛋拌勻。
加入過篩麵粉拌成麵糊，冷藏鬆弛。`,
    ingredients: [
      { name: "無鹽奶油", amount: 200, unit: "g" },
      { name: "糖粉", amount: 80, unit: "g" },
      { name: "低筋麵粉", amount: 250, unit: "g" },
      { name: "全蛋", amount: 1, unit: "顆" }
    ],
    baselineIngredientId: null,
    equipment: []
  },

  // ⬇️ 預設食譜例子：巧克力磅蛋糕
  {
    id: "choco-pound-cake",              // 全英文＋有意義，保持全 app 唯一
    name: "巧克力磅蛋糕",
    category: "蛋糕",                    // 要跟你上面「分類按鈕」一致：餅乾 / 蛋糕 / 麵包 / 塔 / 派 / 其他
    sourceType: "personal",
    serving: "一條模（約8片）",
    notes: "濕潤款巧克力磅蛋糕，適合加堅果或巧克力豆。",
    ingredients: [
      { name: "無鹽奶油（室溫）", amount: 120, unit: "g" },
      { name: "細砂糖", amount: 90, unit: "g" },
      { name: "全蛋", amount: 2, unit: "顆" },       // 顆數用顆，換算自己心裡知道約 100g
      { name: "低筋麵粉", amount: 120, unit: "g" },
      { name: "可可粉", amount: 20, unit: "g" },
      { name: "泡打粉", amount: 3, unit: "g" },
      { name: "牛奶", amount: 40, unit: "g" },       // 這裡用 g / ml 都可以，反正是 1:1
      { name: "黑巧克力豆（可省略）", amount: 40, unit: "g" },
    ],
    steps: `1. 烤箱預熱 170°C，上下火。磅蛋糕模抹油鋪紙。
2. 奶油打發到泛白，分次加入細砂糖打至蓬鬆。
3. 分2～3次加入打散的蛋液，每次都要拌到完全乳化。
4. 將低筋麵粉、可可粉、泡打粉一起過篩，分兩次拌入。
5. 中間交替加入牛奶，翻拌到沒有粉粒（不要過度攪拌）。
6. 拌入巧克力豆，入模，抹平表面。
7. 170°C 烤約 40～45 分鐘，竹籤插入無沾黏即可。`,
    baselineIngredientId: null,
    equipment: []
  }
];


// 把預設食譜轉成真正放在 recipes 陣列裡的格式
function buildRecipeFromDefault(def) {
  return {
    id: def.id,
    name: def.name,
    category: def.category || "其他",
    source: def.source || "",
    sourceType: def.sourceType || "personal",
    proAuthor: def.proAuthor || "",
    serving: def.serving || "",
    steps: (def.steps || "").trim(),
    ingredients: (def.ingredients || []).map(ing => ({
      id: createId(),
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit || ""
    })),
    equipment: def.equipment ? def.equipment.slice() : [],
    baselineIngredientId: def.baselineIngredientId || null,
    createdAt: Date.now(),
    ratio: 1,
    pinned: false
  };
}

// 確保 defaultRecipes 都有被加進 recipes，但不重複
function ensureDefaultRecipes() {
  const existingIds = new Set(recipes.map(r => r.id));
  defaultRecipes.forEach(def => {
    if (!existingIds.has(def.id)) {
      recipes.push(buildRecipeFromDefault(def));
    }
  });
}

// ---------- 流程庫：預設模組 ----------
const defaultStepModules = [
  {
    id: "general-oven-cookie",
    title: "餅乾基本流程（打發法）",
    tags: ["餅乾", "通用"],
    steps: [
      "烤箱預熱至 170〜180℃，烤盤鋪烘焙紙。",
      "奶油回溫至軟（但不融化），用打蛋器打到顏色變淺、體積微膨。",
      "分次加入糖粉或細砂糖，打到略帶膨鬆、糖顆粒大致溶解。",
      "分次加入常溫全蛋，每次都要完全乳化、看不到蛋液分離才加下一次。",
      "加入過篩的粉類（低筋麵粉＋杏仁粉/玉米粉等），用刮刀切拌壓拌到粉類剛好看不到即可。",
      "如果要加巧克力豆、堅果、乾果，此時拌入。",
      "用擠花袋擠出形狀，或分割搓圓、壓扁整形。",
      "送入烤箱，烤至邊緣上色、中心定型，出爐放涼。"
    ]
  },
  {
    id: "sponge-cake-basic",
    title: "海綿蛋糕基本流程（全蛋打發）",
    tags: ["蛋糕"],
    steps: [
      "烤箱預熱至 170℃，模具鋪紙或抹油撒粉。",
      "全蛋＋糖放在同一盆，隔水加熱至約 40℃，幫助打發。",
      "用攪拌機高速打發至顏色變淺、體積膨脹 2〜3 倍、提起有明顯紋路。",
      "改低速，把氣泡微調細緻、穩定。",
      "分次加入過篩低筋麵粉，用刮刀從底部翻拌，不要畫圈攪。",
      "加入融化奶油或植物油（通常和一小部分麵糊先拌勻，再回倒主麵糊），翻拌均勻。",
      "倒入模具，輕震兩下排大氣泡。",
      "送入烤箱烤至竹籤插入無沾黏，出爐後視配方決定是否倒扣。"
    ]
  },
  {
    id: "brownie-basic",
    title: "布朗尼 / 濕潤巧克力蛋糕基本流程",
    tags: ["巧克力", "蛋糕"],
    steps: [
      "烤箱預熱至 170℃，模具鋪烘焙紙。",
      "黑巧克力＋奶油隔水或微波加熱融化，攪拌至滑順。",
      "加入糖、鹽拌勻（有些配方這一步就開始降溫）。",
      "分次加入全蛋或蛋黃，攪拌至完全融合、光滑。",
      "加入過篩的麵粉、可可粉，摺拌到看不到粉即可，不要過度攪拌。",
      "可加入堅果、巧克力豆，輕拌。",
      "倒入模具抹平，送入烤箱烤至表面定型、中間仍微濕潤。",
      "完全放涼後再切塊，口感會更穩定。"
    ]
  },
  {
    id: "matcha-nama-chocolate",
    title: "生巧克力（抹茶）",
    tags: ["巧克力"],
    steps: [
      "白巧克力與抹茶粉放入耐熱鋼盆，隔水融化。（水溫不可超過 50℃ ）",
      "黃油、淡奶油加熱，奶鍋 ≤70℃ （不可超過 70℃ ）",
      "一次性倒入融化的巧克力盆，快速攪拌均勻",
      "放到擠花袋，擠入模具並冷凍過夜",
      "脫模撒上少許茶粉"
    ]
  },
  {
    id: "nama-chocolate",
    title: "生巧克力",
    tags: ["巧克力"],
    steps: [
      "淡奶油+黃油+葡萄糖漿放入耐熱鋼盆隔水加熱",
      "加熱溫度約 ≤70℃ ，全部完全融化（不可超過 70℃ ）",
      "加入巧克力鈕扣，溫度約 ≤50℃ （不可超過50℃）",
      "移開熱源，持續攪拌讓溫度自然下降至約 27℃ 左右。攪拌至均勻細膩",
      "加入調味酒（萊姆酒）也可不加",
      "此時巧克力應該光滑、流動性佳，倒入模具或用於裹層。",
      "完成後放室溫或陰涼處結晶，不建議冰箱急冷（容易起霜）",
      "冷凍10小時以上，過夜",
      "脱模，撒上少許可可粉"
    ]
  },
  {
    id: "chocolate-tempering-basic",
    title: "手工巧克力調溫流程（簡化版）",
    tags: ["巧克力"],
    steps: [
      "切碎巧克力，放入耐熱鋼盆。",
      "隔水加熱至約 45〜50℃（依品牌略有差異），全部完全融化。",
      "移開熱源，持續攪拌讓溫度自然下降至約 27℃ 左右。",
      "再微微加熱回到 31〜32℃（黑巧）或 29〜30℃（牛奶／白巧）。",
      "此時巧克力應該光滑、流動性佳，倒入模具或用於裹層。",
      "完成後放室溫或陰涼處結晶，不建議冰箱急冷（容易起霜）。"
    ]
  }
];

// ✅ 使用者自己新增的流程模組
let stepsLibrary = [];

let currentStepTagFilter = "全部";

// ---------- LocalStorage ----------
function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);

  // 第一次使用：給預設食譜 + 空的流程模組
  if (!raw) {
    recipes = defaultRecipes.map(buildRecipeFromDefault);
    logs = [];
    refRecipes = [];
    labNotes = [];
    stepsLibrary = [];
    return;
  }

  try {
    const parsed = JSON.parse(raw);

    recipes      = parsed.recipes      || [];
    logs         = parsed.logs         || [];
    refRecipes   = parsed.refRecipes   || [];
    labNotes     = parsed.labNotes     || [];
    stepsLibrary = parsed.stepsLibrary || [];

    // 確保預設食譜存在
    ensureDefaultRecipes();
  } catch (e) {
    console.error("載入資料失敗：", e);
  }
}

function saveData() {
  const payload = {
    recipes,
    logs,
    refRecipes,
    labNotes,
    stepsLibrary
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

// ---------- 流程庫 render ----------
function getAllStepModules() {
  return [...stepsLibrary, ...defaultStepModules];
}

function renderStepModules() {
  const container = document.getElementById("steps-modules-list");
  if (!container) return;

  container.innerHTML = "";

  const allModules = getAllStepModules();

  const filtered = allModules.filter((mod) => {
    if (currentStepTagFilter === "全部") return true;
    return mod.tags && mod.tags.includes(currentStepTagFilter);
  });

  if (!filtered.length) {
    container.innerHTML =
      `<p class="empty-text">目前沒有符合這個類型的流程，可以新增一個自己的模組 ✨</p>`;
    return;
  }

  filtered.forEach((mod) => {
    const div = document.createElement("div");

    const isCustom = !defaultStepModules.some((d) => d.id === mod.id);

    // 自訂的流程多一個 custom class，等等用來當 draggable 目標
    div.className = "step-module-card" + (isCustom ? " custom" : "");

    if (isCustom) {
      div.dataset.id = mod.id;  // 拖曳後用這個 id 來重排 stepsLibrary
    }

    const tagBadges = (mod.tags || [])
      .map((t) => `<span class="tag-badge">${t}</span>`)
      .join("");

    const stepsHtml = (mod.steps || [])
      .map((s) => `<li>• ${s}</li>`)
      .join("");

    div.innerHTML = `
      <div class="step-module-header">
        <h3>${mod.title}</h3>
        <div class="tag-row">${tagBadges}</div>
      </div>
      <ol class="step-module-steps">
        ${stepsHtml}
      </ol>
      <div class="step-module-actions">
        ${isCustom
          ? `<button class="delete-step-module-btn" data-id="${mod.id}">刪除</button>`
          : ""}
      </div>
    `;

    container.appendChild(div);
  });

  // 刪除按鈕 → 漂亮彈窗
  container.querySelectorAll(".delete-step-module-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = e.currentTarget.dataset.id;
      if (!id) return;
      openStepDeleteConfirm(id);
    });
  });

  // ✅ 初始化拖曳排序
  initStepModulesSortable();
}

function setupStepsFilterButtons() {
  const buttons = document.querySelectorAll(".steps-filter-btn");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      currentStepTagFilter = btn.dataset.tag || "全部";
      renderStepModules();
    });
  });
}

let stepModulesSortable = null;

// 初始化流程庫的拖曳排序
function initStepModulesSortable() {
  const container = document.getElementById("steps-modules-list");
  if (!container) return;

  // 只需要建立一次，不要每次 render 都 new
  if (stepModulesSortable) return;

  stepModulesSortable = new Sortable(container, {
    animation: 150,
    // 可以用 header 當拖曳區域（在手機就是長按標題區塊再拖）
    handle: ".step-module-header",
    // 只有自訂流程可以拖動，預設流程保持固定
    draggable: ".step-module-card.custom",

    onEnd: function () {
      // 目前畫面上「自訂流程」的新順序
      const cards = container.querySelectorAll(".step-module-card.custom");
      const orderIds = Array.from(cards).map((el) => el.dataset.id);

      // 根據畫面順序重排 stepsLibrary（只動自訂流程的排序）
      const newOrder = [];
      orderIds.forEach((id) => {
        const found = stepsLibrary.find((m) => m.id === id);
        if (found) newOrder.push(found);
      });

      // 可能有沒被顯示到的自訂流程（被 filter 擋住），要保留
      const remaining = stepsLibrary.filter((m) => !orderIds.includes(m.id));

      // 新順序在前面，沒出現在畫面的那些接在後面
      stepsLibrary = [...newOrder, ...remaining];

      saveData();
      renderStepModules();
    }
  });
}


// 新增自己的流程模組
function setupStepModuleAdd() {
  const titleInput = document.getElementById("new-step-module-title");
  const tagsInput = document.getElementById("new-step-module-tags");
  const stepsInput = document.getElementById("new-step-module-steps");
  const addBtn = document.getElementById("add-step-module-btn");

  if (!titleInput || !tagsInput || !stepsInput || !addBtn) return;

  addBtn.addEventListener("click", () => {
    const title = titleInput.value.trim();
    const rawTags = tagsInput.value.trim();
    const rawSteps = stepsInput.value.trim();

    if (!title || !rawSteps) return;

    const tags = rawTags
      ? rawTags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    const steps = rawSteps
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const newModule = {
      id: "user-" + Date.now(),
      title,
      tags,
      steps
    };

    stepsLibrary.unshift(newModule);
    saveData();

    titleInput.value = "";
    tagsInput.value = "";
    stepsInput.value = "";

    renderStepModules();
  });
}

function setupStepDeleteConfirm() {
  const cancelBtn = document.getElementById("step-confirm-cancel");
  const okBtn = document.getElementById("step-confirm-ok");
  const backdrop = document.getElementById("step-confirm-backdrop");

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      closeStepDeleteConfirm();
    });
  }

  if (backdrop) {
    backdrop.addEventListener("click", () => {
      closeStepDeleteConfirm();
    });
  }

  if (okBtn) {
    okBtn.addEventListener("click", () => {
      if (!stepModuleIdPendingDelete) {
        closeStepDeleteConfirm();
        return;
      }

      const idx = stepsLibrary.findIndex(
        (m) => m.id === stepModuleIdPendingDelete
      );
      if (idx !== -1) {
        stepsLibrary.splice(idx, 1);
        saveData();
        renderStepModules();
      }

      closeStepDeleteConfirm();
    });
  }
}

// ---------- 小工具 ----------
function createId() {
  return Date.now().toString(36) + Math.random().toString(16).slice(2);
}

function formatNumber(num) {
  if (!Number.isFinite(num)) return "";
  const str = num.toFixed(2);
  if (str.endsWith("00")) return parseInt(str, 10).toString();
  if (str.endsWith("0")) return str.slice(0, -1);
  return str;
}

// 刪除食譜（給 swipe delete 用）
function deleteRecipe(id) {
  recipes = recipes.filter((r) => r.id !== id);
  saveData();
  renderRecipeList();
}

function deleteRefRecipe(id) {
  refRecipes = refRecipes.filter((r) => r.id !== id);
  saveData();
  renderRefRecipes();
}

function deleteLabNote(id) {
  labNotes = labNotes.filter((n) => n.id !== id);
  saveData();
  renderLabNotes();
}

// ---------- Modal 開關（新增 / 編輯食譜） ----------
function openRecipeModal() {
  const modal = document.getElementById("new-recipe-view");
  const backdrop = document.getElementById("recipe-modal-backdrop");
  if (modal) modal.classList.add("show");
  if (backdrop) backdrop.classList.add("visible");
}

function closeRecipeModal() {
  const modal = document.getElementById("new-recipe-view");
  const backdrop = document.getElementById("recipe-modal-backdrop");
  if (modal) modal.classList.remove("show");
  if (backdrop) backdrop.classList.remove("visible");
}

// 釘選 / 取消釘選
function toggleRecipePin(recipeId) {
  const recipe = recipes.find((r) => r.id === recipeId);
  if (!recipe) return;
  recipe.pinned = !recipe.pinned;
  saveData();
  renderRecipeList();
}

// 設定單一食譜的倍率（幾倍配方）
function setRecipeRatio(recipeId, mult) {
  const recipe = recipes.find((r) => r.id === recipeId);
  if (!recipe) return;

  if (!Number.isFinite(mult) || mult <= 0) {
    alert("倍率請輸入大於 0 的數字");
    return;
  }

  recipe.ratio = mult;
  saveData();

  // 如果此時正在編輯同一個食譜，順便更新提示文字＆材料表
  if (editingRecipeId === recipeId) {
    const ratioHint = document.getElementById("recipe-form-ratio");
    if (ratioHint) {
      ratioHint.textContent =
        mult === 1
          ? "目前倍率：x1（顯示原始配方份量）"
          : `目前倍率：x${mult}（表格顯示的是放大後的材料重量，原始 1 倍配方已保留）`;
    }
    renderIngredientTable();
  }
}

// ---------- 新增食譜頁：材料 ----------
function renderIngredientTable() {
  const tbody = document.getElementById("ingredient-table-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!tempIngredients.length) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td colspan="6" class="empty-row">目前還沒有材料，在上方輸入後按「加入材料」。</td>';
    tbody.appendChild(tr);
    return;
  }

  let displayMultiplier = 1;
  if (editingRecipeId) {
    const rec = recipes.find((r) => r.id === editingRecipeId);
    if (rec && typeof rec.ratio === "number" && rec.ratio > 0) {
      displayMultiplier = rec.ratio;
    }
  }

  const baseline = tempIngredients.find((i) => i.id === baselineIngredientId);

  tempIngredients.forEach((ing) => {
    const tr = document.createElement("tr");

    const deleteTd = document.createElement("td");
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "icon-btn ing-delete-btn";
    deleteBtn.textContent = "−";
    deleteBtn.title = "刪除此材料";

    deleteBtn.addEventListener("click", () => {
      const ok = window.confirm(
        `要刪除「${ing.name || "這個材料"}」嗎？\n刪掉之後就不能復原囉。`
      );
      if (!ok) return;

      if (baselineIngredientId === ing.id) {
        baselineIngredientId = null;
      }
      tempIngredients = tempIngredients.filter((i) => i.id !== ing.id);
      renderIngredientTable();
    });

    deleteTd.appendChild(deleteBtn);

    const nameTd = document.createElement("td");
    const amountTd = document.createElement("td");
    const unitTd = document.createElement("td");

    nameTd.classList.add("ing-click");
    amountTd.classList.add("ing-click");
    unitTd.classList.add("ing-click");

    nameTd.textContent = ing.name;
    const displayedAmount = ing.amount * displayMultiplier;
    amountTd.textContent = formatNumber(displayedAmount);
    unitTd.textContent = ing.unit || "";

    const baseTd = document.createElement("td");
    baseTd.textContent = ing.id === baselineIngredientId ? "★ 基準" : "";

    const ratioTd = document.createElement("td");
    if (baseline && baseline.amount > 0) {
      const r = ing.amount / baseline.amount;
      ratioTd.textContent = formatNumber(r);
    } else {
      ratioTd.textContent = "-";
    }

    tr.appendChild(deleteTd);
    tr.appendChild(nameTd);
    tr.appendChild(amountTd);
    tr.appendChild(unitTd);
    tr.appendChild(baseTd);
    tr.appendChild(ratioTd);

    tbody.appendChild(tr);
  });
}

function setupIngredientAdd() {
  const nameInput = document.getElementById("ing-name");
  const amountInput = document.getElementById("ing-amount");
  const unitSelect = document.getElementById("ing-unit");
  const flourCheckbox = document.getElementById("ing-is-flour");
  const addBtn = document.getElementById("add-ingredient-btn");

  if (!nameInput || !amountInput || !unitSelect || !flourCheckbox || !addBtn)
    return;

  function doAddIngredient() {
    const name = nameInput.value.trim();
    const amountRaw = amountInput.value.trim();
    const unit = unitSelect.value;

    if (!name) {
      alert("請先輸入「材料名稱」");
      nameInput.focus();
      return;
    }
    if (!amountRaw) {
      alert("請先輸入「材料重量」");
      amountInput.focus();
      return;
    }

    const amountVal = parseFloat(amountRaw);
    if (!Number.isFinite(amountVal) || amountVal <= 0) {
      alert("材料重量必須是大於 0 的數字");
      amountInput.focus();
      return;
    }

    const id = createId();

    if (flourCheckbox.checked) {
      baselineIngredientId = id;
    }

    tempIngredients.push({
      id,
      name,
      amount: amountVal,
      unit
    });

    nameInput.value = "";
    amountInput.value = "";
    flourCheckbox.checked = false;

    renderIngredientTable();

    nameInput.focus();
    nameInput.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  addBtn.addEventListener("click", (e) => {
    e.preventDefault();
    doAddIngredient();
  });

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      doAddIngredient();
    }
  }

  nameInput.addEventListener("keydown", handleKeyDown);
  amountInput.addEventListener("keydown", handleKeyDown);
}

// ---------- 器材 ----------
function renderEquipmentList() {
  const list = document.getElementById("equipment-list");
  if (!list) return;

  list.innerHTML = "";

  if (!tempEquipment.length) {
    list.innerHTML =
      '<p class="empty-row">目前還沒有器材，在上方輸入後按「加入器材」。</p>';
    return;
  }

  tempEquipment.forEach((eq, index) => {
    const row = document.createElement("div");
    row.className = "equipment-row";

    const text = document.createElement("span");
    text.textContent = eq;

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "icon-btn ing-delete-btn";
    delBtn.textContent = "−";
    delBtn.title = "刪除此器材";

    delBtn.addEventListener("click", () => {
      const ok = window.confirm(`要刪除「${eq}」這項器材嗎？`);
      if (!ok) return;
      tempEquipment.splice(index, 1);
      renderEquipmentList();
    });

    row.appendChild(text);
    row.appendChild(delBtn);
    list.appendChild(row);
  });
}

function setupEquipmentAdd() {
  const input = document.getElementById("equip-name");
  const btn = document.getElementById("add-equip-btn");
  if (!input || !btn) return;

  btn.addEventListener("click", () => {
    const val = input.value.trim();
    if (!val) {
      alert("請輸入器材名稱");
      return;
    }
    tempEquipment.push(val);
    input.value = "";
    renderEquipmentList();
  });
}

// ---------- 編輯食譜 ----------
function startEditRecipe(recipeId) {
  const recipe = recipes.find((r) => r.id === recipeId);
  if (!recipe) return;

  editingRecipeId = recipeId;

  const nameEl = document.getElementById("recipe-name");
  const categoryEl = document.getElementById("recipe-category");
  const sourceEl = document.getElementById("recipe-source");
  const sourceTypeEl = document.getElementById("recipe-source-type");
  const proAuthorEl = document.getElementById("recipe-pro-author");
  const servingEl = document.getElementById("recipe-serving");
  // ⚠️ 不再用 textarea 讀步驟了，這行可以拿掉：
  // const stepsEl = document.getElementById("recipe-steps");

  if (!nameEl) return;

  nameEl.value = recipe.name || "";
  categoryEl.value = recipe.category || "麵包";
  sourceEl.value = recipe.source || "";
  sourceTypeEl.value = recipe.sourceType || "personal";
  proAuthorEl.value = recipe.proAuthor || "";
  servingEl.value = recipe.serving || "";

  // ✅ 把原本存的多行步驟拆回陣列，給動態步驟區顯示
  stepList = (recipe.steps || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  renderSteps();

  tempIngredients = (recipe.ingredients || []).map((ing) => ({ ...ing }));
  baselineIngredientId = recipe.baselineIngredientId || null;
  tempEquipment = Array.isArray(recipe.equipment)
    ? recipe.equipment.slice()
    : [];

  renderIngredientTable();
  renderEquipmentList();

  const titleEl = document.getElementById("recipe-form-title");
  const submitBtn = document.getElementById("recipe-submit-btn");
  const cancelBtn = document.getElementById("recipe-cancel-edit");
  const ratioHint = document.getElementById("recipe-form-ratio");

  if (titleEl) titleEl.textContent = "編輯食譜";
  if (submitBtn) submitBtn.textContent = "更新食譜";
  if (cancelBtn) cancelBtn.style.display = "inline-flex";

  const r = typeof recipe.ratio === "number" && recipe.ratio > 0 ? recipe.ratio : 1;
  if (ratioHint) {
    ratioHint.textContent =
      r === 1
        ? "目前倍率：x1（顯示原始配方份量）"
        : `目前倍率：x${r}（表格顯示的是放大後的材料重量，原始 1 倍配方已保留）`;
  }

  openRecipeModal();
}

// ---------- 新增 / 更新 食譜表單 ----------
// ---------- 新增 / 更新 食譜表單 ----------
function setupRecipeForm() {
  const form = document.getElementById("recipe-form");
  if (!form) return;

  const titleEl = document.getElementById("recipe-form-title");
  const submitBtn = document.getElementById("recipe-submit-btn");
  const cancelBtn = document.getElementById("recipe-cancel-edit");
  const ratioHint = document.getElementById("recipe-form-ratio");
  const closeBtn = document.getElementById("recipe-close-btn");

  function exitRecipeForm() {
    editingRecipeId = null;
    form.reset();

    tempIngredients = [];
    tempEquipment = [];
    baselineIngredientId = null;

    renderIngredientTable();
    renderEquipmentList();

    // ✅ 清空舊 textarea 步驟（如果還有）
    const legacyStepsEl = document.getElementById("recipe-steps");
    if (legacyStepsEl) legacyStepsEl.value = "";

    // ✅ 清空動態步驟 & 重畫一行空的
    stepList = [];
    if (stepsContainer) {
      stepsContainer.innerHTML = "";
    }
    addStep(); // 再生一個空的步驟欄位

    if (titleEl) titleEl.textContent = "新增食譜";
    if (submitBtn) submitBtn.textContent = "儲存食譜";
    if (cancelBtn) cancelBtn.style.display = "none";
    if (ratioHint) ratioHint.textContent = "";

    closeRecipeModal();
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", exitRecipeForm);
  }
  if (closeBtn) {
    closeBtn.addEventListener("click", exitRecipeForm);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const nameEl = document.getElementById("recipe-name");
    const categoryEl = document.getElementById("recipe-category");
    const sourceEl = document.getElementById("recipe-source");
    const sourceTypeEl = document.getElementById("recipe-source-type");
    const proAuthorEl = document.getElementById("recipe-pro-author");
    const servingEl = document.getElementById("recipe-serving");
    const legacyStepsEl = document.getElementById("recipe-steps"); // 舊 textarea（如果存在）

    const name = nameEl.value.trim();
    if (!name) {
      alert("請輸入食譜名稱");
      return;
    }

    // ✅ 先從新的動態步驟欄位抓資料
    const stepInputs = document.querySelectorAll(".step-input");
    const stepsFromUI = Array.from(stepInputs)
      .map((el) => el.value.trim())
      .filter((txt) => txt !== "");

    let stepsText = stepsFromUI.join("\n");

    // ✅ 如果畫面上沒有 .step-input（或你其實是打在舊 textarea 裡）
    //   就改從 legacy textarea 讀
    if (!stepsText && legacyStepsEl) {
      stepsText = legacyStepsEl.value.trim();
    }

    const commonData = {
      name,
      category: categoryEl.value || "",
      source: sourceEl.value.trim(),
      sourceType: sourceTypeEl.value || "personal",
      proAuthor: proAuthorEl.value.trim(),
      serving: servingEl.value.trim(),
      steps: stepsText, // ⭐ 不管新舊寫法，最後都進到這裡
      ingredients: tempIngredients.slice(),
      equipment: tempEquipment.slice(),
      baselineIngredientId
    };

    if (editingRecipeId) {
      const idx = recipes.findIndex((r) => r.id === editingRecipeId);
      if (idx !== -1) {
        recipes[idx] = {
          ...recipes[idx],
          ...commonData
        };
      }
    } else {
      const recipe = {
        id: createId(),
        createdAt: Date.now(),
        ratio: 1,
        pinned: false,
        ...commonData
      };
      recipes.push(recipe);
    }

    saveData();
    renderRecipeList();
    exitRecipeForm();
  });
}

// ---------- 食譜 filter ----------
function setupRecipeFilters() {
  const searchEl = document.getElementById("filter-recipe-search");
  const categoryEl = document.getElementById("filter-recipe-category");
  const sourceTypeEl = document.getElementById("filter-recipe-source-type");

  if (!searchEl || !categoryEl || !sourceTypeEl) return;

  const applyFilter = () => {
    const s = searchEl.value.trim().toLowerCase();
    const c = categoryEl.value;
    const src = sourceTypeEl.value;

    const filtered = recipes.filter((r) => {
      const name = (r.name || "").toLowerCase();
      const matchName = !s || name.includes(s);
      const matchCat = c ? r.category === c : true;
      const matchSrc = src ? r.sourceType === src : true;
      return matchName && matchCat && matchSrc;
    });

    renderRecipeList(filtered);
  };

  searchEl.addEventListener("input", applyFilter);
  categoryEl.addEventListener("change", applyFilter);
  sourceTypeEl.addEventListener("change", applyFilter);
}

// ---------- 食譜快速分類 Tab ----------
function setupRecipeCategoryTabs() {
  const buttons = document.querySelectorAll(".recipe-category-tab");
  const categoryEl = document.getElementById("filter-recipe-category");

  if (!buttons.length || !categoryEl) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.cat ?? "";

      categoryEl.value = cat;

      const event = new Event("change", { bubbles: true });
      categoryEl.dispatchEvent(event);

      buttons.forEach((b) => {
        b.classList.toggle("active", b === btn);
      });
    });
  });
}

// ---------- Filter 收合開關 ----------
function setupFilterTogglePanels() {
  const pairs = [
    { btnId: "toggle-recipe-filter", panelId: "recipe-filter-panel" },
    { btnId: "toggle-log-filter", panelId: "log-filter-panel" },
    { btnId: "toggle-ref-filter", panelId: "ref-filter-panel" },
    { btnId: "toggle-lab-filter", panelId: "lab-filter-panel" }
  ];

  pairs.forEach(({ btnId, panelId }) => {
    const btn = document.getElementById(btnId);
    const panel = document.getElementById(panelId);
    if (!btn || !panel) return;
    btn.addEventListener("click", () => {
      panel.classList.toggle("open");
    });
  });
}

// ---------- 烘焙紀錄 ----------
function renderLogs(listOverride) {
  const list = Array.isArray(listOverride) ? listOverride : logs;
  const listEl = document.getElementById("log-list");
  if (!listEl) return;

  listEl.innerHTML = "";

  if (!list.length) {
    const div = document.createElement("div");
    div.className = "empty-text";
    div.textContent = "目前還沒有任何烘焙紀錄。";
    listEl.appendChild(div);
    return;
  }

  const sorted = list.slice().sort((a, b) =>
    (b.date || "").localeCompare(a.date || "")
  );

  sorted.forEach((log) => {
    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = log.recipeName || "未命名食譜";

    const meta = document.createElement("div");
    meta.className = "card-meta";
    const parts = [];
    if (log.date) parts.push(log.date);
    if (log.variant) parts.push(log.variant);
    if (log.rating) parts.push(`評分 ${log.rating}/5`);
    meta.textContent = parts.join(" · ");

    const notes = document.createElement("div");
    notes.className = "card-tags";
    const notesPieces = [];
    if (log.oven) notesPieces.push(`烤箱：${log.oven}`);
    if (log.notes) notesPieces.push(`口感：${log.notes}`);
    if (log.next) notesPieces.push(`下次：${log.next}`);
    notes.textContent = notesPieces.join(" ｜ ");

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(notes);
    listEl.appendChild(card);
  });
}

function setupLogForm() {
  const form = document.getElementById("log-form");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const dateEl = document.getElementById("log-date");
    const recipeNameEl = document.getElementById("log-recipe-name");
    const variantEl = document.getElementById("log-variant");
    const ovenEl = document.getElementById("log-oven");
    const ratingEl = document.getElementById("log-rating");
    const notesEl = document.getElementById("log-notes");
    const nextEl = document.getElementById("log-next");

    const recipeName = recipeNameEl.value.trim();
    if (!recipeName) {
      alert("請輸入食譜名稱");
      return;
    }

    const log = {
      id: createId(),
      createdAt: Date.now(),
      date: dateEl.value,
      recipeName,
      variant: variantEl.value.trim(),
      oven: ovenEl.value.trim(),
      rating: parseFloat(ratingEl.value) || null,
      notes: notesEl.value.trim(),
      next: nextEl.value.trim()
    };

    logs.push(log);
    saveData();
    form.reset();
    renderLogs();
  });
}

function setupLogFilters() {
  const searchEl = document.getElementById("filter-log-search");
  const ratingEl = document.getElementById("filter-log-rating");
  const dateEl = document.getElementById("filter-log-date");
  if (!searchEl || !ratingEl || !dateEl) return;

  const applyFilter = () => {
    const s = searchEl.value.trim().toLowerCase();
    const rating = ratingEl.value;
    const date = dateEl.value;

    const filtered = logs.filter((l) => {
      const matchText =
        (l.recipeName || "").toLowerCase().includes(s) ||
        (l.notes || "").toLowerCase().includes(s);

      const matchRating =
        rating === ""
          ? true
          : rating === "5"
          ? l.rating == 5
          : rating === "4"
          ? l.rating >= 4
          : rating === "3"
          ? l.rating >= 3
          : true;

      const matchDate = date ? l.date === date : true;

      return matchText && matchRating && matchDate;
    });

    renderLogs(filtered);
  };

  searchEl.addEventListener("input", applyFilter);
  ratingEl.addEventListener("change", applyFilter);
  dateEl.addEventListener("change", applyFilter);
}

// ---------- 參考食譜 ----------
function renderRefRecipes(listOverride) {
  const listEl = document.getElementById("ref-recipe-list");
  if (!listEl) return;

  const list = Array.isArray(listOverride) ? listOverride : refRecipes;
  listEl.innerHTML = "";

  if (!list.length) {
    const div = document.createElement("div");
    div.className = "empty-text";
    div.textContent = "還沒有任何參考食譜，可以先把想試做的連結存起來。";
    listEl.appendChild(div);
    return;
  }

  const sorted = list.slice().sort((a, b) =>
    (b.createdAt || 0) - (a.createdAt || 0)
  );

  sorted.forEach((ref) => {
    const card = document.createElement("div");
    card.className = "card";

    const inner = document.createElement("div");
    inner.className = "card-inner";

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = ref.title || "未命名參考食譜";

    const meta = document.createElement("div");
    meta.className = "card-meta";
    const parts = [];
    if (ref.category) parts.push(ref.category);
    if (ref.source) parts.push(ref.source);
    meta.textContent = parts.join(" · ") || "未設定來源";

    const notes = document.createElement("div");
    notes.className = "card-tags";
    const notePieces = [];
    if (ref.link) notePieces.push(ref.link);
    if (ref.notes) notePieces.push(ref.notes);
    notes.textContent =
      notePieces.join(" ｜ ") ||
      "（還沒寫任何備註，可以記一下為什麼想做這個）";

    inner.appendChild(title);
    inner.appendChild(meta);
    inner.appendChild(notes);

    card.appendChild(inner);

    const swipeActions = document.createElement("div");
    swipeActions.className = "card-swipe-actions";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "swipe-delete-btn";
    deleteBtn.textContent = "刪除";

    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const ok = window.confirm(
        `確定要刪除「${ref.title}」這個參考食譜嗎？\n刪除後就不能復原囉。`
      );
      if (!ok) return;
      deleteRefRecipe(ref.id);
    });

    swipeActions.appendChild(deleteBtn);
    card.appendChild(swipeActions);

    let touchStartX = 0;
    let touchEndX = 0;

    card.addEventListener("touchstart", (e) => {
      if (!e.changedTouches || !e.changedTouches.length) return;
      touchStartX = e.changedTouches[0].clientX;
    });

    card.addEventListener("touchend", (e) => {
      if (!e.changedTouches || !e.changedTouches.length) return;
      touchEndX = e.changedTouches[0].clientX;
      const diff = touchEndX - touchStartX;
      if (diff < -30) card.classList.add("swiped");
      else if (diff > 30) card.classList.remove("swiped");
    });

    listEl.appendChild(card);
  });
}

function setupRefRecipeForm() {
  const form = document.getElementById("ref-recipe-form");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const titleEl = document.getElementById("ref-title");
    const categoryEl = document.getElementById("ref-category");
    const sourceEl = document.getElementById("ref-source");
    const linkEl = document.getElementById("ref-link");
    const notesEl = document.getElementById("ref-notes");

    if (!titleEl) return;

    const title = titleEl.value.trim();
    if (!title) {
      alert("請輸入參考食譜名稱");
      return;
    }

    const ref = {
      id: createId(),
      createdAt: Date.now(),
      title,
      category: categoryEl ? categoryEl.value : "",
      source: sourceEl ? sourceEl.value.trim() : "",
      link: linkEl ? linkEl.value.trim() : "",
      notes: notesEl ? notesEl.value.trim() : ""
    };

    refRecipes.push(ref);
    saveData();
    form.reset();
    renderRefRecipes();
  });
}

function setupRefFilters() {
  const searchEl = document.getElementById("filter-ref-search");
  const catEl = document.getElementById("filter-ref-category");
  if (!searchEl || !catEl) return;

  const applyFilter = () => {
    const s = searchEl.value.trim().toLowerCase();
    const c = catEl.value;

    const filtered = refRecipes.filter((r) => {
      const matchText =
        (r.title || "").toLowerCase().includes(s) ||
        (r.source || "").toLowerCase().includes(s);
      const matchCat = c ? r.category === c : true;
      return matchText && matchCat;
    });

    renderRefRecipes(filtered);
  };

  searchEl.addEventListener("input", applyFilter);
  catEl.addEventListener("change", applyFilter);
}

// ---------- 實驗筆記 ----------
function renderLabNotes(listOverride) {
  const listEl = document.getElementById("lab-list");
  if (!listEl) return;

  const list = Array.isArray(listOverride) ? listOverride : labNotes;
  listEl.innerHTML = "";

  if (!list.length) {
    const div = document.createElement("div");
    div.className = "empty-text";
    div.textContent = "還沒有實驗紀錄，可以把每次調整配方的心得記下來。";
    listEl.appendChild(div);
    return;
  }

  const sorted = list.slice().sort((a, b) =>
    (b.createdAt || 0) - (a.createdAt || 0)
  );

  sorted.forEach((note) => {
    const card = document.createElement("div");
    card.className = "card";

    const inner = document.createElement("div");
    inner.className = "card-inner";

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = note.title || "未命名實驗";

    const meta = document.createElement("div");
    meta.className = "card-meta";
    const parts = [];
    if (note.date) parts.push(note.date);
    if (note.focus) {
      const focusShort =
        note.focus.length > 40 ? note.focus.slice(0, 40) + "…" : note.focus;
      parts.push(focusShort);
    }
    meta.textContent = parts.join(" · ") || "未寫實驗重點";

    const tags = document.createElement("div");
    tags.className = "card-tags";
    const pieces = [];
    if (note.result) pieces.push("結果：" + note.result);
    if (note.next) pieces.push("下次：" + note.next);
    tags.textContent =
      pieces.join(" ｜ ") ||
      "（可以記一下這次的結果 & 下次要怎麼改）";

    inner.appendChild(title);
    inner.appendChild(meta);
    inner.appendChild(tags);

    card.appendChild(inner);

    const swipeActions = document.createElement("div");
    swipeActions.className = "card-swipe-actions";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "swipe-delete-btn";
    deleteBtn.textContent = "刪除";

    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const ok = window.confirm(
        `確定要刪除「${note.title}」這筆實驗筆記嗎？\n刪除後就不能復原囉。`
      );
      if (!ok) return;
      deleteLabNote(note.id);
    });

    swipeActions.appendChild(deleteBtn);
    card.appendChild(swipeActions);

    let touchStartX = 0;
    let touchEndX = 0;

    card.addEventListener("touchstart", (e) => {
      if (!e.changedTouches || !e.changedTouches.length) return;
      touchStartX = e.changedTouches[0].clientX;
    });

    card.addEventListener("touchend", (e) => {
      if (!e.changedTouches || !e.changedTouches.length) return;
      touchEndX = e.changedTouches[0].clientX;
      const diff = touchEndX - touchStartX;
      if (diff < -30) card.classList.add("swiped");
      else if (diff > 30) card.classList.remove("swiped");
    });

    listEl.appendChild(card);
  });
}

function setupLabForm() {
  const form = document.getElementById("lab-form");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const titleEl = document.getElementById("lab-title");
    const dateEl = document.getElementById("lab-date");
    const focusEl = document.getElementById("lab-focus");
    const resultEl = document.getElementById("lab-result");
    const nextEl = document.getElementById("lab-next");

    const title = titleEl.value.trim();
    if (!title) {
      alert("請輸入實驗主題");
      return;
    }

    const note = {
      id: createId(),
      createdAt: Date.now(),
      title,
      date: dateEl.value || "",
      focus: (focusEl.value || "").trim(),
      result: (resultEl.value || "").trim(),
      next: (nextEl.value || "").trim()
    };

    labNotes.push(note);
    saveData();
    form.reset();
    renderLabNotes();
  });
}

function setupLabFilters() {
  const searchEl = document.getElementById("filter-lab-search");
  const dateEl = document.getElementById("filter-lab-date");
  if (!searchEl || !dateEl) return;

  const applyFilter = () => {
    const s = searchEl.value.trim().toLowerCase();
    const d = dateEl.value;

    const filtered = labNotes.filter((n) => {
      const matchText =
        (n.title || "").toLowerCase().includes(s) ||
        (n.result || "").toLowerCase().includes(s);
      const matchDate = d ? n.date === d : true;
      return matchText && matchDate;
    });

    renderLabNotes(filtered);
  };

  searchEl.addEventListener("input", applyFilter);
  dateEl.addEventListener("change", applyFilter);
}

// ---------- 比例換算小工具 ----------
function setupRatioTool() {
  const baseInput = document.getElementById("ratio-base");
  const multInput = document.getElementById("ratio-multiplier");
  const resultInput = document.getElementById("ratio-result");
  const btn = document.getElementById("ratio-calc-btn");

  if (!baseInput || !multInput || !resultInput || !btn) return;

  btn.addEventListener("click", () => {
    const base = parseFloat(baseInput.value);
    const m = parseFloat(multInput.value);
    if (!base || !m) {
      resultInput.value = "請輸入數值";
      return;
    }
    resultInput.value = formatNumber(base * m);
  });
}

// 單位換算工具（先做純單位換算，密度部分可之後再加）
function setupUnitConverter() {
  const valueEl = document.getElementById("unit-value");
  const fromEl = document.getElementById("unit-from");
  const toEl = document.getElementById("unit-to");
  const resultEl = document.getElementById("unit-result");
  const btn = document.getElementById("unit-convert-btn");

  if (!valueEl || !fromEl || !toEl || !resultEl || !btn) return;

  const unitTable = {
    g: 1,
    kg: 1000,
    oz: 28.3495,
    lb: 453.592,
    ml: 1,
    l: 1000,
    cup: 240,
    tbsp: 15,
    tsp: 5
  };

  btn.addEventListener("click", () => {
    const value = parseFloat(valueEl.value);
    const from = fromEl.value;
    const to = toEl.value;

    if (!value) {
      resultEl.value = "請輸入數值";
      return;
    }
    if (!unitTable[from] || !unitTable[to]) {
      resultEl.value = "無法換算這個單位";
      return;
    }

    const base = value * unitTable[from];
    const converted = base / unitTable[to];
    resultEl.value = converted.toFixed(3).replace(/\.?0+$/, "");
  });

  // 快捷按鈕
  document.querySelectorAll(".quick-unit-btn").forEach((btnQuick) => {
    btnQuick.addEventListener("click", () => {
      const v = parseFloat(btnQuick.dataset.value || "0");
      const from = btnQuick.dataset.from;
      const to = btnQuick.dataset.to;

      valueEl.value = v || "";
      fromEl.value = from || "g";
      toEl.value = to || "g";

      const ingredientSelect = document.getElementById("unit-ingredient");
      if (ingredientSelect && btnQuick.dataset.ingredient) {
        ingredientSelect.value = btnQuick.dataset.ingredient;
      }

      btn.click();
    });
  });
}

// 食材列 → 自動帶到換算工具
function setupIngredientToConverter() {
  const ratioTabBtn = document.querySelector('[data-view="ratio-view"]');

  document.addEventListener("click", (e) => {
    if (!e.target.classList.contains("ing-click")) return;

    const tr = e.target.closest("tr");
    if (!tr) return;

    const tds = tr.querySelectorAll(".ing-click");
    if (tds.length < 3) return;

    const name = tds[0].textContent.trim();
    const amount = parseFloat(tds[1].textContent.trim());
    const unit = tds[2].textContent.trim();

    if (ratioTabBtn) ratioTabBtn.click();

    setTimeout(() => {
      const val = document.getElementById("unit-value");
      const from = document.getElementById("unit-from");
      const ing = document.getElementById("unit-ingredient");

      if (val) val.value = amount || "";
      if (from) from.value = unit || "g";

      if (ing) {
        if (/粉/.test(name)) ing.value = "flour";
        else if (/糖/.test(name)) ing.value = "sugar";
        else if (/奶油/.test(name)) ing.value = "butter";
        else if (/奶/.test(name)) ing.value = "milk";
        else ing.value = "water";
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 250);
  });
}

// ---------- Tabs + 側邊欄 / 頂部目錄 ----------
function switchView(targetId) {
  // 切換各個 view 顯示 / 隱藏
  const views = document.querySelectorAll(".view");
  views.forEach((v) => {
    v.classList.toggle("active", v.id === targetId);
  });

  // 同步所有 tab-button（側邊欄 + 上方 top-nav + 上方 top-tabs）
  const buttons = document.querySelectorAll(".tab-button");
  buttons.forEach((btn) => {
    const viewId = btn.dataset.view;
    if (!viewId || viewId === "new-recipe-view") {
      // 新增食譜那顆不要用來切換 view
      return;
    }
    btn.classList.toggle("active", viewId === targetId);
  });

  // 同步底部 nav 高亮（手機用）
  const bottomBtns = document.querySelectorAll(".bottom-nav-btn");
  bottomBtns.forEach((b) => {
    const viewId = b.dataset.view;
    b.classList.toggle("active", viewId === targetId);
  });
}

function setupTabsAndMenus() {
  const tabButtons = document.querySelectorAll(".tab-button");
  const drawer = document.getElementById("side-drawer");
  const backdrop = document.getElementById("backdrop");
  const menuToggle = document.getElementById("menu-toggle");

  function closeSideDrawerInternal() {
    if (!drawer || !backdrop) return;
    drawer.classList.remove("open");
    backdrop.classList.remove("visible");
  }

  // 所有 tab-button 的 click 行為（側邊欄 + 上方 top-nav + 上方 top-tabs）
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.view;
      if (!target) return;

      if (target === "new-recipe-view") {
        // 新增食譜：打開 modal，不切換主頁 view
        openRecipeModal();
        closeSideDrawerInternal();
        return;
      }

      switchView(target);
      closeSideDrawerInternal();
    });
  });

  // 首頁卡片上的「新增食譜」按鈕（如果你有這顆就會生效，沒有也沒差）
  const goNewBtn = document.getElementById("go-new-recipe");
  if (goNewBtn) {
    goNewBtn.addEventListener("click", () => {
      openRecipeModal();
    });
  }

  const headerNewBtn = document.getElementById("header-new-recipe-btn");
  if (headerNewBtn) {
    headerNewBtn.addEventListener("click", () => {
      openRecipeModal();
      closeSideDrawerInternal();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function openSideDrawer() {
    if (!drawer || !backdrop) return;
    drawer.classList.add("open");
    backdrop.classList.add("visible");
  }

  if (menuToggle) menuToggle.addEventListener("click", openSideDrawer);
  if (backdrop) backdrop.addEventListener("click", closeSideDrawerInternal);

  // 捲動時浮動 top-nav
  const topNav = document.getElementById("top-nav");
  if (topNav) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 120) topNav.classList.add("show");
      else topNav.classList.remove("show");
    });
  }
}

// ---------- 底部導覽 ----------
function setupBottomNav() {
  const navBtns = document.querySelectorAll(".bottom-nav-btn");
  if (!navBtns.length) return;

  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.view;
      if (!target) return;
      switchView(target);
    });
  });

  // 預設主頁亮起
  const homeBtn = document.querySelector(
    '.bottom-nav-btn[data-view="recipes-view"]'
  );
  if (homeBtn) homeBtn.classList.add("active");
}

// ------ 禁用縮放（讓它更像 App） ------
document.addEventListener(
  "gesturestart",
  function (e) {
    e.preventDefault();
  },
  { passive: false }
);

let lastTouchEnd = 0;
document.addEventListener(
  "touchend",
  function (e) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  },
  { passive: false }
);

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  loadData();

  setupTabsAndMenus();

  // 食譜表單相關
  setupIngredientAdd();
  renderIngredientTable();
  setupEquipmentAdd();
  renderEquipmentList();
  setupRecipeForm();
  setupStepEditor();
  renderRecipeList();
  setupRecipeFilters();
  setupRecipeCategoryTabs();

  // 紀錄
  setupLogForm();
  renderLogs();
  setupLogFilters();

  // 參考食譜
  setupRefRecipeForm();
  renderRefRecipes();
  setupRefFilters();

  // 實驗筆記
  setupLabForm();
  renderLabNotes();
  setupLabFilters();

  // 工具
  setupRatioTool();
  setupUnitConverter();
  setupIngredientToConverter();

  // filter 折疊
  setupFilterTogglePanels();

  // 流程庫
  renderStepModules();
  setupStepsFilterButtons();
  setupStepModuleAdd();
  setupStepDeleteConfirm();

  // 底部導覽
  setupBottomNav();
});

// === 動態步驟（食譜表單用） ===

// 全域陣列：目前表單裡的步驟文字
let stepList = [];
// 容器會在 setupStepEditor 裡面抓
let stepsContainer = null;

function renderSteps() {
  if (!stepsContainer) return;

  stepsContainer.innerHTML = "";

  // 沒有步驟就不畫東西（exitRecipeForm 會再塞一行空白）
  if (!stepList.length) return;

  stepList.forEach((text, index) => {
    const row = document.createElement("div");
    row.className = "step-row";

    row.innerHTML = `
      <div class="step-number">${index + 1}</div>
      <textarea class="step-input" data-index="${index}" placeholder="輸入步驟內容...">${text}</textarea>
      <button type="button" class="delete-step" data-index="${index}">－</button>
    `;

    stepsContainer.appendChild(row);
  });

  bindStepEvents();
}

function bindStepEvents() {
  const inputs = document.querySelectorAll(".step-input");
  const deletes = document.querySelectorAll(".delete-step");

  // 文字輸入 → 同步回 stepList
  inputs.forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.index);
      if (!Number.isNaN(idx)) {
        stepList[idx] = e.target.value;
      }
    });

    // 按 Enter 自動新增下一步
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addStep();
      }
    });
  });

  // 刪除某一步
  deletes.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = Number(e.target.dataset.index);
      if (Number.isNaN(idx)) return;
      stepList.splice(idx, 1);
      renderSteps();
    });
  });
}

// 加一個新步驟（預設可以給空字串或預設文字）
function addStep(defaultText = "") {
  stepList.push(defaultText);
  renderSteps();
}

// 初始化步驟編輯器，給 DOMContentLoaded 呼叫
function setupStepEditor() {
  stepsContainer = document.getElementById("steps-container");
  const addStepBtn = document.getElementById("add-step-btn");

  if (!stepsContainer || !addStepBtn) return;

  // 一開始至少要有一行
  if (!stepList.length) {
    stepList.push("");
  }
  renderSteps();

  addStepBtn.addEventListener("click", () => addStep());
}

/// ---------- 食譜列表（支援字串步驟 / 陣列步驟） ----------
function renderRecipeList(listOverride) {
  const list = Array.isArray(listOverride) ? listOverride : recipes;
  const container = document.getElementById("recipe-list");
  if (!container) return;

  container.innerHTML = "";

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty-text";
    empty.textContent = "還沒有任何食譜，可以先新增一個常用配方。";
    container.appendChild(empty);
    return;
  }

  // 釘選在前，其餘依建立時間新到舊
  const sorted = list.slice().sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  sorted.forEach((recipe) => {
    const card = document.createElement("div");
    card.className = "card recipe-card";

    const inner = document.createElement("div");
    inner.className = "card-inner";

    // ====== 標題列（名稱 + 小箭頭 + 編輯 + 星星） ======
    const titleRow = document.createElement("div");
    titleRow.className = "card-title-row";

    const caret = document.createElement("span");
    caret.className = "recipe-caret";
    caret.textContent = "▾";

    const titleEl = document.createElement("div");
    titleEl.className = "card-title";
    titleEl.textContent = recipe.name || "未命名食譜";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "icon-btn";
    editBtn.title = "編輯食譜";
    editBtn.textContent = "✎";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      startEditRecipe(recipe.id);
    });

    const pinBtn = document.createElement("button");
    pinBtn.type = "button";
    pinBtn.className = "pin-btn";
    pinBtn.textContent = recipe.pinned ? "★" : "☆";
    pinBtn.title = recipe.pinned ? "取消釘選" : "釘選這個食譜";
    pinBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleRecipePin(recipe.id);
    });

    titleRow.appendChild(caret);
    titleRow.appendChild(titleEl);
    titleRow.appendChild(editBtn);
    titleRow.appendChild(pinBtn);

    // ====== meta 行：分類 / 份量 / 來源 ======
    const meta = document.createElement("div");
    meta.className = "card-meta";
    const parts = [];
    if (recipe.category) parts.push(recipe.category);
    if (recipe.serving) parts.push(recipe.serving);
    if (recipe.source) parts.push(recipe.source);
    meta.textContent = parts.join(" · ");

    // ====== 倍率列：幾倍配方 ======
    const ratioRow = document.createElement("div");
    ratioRow.className = "ratio-box";

    const ratioLabel = document.createElement("span");
    ratioLabel.style.fontSize = "0.8rem";

    const ratioInput = document.createElement("input");
    ratioInput.type = "number";
    ratioInput.min = "0.1";
    ratioInput.step = "0.1";
    ratioInput.className = "ratio-input";
    ratioInput.value =
      typeof recipe.ratio === "number" && recipe.ratio > 0
        ? recipe.ratio
        : 1;

    const ratioBtn = document.createElement("button");
    ratioBtn.type = "button";
    ratioBtn.className = "ratio-btn";
    ratioBtn.textContent = "套用";

    ratioInput.addEventListener("click", (e) => e.stopPropagation());
    ratioBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const val = parseFloat(ratioInput.value);
      if (!Number.isFinite(val) || val <= 0) {
        alert("倍率請輸入大於 0 的數字");
        return;
      }
      setRecipeRatio(recipe.id, val);
      alert(
        `已將「${recipe.name || "這個食譜"}」設定為 x${val}。\n` +
          "開啟編輯畫面時，材料表會用這個倍率顯示。"
      );
    });

    ratioRow.appendChild(ratioLabel);
    ratioRow.appendChild(ratioInput);
    ratioRow.appendChild(ratioBtn);

    // ====== 材料區（小字、無 bullet，會顯示容量）=======
    const ingWrap = document.createElement("div");
    ingWrap.className = "card-ingredients";
    ingWrap.style.fontSize = "0.8rem";
    ingWrap.style.lineHeight = "1.4";

    const ratio =
      typeof recipe.ratio === "number" && recipe.ratio > 0
        ? recipe.ratio
        : 1;

    if (Array.isArray(recipe.ingredients) && recipe.ingredients.length) {
      const label = document.createElement("div");
      label.className = "section-label";
      label.textContent = "材料";
      label.style.fontWeight = "600";
      label.style.marginBottom = "2px";
      ingWrap.appendChild(label);

            recipe.ingredients.forEach((ing) => {
        const row = document.createElement("div");
        row.className = "recipe-ing-row";

        let amountText = "";

        const rawAmount = ing.amount;
        const numeric = parseFloat(rawAmount);
        if (Number.isFinite(numeric)) {
          const finalAmount = numeric * ratio;
          amountText = formatNumber(finalAmount) + (ing.unit || "");
        } else if (
          rawAmount !== undefined &&
          rawAmount !== null &&
          rawAmount !== ""
        ) {
          amountText = String(rawAmount) + (ing.unit || "");
        }

        // 左邊：名稱
        const nameSpan = document.createElement("span");
        nameSpan.className = "ing-name";
        nameSpan.textContent = ing.name || "";

        row.appendChild(nameSpan);

        // 右邊：數字＋單位（有才顯示）
        if (amountText) {
          const amtSpan = document.createElement("span");
          amtSpan.className = "ing-amt";
          amtSpan.textContent = amountText;
          row.appendChild(amtSpan);
        }

        ingWrap.appendChild(row);
      });

    } else {
      ingWrap.textContent = "尚未輸入材料";
      ingWrap.classList.add("empty");
    }

    // 一開始先收起
    ingWrap.style.display = "none";


    // ====== 步驟區 ======
    const stepsWrap = document.createElement("div");
    stepsWrap.className = "card-steps";

    const rawSteps = recipe.steps;
    let lines = [];

    if (Array.isArray(rawSteps)) {
      lines = rawSteps
        .map((s) => {
          if (typeof s === "string") return s.trim();
          if (s && typeof s.text === "string") return s.text.trim();
          return "";
        })
        .filter(Boolean);
    } else if (typeof rawSteps === "string") {
      lines = rawSteps
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    if (lines.length) {
      const ul = document.createElement("ul");
      ul.className = "recipe-steps-list";
      lines.forEach((line) => {
        const li = document.createElement("li");
        li.textContent = line;
        ul.appendChild(li);
      });
      stepsWrap.appendChild(ul);
    } else {
      stepsWrap.textContent = "尚未輸入步驟";
      stepsWrap.classList.add("empty");
    }

    stepsWrap.style.display = "none";

    // 點卡片 → 展開 / 收起 材料 + 步驟
    card.addEventListener("click", () => {
      const expanded = card.classList.toggle("expanded");
      ingWrap.style.display = expanded ? "block" : "none";
      stepsWrap.style.display = expanded ? "block" : "none";
      caret.textContent = expanded ? "▴" : "▾";
    });

    inner.appendChild(titleRow);
    inner.appendChild(meta);
    inner.appendChild(ratioRow);
    inner.appendChild(ingWrap);
    inner.appendChild(stepsWrap);
    card.appendChild(inner);

    // 右滑刪除
    const swipeActions = document.createElement("div");
    swipeActions.className = "card-swipe-actions";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "swipe-delete-btn";
    deleteBtn.textContent = "刪除";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const ok = window.confirm(
        `確定要刪除「${recipe.name || "這個食譜"}」嗎？\n刪除後就不能復原囉。`
      );
      if (!ok) return;
      deleteRecipe(recipe.id);
    });

    swipeActions.appendChild(deleteBtn);
    card.appendChild(swipeActions);

    // 手機右滑效果
    let touchStartX = 0;
    let touchEndX = 0;

    card.addEventListener("touchstart", (e) => {
      if (!e.changedTouches || !e.changedTouches.length) return;
      touchStartX = e.changedTouches[0].clientX;
    });

    card.addEventListener("touchend", (e) => {
      if (!e.changedTouches || !e.changedTouches.length) return;
      touchEndX = e.changedTouches[0].clientX;
      const diff = touchEndX - touchStartX;
      if (diff < -30) card.classList.add("swiped");
      else if (diff > 30) card.classList.remove("swiped");
    });

    container.appendChild(card);
  });
}
