import "dotenv/config";
import { Resend } from "resend";
import { queryAllSubscriptions, taipeiDateOnly } from "./notion.js";

function monthlyCost(sub) {
  if (sub.paused) return 0;
  if (sub.type === "年") return sub.price / 12;
  if (sub.type === "月") return sub.price;
  return 0; // 終身或其他類型不計入月費
}

function typeBadge(type) {
  const label = type === "年" ? "年繳" : type === "月" ? "月繳" : type || "未知";
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:#eef2ff;color:#4338ca;font-size:12px;font-weight:600;white-space:nowrap;">${label}</span>`;
}

function row(s) {
  return `<tr>
    <td style="padding:12px 16px;border-bottom:1px solid #f1f1f4;font-size:14px;color:#111827;font-weight:600;">${s.name}</td>
    <td style="padding:12px 16px;border-bottom:1px solid #f1f1f4;">${typeBadge(s.type)}</td>
    <td style="padding:12px 16px;border-bottom:1px solid #f1f1f4;font-size:14px;color:#374151;">NT$${s.price}</td>
    <td style="padding:12px 16px;border-bottom:1px solid #f1f1f4;font-size:13px;color:#6b7280;">${s.dueDate ?? "-"}</td>
  </tr>`;
}

function table(subs) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #eef0f3;border-radius:10px;overflow:hidden;">
    <tr style="background:#fafafa;">
      <th align="left" style="padding:10px 16px;font-size:11px;letter-spacing:.05em;color:#9ca3af;text-transform:uppercase;">名稱</th>
      <th align="left" style="padding:10px 16px;font-size:11px;letter-spacing:.05em;color:#9ca3af;text-transform:uppercase;">類型</th>
      <th align="left" style="padding:10px 16px;font-size:11px;letter-spacing:.05em;color:#9ca3af;text-transform:uppercase;">價格</th>
      <th align="left" style="padding:10px 16px;font-size:11px;letter-spacing:.05em;color:#9ca3af;text-transform:uppercase;">下次繳費</th>
    </tr>
    ${subs.map(row).join("")}
  </table>`;
}

function sectionCard({ emoji, title, subtitle, color, bg, subs, emptyText }) {
  if (!subs.length) {
    if (!emptyText) return "";
    return `<tr><td style="padding:0 24px 20px 24px;">
      <div style="background:${bg};border-left:4px solid ${color};border-radius:10px;padding:14px 18px;font-size:14px;color:#374151;">
        ${emptyText}
      </div>
    </td></tr>`;
  }
  return `<tr><td style="padding:0 24px 24px 24px;">
    <div style="font-size:16px;font-weight:800;color:${color};margin-bottom:2px;">${emoji} ${title}</div>
    ${subtitle ? `<div style="font-size:13px;color:#6b7280;margin-bottom:12px;">${subtitle}</div>` : `<div style="height:12px;"></div>`}
    ${table(subs)}
  </td></tr>`;
}

function buildHtml(subs, today) {
  const cancelling = subs.filter((s) => s.cancelling);
  const paused = subs.filter((s) => s.paused);
  const active = subs.filter((s) => !s.paused && !s.cancelling);
  const totalMonthly = Math.round(active.reduce((sum, s) => sum + monthlyCost(s), 0));

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:32px 24px;" bgcolor="#7c3aed">
                <div style="font-size:22px;font-weight:800;color:#ffffff;">📬 訂閱管家來報到</div>
                <div style="font-size:13px;color:#e9e4ff;margin-top:4px;">${today} 的荷包體檢報告</div>
              </td>
            </tr>

            <!-- Stat -->
            <tr>
              <td style="padding:24px 24px 8px 24px;">
                <div style="background:#f5f3ff;border-radius:12px;padding:18px 20px;">
                  <div style="font-size:12px;color:#7c3aed;font-weight:700;letter-spacing:.05em;text-transform:uppercase;">目前有效訂閱・每月約花費</div>
                  <div style="font-size:32px;font-weight:800;color:#4c1d95;margin-top:4px;">NT$${totalMonthly}</div>
                  <div style="font-size:12px;color:#8b7cb8;margin-top:2px;">這是每個月默默從口袋溜走的金額 💸</div>
                </div>
              </td>
            </tr>

            <tr><td style="height:12px;"></td></tr>

            <!-- 有效訂閱 -->
            ${sectionCard({
              emoji: "✅",
              title: "正常運作中的訂閱",
              subtitle: "這些每個月會準時扣款",
              color: "#059669",
              bg: "#ecfdf5",
              subs: active,
              emptyText: "目前沒有正常計費中的訂閱",
            })}

            <!-- 暫停中 -->
            ${sectionCard({
              emoji: "⏸️",
              title: "先睡一下的暫停訂閱",
              subtitle: "暫停中，暫時不計入每月花費",
              color: "#d97706",
              bg: "#fffbeb",
              subs: paused,
              emptyText: "",
            })}

              <!-- 準備取消 -->
            ${sectionCard({
              emoji: "🚨",
              title: "準備取消的訂閱",
              subtitle: "要記得取消這些花錢的東東喔qq",
              color: "#dc2626",
              bg: "#fef2f2",
              subs: cancelling,
              emptyText: "這個月沒有『說要取消但忘記』的訂閱，你很棒 🎉",
            })}

            <!-- Footer -->
            <tr>
              <td style="padding:8px 24px 28px 24px;border-top:1px solid #f1f1f4;">
                <div style="font-size:12px;color:#9ca3af;padding-top:16px;">
                  由你的訂閱管家腳本自動寄出 🤖　如果資料看起來怪怪的，回 Notion 檢查一下欄位吧
                </div>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function main() {
  const today = taipeiDateOnly();
  const subs = await queryAllSubscriptions();
  const html = buildHtml(subs, today);

  const resend = new Resend(process.env.RESEND_API_KEY);

  // MAIL_FROM 沒設定的話，先用 Resend 提供的測試寄件地址
  // （測試地址只能寄給你自己註冊 Resend 的那個信箱；要寄給任何信箱，
  //   之後可以去 Resend 驗證自己的網域，再把 MAIL_FROM 換成該網域下的信箱）
  const from = process.env.MAIL_FROM || "onboarding@resend.dev";

  const { data, error } = await resend.emails.send({
    from,
    to: process.env.MAIL_TO,
    subject: `📋 訂閱狀況月報 ${today}`,
    html,
  });

  if (error) {
    throw new Error(`Resend 寄信失敗: ${JSON.stringify(error)}`);
  }

  console.log("月報已寄出", data?.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
