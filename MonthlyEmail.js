import "dotenv/config";
import nodemailer from "nodemailer";
import { queryAllSubscriptions, taipeiDateOnly } from "./notion.js";

function monthlyCost(sub) {
    if (sub.paused) return 0;
    if (sub.type === "年") return sub.price / 12;
    if (sub.type === "月") return sub.price;
    return 0; // 終身或其他類型不計入月費
}

function row(s) {
    return `<tr>
    <td style="padding:6px 10px;">${s.name}</td>
    <td style="padding:6px 10px;">${s.type ?? "-"}</td>
    <td style="padding:6px 10px;">NT$${s.price}</td>
    <td style="padding:6px 10px;">${s.dueDate ?? "-"}</td>
  </tr>`;
}

function table(subs) {
    return `<table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
    <tr style="background:#f2f2f2;">
      <th style="padding:6px 10px;">名稱</th>
      <th style="padding:6px 10px;">類型</th>
      <th style="padding:6px 10px;">價格</th>
      <th style="padding:6px 10px;">下次繳費</th>
    </tr>
    ${subs.map(row).join("")}
  </table>`;
}

function buildHtml(subs, today) {
    const cancelling = subs.filter((s) => s.cancelling);
    const paused = subs.filter((s) => s.paused && !s.cancelling);
    const active = subs.filter((s) => !s.paused && !s.cancelling);
    const totalMonthly = Math.round(
        active.reduce((sum, s) => sum + monthlyCost(s), 0),
    );

    return `
    <h2>訂閱狀況月報（${today}）</h2>
    <p>目前有效訂閱，每月約花費：<b>NT$${totalMonthly}</b></p>

    ${
        cancelling.length
            ? `<h3>⚠️ 標記「準備取消」但還沒真的去平台取消的</h3>${table(cancelling)}`
            : `<p>目前沒有標記「準備取消」的訂閱 👍</p>`
    }

    ${paused.length ? `<h3>⏸️ 暫停中的訂閱</h3>${table(paused)}` : ""}

    <h3>✅ 目前有效訂閱</h3>
    ${table(active)}
  `;
}

async function main() {
    const today = taipeiDateOnly();
    const subs = await queryAllSubscriptions();
    const html = buildHtml(subs, today);

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });

    await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: process.env.MAIL_TO,
        subject: `訂閱狀況月報 ${today}`,
        html,
    });

    console.log("月報已寄出");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
