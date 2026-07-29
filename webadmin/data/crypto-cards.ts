/**
 * 加密支付卡数据层 —— /cards 模块的唯一事实来源。
 * 新增/删除一张卡 = 改这个文件，组件零改动。
 *
 * ⚠️ 两条硬约束，改这个文件前必读：
 *
 * 1. **本文件会被客户端组件 import，绝不能放付费内容。**
 *    data/decider/guides.ts 顶上那行 `import "server-only"` 是特意加的：
 *    paidMd / pitfallsMd 是 ¥19/¥29 在卖的商品，进了客户端 bundle 就等于白送。
 *    这里的 tutorial.steps 只放各篇教程 freeMd 里已经公开的内容，
 *    付费部分靠 guide.href 链去 /decider/guide/[id]，由服务端付费墙守着。
 *
 * 2. **不编造费率、限额、地区政策。**
 *    没有可靠来源的事实字段一律 null，UI 渲染成「待核实」而不是猜一个数。
 *    这跟 ComparisonTable 定下的原则一致（返现/年费不是结构化字段就不入表）。
 *    需要人来写的叙述性字段用 `TODO:` 前缀标出，一眼能扫出来还欠什么。
 *
 * 现有 3 张卡的内容全部迁移自 data/decider/products.ts 与 guides.ts 的免费层
 * （即 @zynqorw 本人实测教程），观点原样保留，未重写。
 */

/** 事实字段的「未核实」用 null 表示——比猜一个值诚实，UI 会显示「待核实」 */
export type Unknown<T> = T | null;

export interface CryptoCard {
  /** 唯一标识，用于 URL hash（#card-{slug}）。与 products.ts 的 id 对齐以便复用决策逻辑 */
  slug: string;
  name: string;
  issuer: Unknown<"Visa" | "Mastercard" | "Other">;
  /** 卡面是装饰性渲染，不是品牌资产：仓库没有卡面图，统一用暖色渐变 + 文字标识 */
  art: {
    type: "image" | "gradient";
    src?: string;
    from?: string;
    to?: string;
    logo?: string;
    textColor: "light" | "dark";
  };
  badges: string[];
  invite: { code: string; url: string } | null;
  /** 没有直达链接时的开户指引（如「应用商店搜索」「蹲邀请码」） */
  signupNote?: string;
  status: "live" | "waitlist" | "invite-only" | "deprecated";

  facts: {
    cashback: Unknown<string>;
    annualFee: Unknown<string>;
    fxFee: Unknown<string>;
    topUpFee: Unknown<string>;
    kyc: Unknown<"none" | "light" | "full">;
    regions: Unknown<string[]>;
    blockedRegions?: string[];
    chains: Unknown<string[]>;
    stablecoins: Unknown<string[]>;
    applePay: Unknown<boolean>;
    googlePay: Unknown<boolean>;
    physicalCard: Unknown<boolean>;
    limits: Unknown<string>;
    custody: Unknown<"custodial" | "self-custody">;
    /** 某个事实带条件时的补充说明（如「取决于开卡时的国家选择」） */
    notes?: Partial<Record<"applePay" | "googlePay" | "regions" | "cashback", string>>;
  };

  decision: {
    verdict: string;
    bestFor: string[];
    notFor: string[];
    pros: string[];
    cons: string[];
    /** 风控/冻结/跑路风险。没有实测来源就留 TODO——这一栏最不能猜 */
    risks: string[];
    /** 核对时间。来源（guides.ts verified_at）只精确到月，故用 YYYY-MM */
    updatedAt: string;
  };

  tutorial: {
    prerequisites: string[];
    steps: { title: string; body: string; image?: string; tip?: string; warning?: string }[];
    faq?: { q: string; a: string }[];
    /** 站内完整教程。付费正文不在本文件，点过去由付费墙判定 */
    guide?: { href: string; free: boolean };
  };
}

