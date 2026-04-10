import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface BrandAsset {
  id: string;
  name: string;
  type: "color" | "font" | "logo" | "template" | "guideline" | "copy" | "hashtag";
  value: string;
  description: string;
  tags: string[];
  starred: boolean;
  category: string;
  createdAt: string;
}

interface BrandbookConfig {
  brandName: string;
  tagline: string;
  includeColors: boolean;
  includeFonts: boolean;
  includeLogos: boolean;
  includeCopy: boolean;
  includeTemplates: boolean;
  includeGuidelines: boolean;
  includeHashtags: boolean;
}

const A = "#d4a373";
const AD = "#a87040";
const BG = "#faf7f4";
const DARK = "#2a2420";
const TEXT = "#3a3a3a";
const GRAY = "#7a7a7a";

export async function generateBrandbookPDF(
  assets: BrandAsset[],
  config: BrandbookConfig,
  onProgress?: (msg: string) => void,
): Promise<number> {
  const colors = assets.filter(a => a.type === "color");
  const fonts = assets.filter(a => a.type === "font");
  const logos = assets.filter(a => a.type === "logo");
  const copies = assets.filter(a => a.type === "copy");
  const templates = assets.filter(a => a.type === "template");
  const guidelines = assets.filter(a => a.type === "guideline");
  const hashtags = assets.filter(a => a.type === "hashtag");

  const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  onProgress?.("Формирование брендбука...");

  // Preload fonts
  fonts.forEach(f => {
    const id = `gfont-${f.value.replace(/\s+/g, "-")}`;
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.value)}:wght@300;400;500;600;700&display=swap`;
      document.head.appendChild(link);
    }
  });
  await sleep(600);

  let html = "";

  // ─── COVER PAGE ───
  html += `
    <div style="background:linear-gradient(135deg, ${DARK} 0%, #1a1a1a 40%, #1e1c1a 100%);padding:80px 60px 60px;min-height:500px;display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        <div style="width:72px;height:72px;border-radius:18px;background:linear-gradient(135deg,${A},${AD});display:flex;align-items:center;justify-content:center;margin-bottom:32px;">
          <span style="color:#fff;font-size:30px;font-weight:800;">${config.brandName.slice(0, 2).toUpperCase()}</span>
        </div>
        <div style="font-size:48px;font-weight:800;color:#f0e0d0;letter-spacing:-1px;line-height:1.15;margin-bottom:12px;">
          ${esc(config.brandName)}
        </div>
        <div style="font-size:20px;color:rgba(240,224,208,0.6);margin-bottom:40px;">
          ${esc(config.tagline || "Брендбук")}
        </div>
        <div style="width:80px;height:3px;background:linear-gradient(90deg,${A},transparent);border-radius:2px;margin-bottom:40px;"></div>
        <div style="font-size:14px;color:rgba(240,224,208,0.35);text-transform:uppercase;letter-spacing:3px;">Brand Guidelines</div>
      </div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;">
        ${coverStat("Цвета", String(colors.length))}
        ${coverStat("Шрифты", String(fonts.length))}
        ${coverStat("Логотипы", String(logos.length))}
        ${coverStat("Шаблоны", String(templates.length))}
        ${coverStat("Гайдлайны", String(guidelines.length))}
        ${coverStat("Дата", today)}
      </div>
    </div>
  `;

  // ─── TABLE OF CONTENTS ───
  const tocItems: string[] = [];
  let secNum = 0;
  if (config.includeColors && colors.length) tocItems.push(`${++secNum}. Цветовая палитра`);
  if (config.includeFonts && fonts.length) tocItems.push(`${++secNum}. Типографика`);
  if (config.includeLogos && logos.length) tocItems.push(`${++secNum}. Логотипы`);
  if (config.includeCopy && copies.length) tocItems.push(`${++secNum}. Ключевые сообщения`);
  if (config.includeTemplates && templates.length) tocItems.push(`${++secNum}. Шаблоны контента`);
  if (config.includeGuidelines && guidelines.length) tocItems.push(`${++secNum}. Гайдлайны`);
  if (config.includeHashtags && hashtags.length) tocItems.push(`${++secNum}. Хэштег-наборы`);

  html += `
    <div style="padding:56px 60px;">
      ${sectionHead("Содержание")}
      <div style="margin-top:16px;">
        ${tocItems.map(t => `
          <div style="display:flex;align-items:baseline;gap:8px;padding:10px 0;border-bottom:1px dashed #e0d8d0;">
            <span style="font-size:15px;font-weight:600;color:${DARK};">${t}</span>
            <div style="flex:1;border-bottom:1px dotted #ccc;margin-bottom:4px;"></div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  secNum = 0;

  // ─── COLORS SECTION ───
  if (config.includeColors && colors.length) {
    onProgress?.("Цветовая палитра...");
    secNum++;

    // Primary palette
    const starred = colors.filter(c => c.starred);
    const others = colors.filter(c => !c.starred);

    html += `
      <div style="padding:48px 60px;border-top:4px solid ${BG};">
        ${sectionHead(`${secNum}. Цветовая палитра`)}
        <p style="font-size:13px;color:${GRAY};margin:0 0 28px;line-height:1.6;">
          Основные и дополнительные цвета бренда. Все значения указаны в HEX, RGB и HSL для удобства использования в разных средах.
        </p>

        ${starred.length > 0 ? `
          <div style="font-size:12px;font-weight:700;color:${AD};text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Основные цвета</div>
          <div style="display:flex;gap:0;margin-bottom:28px;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
            ${starred.map(c => `
              <div style="flex:1;min-width:0;">
                <div style="height:100px;background:${c.value};"></div>
                <div style="padding:12px 14px;background:#fff;border-bottom:1px solid #eee;">
                  <div style="font-size:13px;font-weight:700;color:${DARK};margin-bottom:2px;">${esc(c.name)}</div>
                  <div style="font-size:11px;font-family:monospace;color:${GRAY};">${c.value.toUpperCase()}</div>
                  ${rgbLine(c.value)}
                  ${hslLine(c.value)}
                  ${c.description ? `<div style="font-size:10px;color:#aaa;margin-top:4px;">${esc(c.description)}</div>` : ""}
                </div>
              </div>
            `).join("")}
          </div>
        ` : ""}

        ${others.length > 0 ? `
          <div style="font-size:12px;font-weight:700;color:${AD};text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Дополнительные цвета</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(140px, 1fr));gap:12px;margin-bottom:24px;">
            ${others.map(c => `
              <div style="border-radius:10px;overflow:hidden;border:1px solid #e8e0d8;">
                <div style="height:64px;background:${c.value};"></div>
                <div style="padding:10px 12px;background:#fff;">
                  <div style="font-size:12px;font-weight:600;color:${DARK};">${esc(c.name)}</div>
                  <div style="font-size:10px;font-family:monospace;color:${GRAY};">${c.value.toUpperCase()}</div>
                  ${rgbLine(c.value)}
                </div>
              </div>
            `).join("")}
          </div>
        ` : ""}

        <!-- Color harmony -->
        ${starred.length > 0 ? `
          <div style="font-size:12px;font-weight:700;color:${AD};text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Контраст и использование</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            ${starred.slice(0, 4).map(c => `
              <div style="border-radius:10px;overflow:hidden;border:1px solid #e8e0d8;">
                <div style="display:flex;height:48px;">
                  <div style="flex:1;background:${c.value};display:flex;align-items:center;justify-content:center;">
                    <span style="color:#fff;font-size:13px;font-weight:600;">White text</span>
                  </div>
                  <div style="flex:1;background:${c.value};display:flex;align-items:center;justify-content:center;">
                    <span style="color:#000;font-size:13px;font-weight:600;">Black text</span>
                  </div>
                </div>
                <div style="padding:6px 12px;background:#fff;font-size:10px;color:${GRAY};">
                  ${esc(c.name)} — ${c.value.toUpperCase()}
                </div>
              </div>
            `).join("")}
          </div>
        ` : ""}

        <!-- Full palette strip -->
        <div style="font-size:12px;font-weight:700;color:${AD};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Общая палитра</div>
        <div style="display:flex;height:40px;border-radius:10px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.05);">
          ${colors.map(c => `<div style="flex:1;background:${c.value};" title="${c.name}: ${c.value}"></div>`).join("")}
        </div>
      </div>
    `;
  }

  // ─── FONTS SECTION ───
  if (config.includeFonts && fonts.length) {
    onProgress?.("Типографика...");
    secNum++;

    html += `
      <div style="padding:48px 60px;border-top:4px solid ${BG};">
        ${sectionHead(`${secNum}. Типографика`)}
        <p style="font-size:13px;color:${GRAY};margin:0 0 28px;line-height:1.6;">
          Шрифтовая система бренда. Каждый шрифт показан в различных начертаниях и размерах.
        </p>

        ${fonts.map(f => `
          <div style="margin-bottom:28px;border:1px solid #e8e0d8;border-radius:12px;overflow:hidden;">
            <div style="background:${BG};padding:16px 20px;border-bottom:1px solid #e8e0d8;">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <div>
                  <span style="font-size:15px;font-weight:700;color:${DARK};">${esc(f.name)}</span>
                  <span style="font-size:11px;color:${GRAY};margin-left:8px;font-family:monospace;">${esc(f.value)}</span>
                </div>
                <div style="display:flex;gap:6px;">
                  ${f.tags.map(t => `<span style="background:rgba(212,163,115,0.15);color:${AD};font-size:9px;padding:2px 8px;border-radius:10px;">${esc(t)}</span>`).join("")}
                </div>
              </div>
              ${f.description ? `<div style="font-size:11px;color:${GRAY};margin-top:4px;">${esc(f.description)}</div>` : ""}
            </div>
            <div style="padding:20px;">
              <div style="font-family:'${f.value}',sans-serif;font-size:36px;font-weight:700;color:${DARK};margin-bottom:8px;">
                Аа Бб Вв Гг Дд Ее
              </div>
              <div style="font-family:'${f.value}',sans-serif;font-size:18px;color:${TEXT};margin-bottom:4px;">
                АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ
              </div>
              <div style="font-family:'${f.value}',sans-serif;font-size:14px;color:${TEXT};margin-bottom:4px;">
                абвгдежзиклмнопрстуфхцчшщъыьэюя
              </div>
              <div style="font-family:'${f.value}',sans-serif;font-size:14px;color:${GRAY};margin-bottom:16px;">
                AaBbCcDdEeFfGg 0123456789 !@#$%&amp;()
              </div>
              <div style="border-top:1px solid #eee;padding-top:12px;">
                ${[
                  { w: 300, l: "Light" },
                  { w: 400, l: "Regular" },
                  { w: 500, l: "Medium" },
                  { w: 600, l: "Semibold" },
                  { w: 700, l: "Bold" },
                ].map(wt => `
                  <div style="display:flex;align-items:baseline;gap:12px;padding:4px 0;">
                    <span style="font-size:10px;color:${GRAY};width:70px;flex-shrink:0;">${wt.l} (${wt.w})</span>
                    <span style="font-family:'${f.value}',sans-serif;font-weight:${wt.w};font-size:15px;color:${TEXT};">
                      Быстрая коричневая лиса прыгает через ленивую собаку
                    </span>
                  </div>
                `).join("")}
              </div>
              <div style="border-top:1px solid #eee;padding-top:12px;margin-top:8px;">
                <div style="font-size:10px;color:${GRAY};margin-bottom:6px;">Размеры:</div>
                ${[12, 14, 18, 24, 32].map(s => `
                  <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:4px;">
                    <span style="font-size:10px;color:${GRAY};width:40px;text-align:right;flex-shrink:0;">${s}px</span>
                    <span style="font-family:'${f.value}',sans-serif;font-size:${s}px;color:${DARK};font-weight:600;">
                      ${esc(config.brandName)} — Brand
                    </span>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  // ─── LOGOS SECTION ───
  if (config.includeLogos && logos.length) {
    onProgress?.("Логотипы...");
    secNum++;

    html += `
      <div style="padding:48px 60px;border-top:4px solid ${BG};">
        ${sectionHead(`${secNum}. Логотипы`)}
        <p style="font-size:13px;color:${GRAY};margin:0 0 28px;line-height:1.6;">
          Варианты логотипа для различных применений. Каждый вариант показан на белом, тёмном и прозрачном фонах.
        </p>

        ${logos.map(l => `
          <div style="margin-bottom:28px;border:1px solid #e8e0d8;border-radius:12px;overflow:hidden;">
            <div style="background:${BG};padding:12px 20px;border-bottom:1px solid #e8e0d8;">
              <span style="font-size:14px;font-weight:700;color:${DARK};">${esc(l.name)}</span>
              ${l.description ? `<span style="font-size:11px;color:${GRAY};margin-left:8px;">- ${esc(l.description)}</span>` : ""}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;">
              <div style="background:#ffffff;padding:24px;display:flex;align-items:center;justify-content:center;min-height:120px;border-right:1px solid #eee;">
                <img src="${l.value}" style="max-width:100%;max-height:90px;object-fit:contain;" crossorigin="anonymous" />
              </div>
              <div style="background:#1a1a1a;padding:24px;display:flex;align-items:center;justify-content:center;min-height:120px;border-right:1px solid #333;">
                <img src="${l.value}" style="max-width:100%;max-height:90px;object-fit:contain;" crossorigin="anonymous" />
              </div>
              <div style="background:repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 0 0/20px 20px;padding:24px;display:flex;align-items:center;justify-content:center;min-height:120px;">
                <img src="${l.value}" style="max-width:100%;max-height:90px;object-fit:contain;" crossorigin="anonymous" />
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;font-size:10px;color:${GRAY};text-align:center;">
              <div style="padding:6px;border-top:1px solid #eee;">На белом фоне</div>
              <div style="padding:6px;border-top:1px solid #eee;">На тёмном фоне</div>
              <div style="padding:6px;border-top:1px solid #eee;">Прозрачный фон</div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  // ─── COPY & MESSAGING ───
  if (config.includeCopy && copies.length) {
    onProgress?.("Ключевые сообщения...");
    secNum++;

    html += `
      <div style="padding:48px 60px;border-top:4px solid ${BG};">
        ${sectionHead(`${secNum}. Ключевые сообщения`)}
        <p style="font-size:13px;color:${GRAY};margin:0 0 28px;line-height:1.6;">
          Слоганы, призывы к действию и ключевые тексты бренда для использования в маркетинговых материалах.
        </p>

        ${copies.map(c => `
          <div style="margin-bottom:20px;border-left:3px solid ${A};padding:16px 20px;background:${BG};border-radius:0 10px 10px 0;">
            <div style="font-size:12px;font-weight:700;color:${AD};margin-bottom:6px;">${esc(c.name)}</div>
            <div style="font-size:16px;color:${DARK};font-style:italic;line-height:1.5;white-space:pre-wrap;">
              &ldquo;${esc(c.value)}&rdquo;
            </div>
            ${c.description ? `<div style="font-size:11px;color:${GRAY};margin-top:8px;">${esc(c.description)}</div>` : ""}
            ${c.tags.length ? `
              <div style="display:flex;gap:4px;margin-top:6px;">
                ${c.tags.map(t => `<span style="background:rgba(212,163,115,0.12);color:${AD};font-size:9px;padding:2px 8px;border-radius:10px;">${esc(t)}</span>`).join("")}
              </div>
            ` : ""}
          </div>
        `).join("")}
      </div>
    `;
  }

  // ─── TEMPLATES ───
  if (config.includeTemplates && templates.length) {
    onProgress?.("Шаблоны контента...");
    secNum++;

    html += `
      <div style="padding:48px 60px;border-top:4px solid ${BG};">
        ${sectionHead(`${secNum}. Шаблоны контента`)}
        <p style="font-size:13px;color:${GRAY};margin:0 0 28px;line-height:1.6;">
          Готовые шаблоны текстов для соцсетей, email-рассылок и других каналов коммуникации.
        </p>

        ${templates.map(t => `
          <div style="margin-bottom:24px;border:1px solid #e8e0d8;border-radius:12px;overflow:hidden;">
            <div style="background:${BG};padding:12px 20px;border-bottom:1px solid #e8e0d8;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <span style="font-size:13px;font-weight:700;color:${DARK};">${esc(t.name)}</span>
                ${t.description ? `<span style="font-size:11px;color:${GRAY};margin-left:8px;">- ${esc(t.description)}</span>` : ""}
              </div>
              <span style="font-size:10px;color:${GRAY};background:#fff;padding:2px 8px;border-radius:6px;border:1px solid #e0d8d0;">${t.category}</span>
            </div>
            <div style="padding:16px 20px;background:#fff;">
              <pre style="font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;color:${TEXT};white-space:pre-wrap;line-height:1.6;margin:0;">${esc(t.value)}</pre>
            </div>
            ${t.tags.length ? `
              <div style="padding:8px 20px;background:#fafafa;border-top:1px solid #eee;display:flex;gap:4px;">
                ${t.tags.map(tag => `<span style="background:rgba(245,158,11,0.1);color:#b45309;font-size:9px;padding:2px 8px;border-radius:10px;">${esc(tag)}</span>`).join("")}
              </div>
            ` : ""}
          </div>
        `).join("")}
      </div>
    `;
  }

  // ─── GUIDELINES ───
  if (config.includeGuidelines && guidelines.length) {
    onProgress?.("Гайдлайны...");
    secNum++;

    html += `
      <div style="padding:48px 60px;border-top:4px solid ${BG};">
        ${sectionHead(`${secNum}. Гайдлайны`)}
        <p style="font-size:13px;color:${GRAY};margin:0 0 28px;line-height:1.6;">
          Стандарты и правила использования элементов бренда.
        </p>

        ${guidelines.map(g => `
          <div style="margin-bottom:24px;border:1px solid #d0e8d8;border-radius:12px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#f0faf4,#eef7f0);padding:14px 20px;border-bottom:1px solid #d0e8d8;">
              <span style="font-size:14px;font-weight:700;color:${DARK};">${esc(g.name)}</span>
              ${g.description ? `<div style="font-size:11px;color:${GRAY};margin-top:2px;">${esc(g.description)}</div>` : ""}
            </div>
            <div style="padding:20px;background:#fff;">
              <pre style="font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;color:${TEXT};white-space:pre-wrap;line-height:1.65;margin:0;">${esc(g.value)}</pre>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  // ─── HASHTAGS ───
  if (config.includeHashtags && hashtags.length) {
    onProgress?.("Хэштег-наборы...");
    secNum++;

    html += `
      <div style="padding:48px 60px;border-top:4px solid ${BG};">
        ${sectionHead(`${secNum}. Хэштег-наборы`)}
        <p style="font-size:13px;color:${GRAY};margin:0 0 28px;line-height:1.6;">
          Тематические наборы хэштегов для использования в публикациях.
        </p>

        ${hashtags.map(h => {
          const tags = h.value.split(/\s+/).filter(t => t.startsWith("#"));
          return `
            <div style="margin-bottom:20px;border:1px solid #d0d8e8;border-radius:12px;overflow:hidden;">
              <div style="background:linear-gradient(135deg,#f0f4fa,#eef0f7);padding:12px 20px;border-bottom:1px solid #d0d8e8;display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <span style="font-size:13px;font-weight:700;color:${DARK};">${esc(h.name)}</span>
                  ${h.description ? `<span style="font-size:11px;color:${GRAY};margin-left:8px;">- ${esc(h.description)}</span>` : ""}
                </div>
                <span style="font-size:10px;color:#4a6fa5;background:rgba(74,111,165,0.1);padding:2px 8px;border-radius:10px;">${tags.length} тегов</span>
              </div>
              <div style="padding:14px 20px;background:#fff;display:flex;gap:6px;flex-wrap:wrap;">
                ${tags.map(tag => `<span style="display:inline-block;background:rgba(59,130,246,0.08);color:#2563eb;padding:4px 12px;border-radius:20px;font-size:12px;">${esc(tag)}</span>`).join("")}
              </div>
              <div style="padding:8px 20px;background:#fafafa;border-top:1px solid #eee;font-size:11px;color:${GRAY};font-family:monospace;">
                ${esc(h.value)}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  // ─── FOOTER ───
  html += `
    <div style="padding:32px 60px;border-top:3px solid ${A};">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span style="font-size:16px;font-weight:700;color:${DARK};">${esc(config.brandName)}</span>
          <span style="font-size:12px;color:${GRAY};margin-left:10px;">Brand Guidelines</span>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:${GRAY};">Сгенерировано: ${today}</div>
          <div style="font-size:10px;color:#bbb;margin-top:2px;">MarketPlan · AI-powered Marketing Planner</div>
        </div>
      </div>
    </div>
  `;

  // ─── RENDER TO PDF ───
  onProgress?.("Рендеринг PDF...");

  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:-9999px;top:0;width:794px;background:#fff;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#1a1a1a;line-height:1.5;";
  container.innerHTML = `<div style="padding:0;margin:0;">${html}</div>`;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    document.body.removeChild(container);

    onProgress?.("Сохранение...");

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfW = 210;
    const pdfH = 297;
    const imgW = pdfW;
    const imgH = (canvas.height * pdfW) / canvas.width;

    let pos = 0;
    let page = 0;

    while (pos < imgH) {
      if (page > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, -pos, imgW, imgH);
      pos += pdfH;
      page++;
    }

    const safeName = config.brandName.replace(/[^a-zA-Zа-яА-Я0-9]/g, "-");
    pdf.save(`${safeName}-Brandbook-${new Date().toISOString().slice(0, 10)}.pdf`);
    return page;
  } catch (err) {
    document.body.removeChild(container);
    console.error("Brandbook PDF error:", err);
    throw err;
  }
}

// ═══════════════════
// Helpers
// ═══════════════════

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function sectionHead(title: string): string {
  return `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">
      <div style="font-size:22px;font-weight:800;color:${DARK};letter-spacing:-0.3px;">${title}</div>
      <div style="flex:1;height:2px;background:linear-gradient(90deg,${A},transparent);border-radius:1px;"></div>
    </div>
  `;
}

function coverStat(label: string, val: string): string {
  return `
    <div style="background:rgba(212,163,115,0.12);border:1px solid rgba(212,163,115,0.2);border-radius:8px;padding:8px 16px;min-width:80px;">
      <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">${label}</div>
      <div style="font-size:16px;color:#f0e0d0;font-weight:700;margin-top:2px;">${val}</div>
    </div>
  `;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m || m.length < 3) return null;
  return { r: parseInt(m[0], 16), g: parseInt(m[1], 16), b: parseInt(m[2], 16) };
}

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function rgbLine(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "";
  return `<div style="font-size:10px;font-family:monospace;color:#999;">RGB(${rgb.r}, ${rgb.g}, ${rgb.b})</div>`;
}

function hslLine(hex: string): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return "";
  return `<div style="font-size:10px;font-family:monospace;color:#999;">HSL(${hsl.h}, ${hsl.s}%, ${hsl.l}%)</div>`;
}