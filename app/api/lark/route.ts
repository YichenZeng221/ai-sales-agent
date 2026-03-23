type UserProfile = {
    school?: string;
    major?: string;
    gpa?: string;
    research?: boolean;
    target?: string;
};

const userProfiles = new Map<string, UserProfile>();
const userMemory = new Map<string, string>();

import { buildStudyAbroadPrompt } from "@/lib/studyAbroadPrompt";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log("收到 Lark 回调:", JSON.stringify(body, null, 2));

        // ✅ challenge
        if (body.challenge) {
            return Response.json({ challenge: body.challenge });
        }

        // ✅ 去重
        const eventId = body?.header?.event_id || body?.event_id;
        (globalThis as any).processedEvents =
            (globalThis as any).processedEvents || new Set();

        if ((globalThis as any).processedEvents.has(eventId)) {
            return Response.json({ ok: true });
        }
        (globalThis as any).processedEvents.add(eventId);

        // ✅ 过滤bot自己
        const senderType = body?.event?.sender?.sender_type;
        if (senderType === "app") {
            return Response.json({ ok: true });
        }

        // ✅ 解析消息
        const messageContent = body?.event?.message?.content;
        const openId = body?.event?.sender?.sender_id?.open_id;
        const messageType = body?.event?.message?.message_type;

        if (!messageContent || !openId) {
            return Response.json({ ok: true });
        }

        let userText = "";
        if (messageType === "text") {
            try {
                userText = JSON.parse(messageContent).text || "";
            } catch {
                userText = "";
            }
        }

        if (!userText) {
            return Response.json({ ok: true });
        }

        // ================================
        // 🧠 GPT自动解析用户画像（核心）
        // ================================
        let profile = userProfiles.get(openId) || {};

        const extractRes = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: "gpt-5.4-mini",
                input: `
请从用户输入中提取结构化信息，返回JSON：

字段：
- school（学校）
- major（专业）
- gpa（GPA）
- research（是否有科研 true/false）
- target（目标国家）

用户输入：
${userText}

只返回JSON，不要解释。
`,
            }),
        });

        const extractData = await extractRes.json();

        try {
            const extracted = JSON.parse(
                extractData?.output_text ||
                extractData?.output?.[0]?.content?.[0]?.text ||
                "{}"
            );

            profile = {
                ...profile,
                ...extracted,
            };
        } catch {
            console.log("解析失败，跳过结构化");
        }

        userProfiles.set(openId, profile);
        console.log("profile =", profile);

        // ================================
        // 🧠 历史记忆
        // ================================
        const history = userMemory.get(openId) || "";
        const fullInput = history + "\n" + userText;

        // ================================
        // 🧠 判断信息是否完整（销售核心）
        // ================================
        const isComplete =
            profile.school &&
            profile.major &&
            profile.gpa &&
            profile.target;

        // ================================
        // 🔐 获取 Lark token
        // ================================
        const tokenRes = await fetch(
            "https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    app_id: process.env.LARK_APP_ID,
                    app_secret: process.env.LARK_APP_SECRET,
                }),
            }
        );

        const tokenData = await tokenRes.json();
        const tenantAccessToken = tokenData?.tenant_access_token;

        if (!tenantAccessToken) {
            return Response.json({ ok: false, error: "获取token失败" });
        }

        // ================================
        // 🧠 主AI决策（销售逻辑）
        // ================================
        const prompt = buildStudyAbroadPrompt(`
用户画像：
${JSON.stringify(profile, null, 2)}

信息是否完整：
${isComplete ? "完整" : "不完整"}

规则：
- 如果信息不完整：只问问题，不给方案
- 如果信息完整：直接给选校方案（冲刺/主申/保底）

历史对话：
${fullInput}

用户最新输入：
${userText}
`);

        const aiRes = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: "gpt-5.4-mini",
                instructions: prompt.instructions,
                input: prompt.input,
                max_output_tokens: 800,
            }),
        });

        const aiData = await aiRes.json();

        const replyText =
            aiData?.output_text ||
            aiData?.output?.[0]?.content?.[0]?.text ||
            "这次没有成功生成回复";

        // ================================
        // 🧠 更新记忆
        // ================================
        userMemory.set(openId, fullInput.slice(-1000));

        // ================================
        // 📤 发回 Lark
        // ================================
        await fetch(
            "https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=open_id",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tenantAccessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    receive_id: openId,
                    msg_type: "text",
                    content: JSON.stringify({
                        text: replyText,
                    }),
                }),
            }
        );

        return Response.json({ ok: true });
    } catch (error) {
        console.error("error =", error);
        return Response.json({ ok: false }, { status: 500 });
    }
}