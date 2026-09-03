import "dotenv/config";
import {
    queryAutoBillableSubscriptions,
    loadSubscription,
    paymentExists,
    createPayment,
    taipeiDateOnly,
    sleep,
} from "./notion.js";

const MAX_CATCH_UP = 60; // 最多追平 60 期，避免公式異常造成無限迴圈
const WAIT_MS = 1200; // 等待 Notion formula/rollup 更新

async function main() {
    const today = taipeiDateOnly();
    const subs = await queryAutoBillableSubscriptions();

    console.log(`今天(台北時間): ${today}，檢查 ${subs.length} 筆自動續訂訂閱`);

    for (const sub of subs) {
        let dueDate = sub.dueDate;
        if (!dueDate || dueDate > today) continue;

        console.log(`[${sub.name}] 到期 ${dueDate}，開始追平`);

        for (let i = 0; i < MAX_CATCH_UP; i++) {
            if (!dueDate || dueDate > today) break;

            // 防重：同「產品 + 繳費日期」只允許一筆
            const exists = await paymentExists(sub.pageId, dueDate);
            if (!exists) {
                await createPayment({
                    subPageId: sub.pageId,
                    name: `${sub.name} ${dueDate}`,
                    payDate: dueDate,
                    amount: sub.price,
                });
                console.log(`  已新增繳費紀錄 ${dueDate}`);
            } else {
                console.log(`  ${dueDate} 已有紀錄，跳過`);
            }

            // 等待 Notion 端 formula/rollup 更新出新的「下次繳費時間」
            await sleep(WAIT_MS);

            const refreshed = await loadSubscription(sub.pageId);
            dueDate = refreshed.dueDate;

            if (!dueDate) break; // 防呆：如果變空就停

            if (i === MAX_CATCH_UP - 1) {
                console.warn(
                    `  [${sub.name}] 已達 ${MAX_CATCH_UP} 次追平上限，請人工檢查「下次繳費時間」公式是否異常`,
                );
            }
        }
    }

    console.log("完成");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