export const cards: CryptoCard[] = [
  // ── KAST：门槛最低的一张，放第一位（默认排序 = 本数组顺序）────────
  {
    slug: "kast",
    name: "KAST Visa 稳定币卡",
    issuer: "Visa",
    art: { type: "gradient", from: "#78350f", to: "#292524", textColor: "light" },
    badges: ["无需海外地址", "新人积分", "可绑 Apple / Google Pay"],
    invite: { code: "O0J1Z2AL", url: "https://app.kast.xyz/referral/O0J1Z2AL" },
    status: "live",
    facts: {
      cashback: null,
      annualFee: null,
      fxFee: null,
      topUpFee: null,
      kyc: "full", // 教程免费层：需上传护照 + 填资金来源 + 地址证明
      regions: null, // 已知「大陆护照可开」，但完整支持地区列表无来源
      chains: null,
      stablecoins: null, // 名为稳定币卡，但免费层未点名具体币种
      applePay: true, // 教程目录第三步：开虚拟卡并绑定 Apple Pay / Google Pay
      googlePay: true,
      physicalCard: true, // 坑位提到「实体卡要先确认地区支持寄送」
      limits: null,
      custody: null,
    },
    decision: {
      verdict: "无需海外地址、KYC 较友好，适合大陆护照先上车的人。",
      bestFor: ["持大陆护照、暂时拿不出海外地址证明", "想先开一张能用的卡试水"],
      notFor: ["TODO: 补充明确不适合的人群"],
      pros: ["不需要海外地址证明", "注册填邀请码可拿新人积分", "可绑 Apple Pay / Google Pay"],
      cons: ["验证码接收对 +86 手机号不友好", "充值路径有讲究", "实体卡要先确认地区支持寄送"],
      risks: ["TODO: 风控/冻结/跑路风险未实测核实——发布前必须补真实来源，不要凭印象写"],
      updatedAt: "2026-07",
    },
    tutorial: {
      prerequisites: ["护照（KYC 用）", "一个常用邮箱", "能收验证码的手机号（+86 大概率收不到，最好备海外号）"],
      steps: [
        {
          title: "注册账号并设置 PIN",
          body: "下载 KAST App，用邮箱 + 手机号注册，过程中设置 PIN。",
          tip: "注册时填入邀请码 O0J1Z2AL（或直接走邀请链接）可拿新人积分——这一步过了就没机会补。",
        },
        {
          title: "完成 KYC 身份认证",
          body: "用护照完成身份认证，KYC 通过后才能充值和开卡。逐步实操见完整版教程。",
        },
        {
          title: "开虚拟卡并绑定 Apple Pay / Google Pay",
          body: "TODO: 免费层未公开该步骤细节，完整版教程里有。",
        },
        { title: "首次充值与消费", body: "TODO: 免费层未公开该步骤细节，完整版教程里有。" },
      ],
      guide: { href: "/decider/guide/kast", free: false },
    },
  },

  // ── Bybit Card：Bitget U 卡对大陆暂停后的替代 ─────────────────────
  {
    slug: "bybit-card",
    name: "Bybit Card",
    issuer: null, // TODO: 卡组织未核实（仓库素材未提及 Visa/Mastercard）
    art: { type: "gradient", from: "#44403c", to: "#1c1917", textColor: "light" },
    badges: ["首月最高 10% 返现", "10 USDT 体验金", "约 5 分钟开卡"],
    invite: { code: "RRBQBG1", url: "https://bybit.com/cards/?ref=RRBQBG1&source=applet_invite" },
    status: "live",
    facts: {
      cashback: "首月最高 10%（走邀请链接解锁）",
      annualFee: null,
      fxFee: null,
      topUpFee: null,
      kyc: "full", // 教程目录含「证件上传与地址填写」
      regions: null,
      chains: null,
      stablecoins: null,
      applePay: true,
      googlePay: null,
      physicalCard: null,
      limits: null,
      custody: null,
      notes: {
        applePay: "能否绑微信 / 支付宝 / Apple Pay 取决于申请时的国家选择，且不可逆——完整版教程有说明",
        cashback: "同时可得 10 USDT 体验金",
      },
    },
    decision: {
      verdict: "Bitget U 卡对大陆用户暂停后，实测下来最顺的替代，全程约 5 分钟。",
      bestFor: ["想快速开一张能用的卡", "订阅 Claude / ChatGPT 等 AI 服务"],
      notFor: ["TODO: 补充明确不适合的人群"],
      pros: ["开卡流程快，全程约 5 分钟", "首月消费返现比例高", "可绑 Apple Pay（取决于国家选择）"],
      cons: ["申请时的国家选择不可逆，选错后面全白做", "部分地区 IP 受限"],
      risks: ["TODO: 风控/冻结/跑路风险未实测核实——发布前必须补真实来源，不要凭印象写"],
      updatedAt: "2026-07",
    },
    tutorial: {
      prerequisites: ["一个 Bybit 账户", "护照或身份证件", "TODO: 其余前置条件待补"],
      steps: [
        {
          title: "登录 Bybit 并进入开卡入口",
          body: "Bybit 会限制部分国家的 IP（比如美国 IP）。如果代理节点被拒，可以直接关闭 VPN 操作——能正常登录就可以继续。",
          tip: "走邀请链接进开卡页（邀请码 RRBQBG1）可解锁 10% 返现和 10 USDT 体验金。",
        },
        {
          title: "国家选择——整个流程的成败点",
          body: "申请时有一个不可逆的选择，直接决定这张卡能不能绑微信、支付宝、Apple Pay。",
          warning: "选错了后面全白做。具体该选哪个国家见完整版教程。",
        },
        { title: "证件上传与地址填写", body: "TODO: 免费层未公开该步骤细节，完整版教程里有。" },
        { title: "首月返现怎么吃满", body: "TODO: 免费层未公开该步骤细节，完整版教程里有。" },
      ],
      guide: { href: "/decider/guide/bybit-card", free: false },
    },
  },

  // ── Plasma One：全文免费教程，但邀请码难拿 ────────────────────────
  {
    slug: "plasma-one",
    name: "Plasma One",
    issuer: "Visa",
    art: { type: "gradient", from: "#292524", to: "#0c0a09", textColor: "light" },
    badges: ["欧洲 IBAN 账户", "实体卡 + 虚拟卡", "USDT 充值"],
    invite: null,
    signupNote: "需要邀请码才能注册且数量有限——可关注 X @zynqorw 蹲邀请码",
    status: "invite-only",
    facts: {
      cashback: null,
      annualFee: null,
      fxFee: null,
      topUpFee: null,
      kyc: "full", // 需护照 + 香港地址 + 银行流水类地址证明
      regions: ["注册地区选香港（教程实测路径）"],
      chains: null,
      stablecoins: ["USDT"], // 教程原文：我用 USDT 测试，快速且丝滑
      applePay: null,
      googlePay: null,
      physicalCard: true, // 教程原文：提供实体卡 + 虚拟卡
      limits: null,
      custody: null,
      notes: { regions: "已知的是教程实测走香港注册路径，不代表完整支持地区列表" },
    },
    decision: {
      verdict: "Visa 借记卡 + 欧洲 IBAN 账户，但邀请码和地址证明是两道真门槛。",
      bestFor: ["拿得到邀请码，且有真实可取得的香港银行流水"],
      notFor: ["拿不到合规地址证明的人——建议先开不需要地址证明的卡（KAST / Bybit / SAVO）"],
      pros: ["实体卡 + 虚拟卡都有", "绑定欧洲 IBAN 账户", "USDT 入金实测快速"],
      cons: ["邀请码数量有限，难拿", "地址证明要求银行流水类文件，是最难的一步", "地区可用性会变"],
      risks: ["TODO: 风控/冻结/跑路风险未实测核实——发布前必须补真实来源，不要凭印象写"],
      updatedAt: "2026-07",
    },
    tutorial: {
      prerequisites: ["邀请码（数量有限）", "护照", "真实可取得的香港银行流水类地址证明"],
      steps: [
        {
          title: "拿到邀请码",
          body: "注册必须有邀请码，且数量有限。可以直接向 Grok 要邀请码——AI 检索比你快得多，每次给的几个码可能都无效，多试几次就行。",
          tip: "没邀请码的可以关注 X @zynqorw，作者有码会发出来。",
        },
        { title: "注册地区选香港", body: "后续需要提供香港地址与证明，一步一步来。" },
        {
          title: "填写个人信息并上传护照",
          body: "个人信息用英文填写，姓名一定要和护照上的一致；地址信息填写香港地址。上传护照时没有中国选项则默认地区香港，直接上传中国护照就可以通过。",
        },
        {
          title: "提交地址证明文件",
          body: "要求银行流水类文件。请使用你真实可取得的文件（如 ZA Bank 等香港账户的流水）。",
          warning:
            "没有合规途径拿到地址证明的话，建议先开不需要地址证明的卡（KAST / Bybit / SAVO），别在这里冒风险。",
          tip: "最后一步提交失败可以多次提交；证明文件如果是图片，打印出来拍照再提交通过率更高，提交成功基本秒审。",
        },
        { title: "入金", body: "开卡成功后入金很快，作者用 USDT 实测，快速且丝滑，日常使用没问题。" },
      ],
      guide: { href: "/decider/guide/plasma-one", free: true },
    },
  },
];

/** 区块头用：全部卡片里最新的核对时间 */
export function maxUpdatedAt(list: CryptoCard[] = cards): string {
  return list.reduce((max, c) => (c.decision.updatedAt > max ? c.decision.updatedAt : max), "");
}
