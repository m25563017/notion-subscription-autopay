import { Client } from "@notionhq/client";

export const notion = new Client({ auth: process.env.NOTION_TOKEN });

export const SUBS_DB_ID = process.env.NOTION_SUBS_DB_ID;
export const PAYMENTS_DB_ID = process.env.NOTION_PAYMENTS_DB_ID;

// ---- 依你「訂閱產品」資料庫的實際欄位名稱 ----
export const SUB_PROPS = {
    autoRenew: "自動續訂",
    paused: "暫停訂閱",
    cancelling: "準備取消",
    type: "訂閱類型",
    nextDue: "下次繳費時間",
    price: "價格",
    name: "名稱",
};

// ---- 依你「繳費紀錄」資料庫的實際欄位名稱 ----
export const PAY_PROPS = {
    product: "產品",
    payDate: "繳費日期",
    amount: "繳費金額",
    name: "名稱",
};

const LIFETIME_TYPE = "終"; // 訂閱類型 = 終 代表終身，不自動記帳

// 取得台北時區的 YYYY-MM-DD（避免 GitHub Actions 用 UTC 跑導致日期算錯）
export function taipeiDateOnly(date = new Date()) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    return fmt.format(date); // en-CA 語系剛好輸出 YYYY-MM-DD
}

function dateOnly(prop) {
    if (!prop) return null;
    const value = prop.type === "formula" ? prop.formula?.date : prop.date;
    if (!value?.start) return null;
    return value.start.slice(0, 10);
}

const getTitle = (prop) => prop?.title?.[0]?.plain_text ?? "";
const getNumber = (prop) => prop?.number ?? 0;
const getCheckbox = (prop) => prop?.checkbox ?? false;
const getSelect = (prop) => prop?.select?.name ?? null;

function parseSubscription(page) {
    const p = page.properties;
    return {
        pageId: page.id,
        name: getTitle(p[SUB_PROPS.name]),
        autoRenew: getCheckbox(p[SUB_PROPS.autoRenew]),
        paused: getCheckbox(p[SUB_PROPS.paused]),
        cancelling: getCheckbox(p[SUB_PROPS.cancelling]),
        type: getSelect(p[SUB_PROPS.type]),
        dueDate: dateOnly(p[SUB_PROPS.nextDue]),
        price: getNumber(p[SUB_PROPS.price]),
    };
}

// 抓出「符合自動記帳條件」的候選訂閱（到期與否在腳本裡另外判斷）
export async function queryAutoBillableSubscriptions() {
    const results = [];
    let cursor;
    do {
        const res = await notion.databases.query({
            database_id: SUBS_DB_ID,
            start_cursor: cursor,
            filter: {
                and: [
                    {
                        property: SUB_PROPS.autoRenew,
                        checkbox: { equals: true },
                    },
                    { property: SUB_PROPS.paused, checkbox: { equals: false } },
                    {
                        property: SUB_PROPS.cancelling,
                        checkbox: { equals: false },
                    },
                    {
                        property: SUB_PROPS.type,
                        select: { does_not_equal: LIFETIME_TYPE },
                    },
                ],
            },
        });
        results.push(...res.results);
        cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);

    return results.map(parseSubscription).filter((s) => s.dueDate);
}

// 抓「所有」訂閱（月報用，不篩選）
export async function queryAllSubscriptions() {
    const results = [];
    let cursor;
    do {
        const res = await notion.databases.query({
            database_id: SUBS_DB_ID,
            start_cursor: cursor,
        });
        results.push(...res.results);
        cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);

    return results.map(parseSubscription);
}

export async function loadSubscription(pageId) {
    const page = await notion.pages.retrieve({ page_id: pageId });
    return parseSubscription(page);
}

export async function paymentExists(subPageId, payDate) {
    const res = await notion.databases.query({
        database_id: PAYMENTS_DB_ID,
        filter: {
            and: [
                {
                    property: PAY_PROPS.product,
                    relation: { contains: subPageId },
                },
                { property: PAY_PROPS.payDate, date: { equals: payDate } },
            ],
        },
        page_size: 1,
    });
    return res.results.length > 0;
}

export async function createPayment({ subPageId, name, payDate, amount }) {
    await notion.pages.create({
        parent: { database_id: PAYMENTS_DB_ID },
        properties: {
            [PAY_PROPS.name]: { title: [{ text: { content: name } }] },
            [PAY_PROPS.product]: { relation: [{ id: subPageId }] },
            [PAY_PROPS.payDate]: { date: { start: payDate } },
            [PAY_PROPS.amount]: { number: amount },
        },
    });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
