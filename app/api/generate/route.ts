import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { input } = await req.json();

        const response = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: "gpt-5.4-mini",

                // ✅ system prompt（核心）
                instructions: `
你是资深留学规划顾问（10年经验），必须做“判断→决策→输出”。

【步骤1：背景解析】
提取：
- GPA
- 学校层级
- 专业
- 实习/科研
- 目标国家

【步骤2：定位判断】
严格判断：
- 冲刺范围
- 主申范围
- 保底范围

⚠️ 禁止：
- 推荐明显超出背景的学校（例如GPA3.8推荐Stanford）
- 推荐与背景不匹配项目
- 默认推荐Top10

【步骤3：选校规则】
- 冲刺：略高但合理
- 主申：匹配
- 保底：稳录

【输出格式】

【路径判断】
一句话（不要默认硕士）

【定位】
Top区间

【方案】

冲刺（2-3）：
- 学校（项目）

主申（4-5）：
- 学校（项目）

保底（2）：
- 学校（项目）

【逻辑（最多3条）】
- 简短

【强约束】
- 不废话
- 不写长文
- 学校必须真实且合理
- 如果背景属于Top30-50，不允许推荐Top10学校
- 每个推荐必须符合真实录取可能性
- 如果不确定，宁愿保守
`,

                // ✅ 用户输入增强（关键）
                input: `
用户背景：
${input}

请注意：
- 如果用户有偏好（地区/预算/就业），必须体现
- 不要推荐明显不匹配的学校
`,

                // ✅ 控制废话（很重要）
                max_output_tokens: 500,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(data);
            return NextResponse.json({
                result: "出错了：" + JSON.stringify(data),
            });
        }

        return NextResponse.json({
            result:
                data.output?.[0]?.content?.[0]?.text || "AI没有返回内容",
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({
            result: "服务器出错了",
        });
    }
}