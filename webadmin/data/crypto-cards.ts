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
 *
 * ────────────────────────────────────────────────────────────────
 * TODO 区（2026-07 批量新增 40 张「只有卡面」的条目，见文件下半部分 faceOnly 段）
 *
 * 这 40 条的 issuer / tier / badges **全部来自卡面图片的肉眼读取，未经核实**，
 * 只用于渲染卡面，不代表这张卡真的属于该卡组织或等级。除此之外一个字段都没填：
 * 费率、返现、开卡费、月费、手续费、汇率加点、KYC、地区、额度、链与币种、
 * 邀请码、上线状态 —— 一律 null，UI 渲染成「内容整理中」。
 *
 * ① 9 张品牌未确认（卡面无可辨识标识，**不允许按卡面特征猜品牌名**）：
 *    unknown-07 unknown-08 unknown-12 unknown-15 unknown-16
 *    unknown-22 unknown-28 unknown-31 unknown-35
 *    确认品牌后：改 slug（深链会变，注意同步外链）、改 name、删掉 variant 里的编号。
 *
 * ② 3 张疑似与现有条目是「同一产品的不同卡面」，需人工确认是否合并：
 *    plasma-visa-signature  ↔  plasma-one
 *    kast-visa-platinum     ↔  kast
 *    bybit-mastercard-virtual ↔ bybit-card
 *    按「同品牌多卡面各自独立成条、不合并不去重」的规则先各自建条。
 *    若确认是同一张卡，删掉新条目、把卡面信息并进老条目即可（组件零改动）。
 *
 * ③ 全部 40 条待补：facts / decision / tutorial 三块。补的时候记住第 2 条硬约束——
 *    没有实测来源就继续留 null，别为了「填满」写看起来合理的数字。
 * ────────────────────────────────────────────────────────────────
 */

/** 事实字段的「未核实」用 null 表示——比猜一个值诚实，UI 会显示「待核实」 */
export type Unknown<T> = T | null;

export interface CryptoCard {
  /** 唯一标识，用于 URL hash（#card-{slug}）。与 products.ts 的 id 对齐以便复用决策逻辑 */
  slug: string;
  name: string;
  issuer: Unknown<"Visa" | "Mastercard" | "Other">;
  /** 卡面印着的等级文案（Platinum / Signature / Infinite / Business…）。卡面没印就不填。
   *  纯展示：印在卡面右下角，不参与筛选排序，也不代表这张卡的实际权益。 */
  tier?: string;
  /** 同一品牌多个卡面时的区分文案（如 XPlace 蓝 / 银白，Zen 白 / PRO 绿）。
   *  刻意不做去重合并——不同卡面权益可能不同，合并等于替发卡方下结论。 */
  variant?: string;
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
  /** "pending" = 只收录了卡面，上线状态本身也未核实——不是「已上线」的同义词 */
  status: "live" | "waitlist" | "invite-only" | "deprecated" | "pending";

  /* 下面三块是「详情层」。整块 null = 还没整理，UI 渲染统一的「内容整理中」空状态。
     为什么是整块 null 而不是把每个字段填空字符串：空字符串会被渲染成空白区块，
     看起来像内容加载失败；null 让组件能明确知道「这块压根还没有」。 */
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
  } | null;

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
  } | null;

  tutorial: {
    prerequisites: string[];
    steps: { title: string; body: string; image?: string; tip?: string; warning?: string }[];
    faq?: { q: string; a: string }[];
    /** 站内完整教程。付费正文不在本文件，点过去由付费墙判定 */
    guide?: { href: string; free: boolean };
  } | null;
}

/* ── 卡面渐变的两个小工具：把 40 条重复的 art 字面量压成一行 ────────── */

/** 亮字卡面（深色底） */
const dark = (from: string, to: string): CryptoCard["art"] =>
  ({ type: "gradient", from, to, textColor: "light" });

/** 暗字卡面（浅色底） */
const pale = (from: string, to: string): CryptoCard["art"] =>
  ({ type: "gradient", from, to, textColor: "dark" });

/**
 * 「只有卡面」的占位条目工厂。
 *
 * 存在的意义不是省字数，是**结构性地堵死编造**：调用方只能传卡面相关的字段，
 * facts / decision / tutorial 由这里统一钉死成 null，
 * 想在批量新增里塞一个「看起来合理」的返现率，类型这关就过不去。
 */
function faceOnly(
  card: Pick<CryptoCard, "slug" | "name" | "issuer" | "art"> &
    Partial<Pick<CryptoCard, "tier" | "variant" | "badges">>
): CryptoCard {
  return {
    badges: [],
    ...card,
    invite: null, // 邀请码属于「不准编造」清单
    status: "pending",
    facts: null,
    decision: null,
    tutorial: null,
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

  /* ══════════════════════════════════════════════════════════════
   * 2026-07 批量收录：只有卡面，没有内容。
   *
   * 每一条的 issuer / tier / badges 都来自卡面图片的肉眼读取，未经核实；
   * 渐变色是按卡面主色**自行设计的装饰**，不是品牌资产、不是官方配色规范。
   * 详情三块一律 null（faceOnly 钉死），详见文件头 TODO 区。
   * ══════════════════════════════════════════════════════════════ */

  faceOnly({ slug: "krak", name: "Krak", issuer: "Mastercard", badges: ["VIRTUAL", "world elite debit"], art: dark("#FF3B24", "#A8180A") }),
  faceOnly({ slug: "peanut", name: "Peanut", issuer: "Visa", tier: "Platinum", art: dark("#FF4FD8", "#A21CAF") }),
  faceOnly({ slug: "metamask", name: "MetaMask", issuer: "Mastercard", art: dark("#F5841F", "#B45309") }),
  faceOnly({ slug: "n26", name: "N26", issuer: "Mastercard", art: dark("#2E8B7A", "#124F44") }),
  faceOnly({ slug: "dpt-oxygen", name: "DPT (oxygen)", issuer: "Visa", tier: "Platinum", art: pale("#FFFFFF", "#E7E5E4") }),

  // ⚠️ 疑似与上面的 plasma-one 是同一产品的不同卡面——待人工确认，见文件头 TODO ②
  faceOnly({ slug: "plasma-visa-signature", name: "Plasma", issuer: "Visa", tier: "Signature", variant: "深灰黑卡面", art: dark("#44403C", "#141210") }),

  faceOnly({ slug: "unknown-07", name: "待确认", issuer: "Visa", variant: "编号 07", art: pale("#FFFFFF", "#E7E5E4") }),
  faceOnly({ slug: "unknown-08", name: "待确认", issuer: "Visa", variant: "编号 08", badges: ["Debit"], art: dark("#3B82F6", "#1E3A8A") }),
  faceOnly({ slug: "lava", name: "Lava", issuer: "Visa", tier: "Infinite", art: dark("#1C1917", "#0A0908") }),
  faceOnly({ slug: "kolo", name: "Kolo", issuer: "Visa", art: pale("#4ADE50", "#15A33C") }),
  faceOnly({ slug: "kraken", name: "Kraken", issuer: "Mastercard", badges: ["VIRTUAL", "world elite debit"], art: pale("#F7F6F4", "#D2CEC9") }),
  faceOnly({ slug: "unknown-12", name: "待确认", issuer: "Visa", variant: "编号 12", art: dark("#22200F", "#0A0A05") }),
  faceOnly({ slug: "redotpay", name: "RedotPay", issuer: "Visa", tier: "Platinum", art: dark("#16A34A", "#04543A") }),
  faceOnly({ slug: "okx", name: "OKX", issuer: "Mastercard", art: dark("#2B2B2B", "#0A0A0A") }),
  faceOnly({ slug: "unknown-15", name: "待确认", issuer: "Visa", variant: "编号 15", badges: ["Debit"], art: pale("#DDD6FE", "#FBCFE8") }),
  faceOnly({ slug: "unknown-16", name: "待确认", issuer: "Visa", tier: "Signature", variant: "编号 16", art: dark("#818CF8", "#3730A3") }),
  faceOnly({ slug: "zen", name: "Zen", issuer: "Mastercard", variant: "白色卡面", badges: ["zero effort non-bank"], art: pale("#FFFFFF", "#E7E5E4") }),
  faceOnly({ slug: "tria", name: "Tria", issuer: "Visa", tier: "Platinum", art: dark("#152238", "#04070D") }),

  // ⚠️ 疑似与最上面的 kast 是同一产品的不同卡面——待人工确认，见文件头 TODO ②
  faceOnly({ slug: "kast-visa-platinum", name: "KAST", issuer: "Visa", tier: "Platinum", variant: "银色卡面", art: pale("#EDEBE8", "#B4AFA8") }),

  faceOnly({ slug: "nexo", name: "Nexo", issuer: "Mastercard", art: dark("#1E3A8A", "#0F1F4D") }),
  faceOnly({ slug: "startale", name: "Startale", issuer: "Visa", tier: "Platinum", art: pale("#F5F5F4", "#BDB9B4") }),
  faceOnly({ slug: "unknown-22", name: "待确认", issuer: "Mastercard", variant: "编号 22", badges: ["platinum debit"], art: dark("#1C1917", "#0A0908") }),
  faceOnly({ slug: "wirex", name: "Wirex", issuer: "Visa", badges: ["Virtual card"], art: pale("#E4DEFE", "#BEB0F5") }),
  faceOnly({ slug: "solayer", name: "Solayer", issuer: "Visa", tier: "Signature", badges: ["InfiniSVM"], art: dark("#0B4D3C", "#022C22") }),
  faceOnly({ slug: "slash", name: "Slash", issuer: "Visa", tier: "Business", art: pale("#EBD49B", "#B8925A") }),
  faceOnly({ slug: "hyperbeat", name: "Hyperbeat", issuer: "Visa", tier: "Platinum", art: dark("#8A817B", "#3D3733") }),
  faceOnly({ slug: "xplace-blue", name: "XPlace", issuer: "Visa", tier: "Platinum", variant: "蓝色卡面", art: dark("#3B82F6", "#16308F") }),
  faceOnly({ slug: "unknown-28", name: "待确认", issuer: "Visa", tier: "Platinum", variant: "编号 28", art: pale("#FFFFFF", "#F2F1EF") }),
  faceOnly({ slug: "jupiter", name: "Jupiter", issuer: "Visa", tier: "Platinum", art: dark("#0F2620", "#05100C") }),
  faceOnly({ slug: "tuyo", name: "Tuyo", issuer: "Visa", tier: "Platinum", art: dark("#14532D", "#04240F") }),
  faceOnly({ slug: "unknown-31", name: "待确认", issuer: "Visa", tier: "Platinum", variant: "编号 31", art: dark("#232020", "#0B0A0A") }),
  faceOnly({ slug: "bitget-wallet", name: "Bitget Wallet", issuer: "Mastercard", art: dark("#1D4ED8", "#152C7A") }),

  // 与 xplace-blue 同品牌不同卡面：刻意不合并，权益是否相同没有来源
  faceOnly({ slug: "xplace-silver", name: "XPlace", issuer: "Visa", tier: "Platinum", variant: "银白卡面", art: pale("#F7F6F4", "#CFCAC4") }),

  faceOnly({ slug: "solflare", name: "Solflare", issuer: "Mastercard", badges: ["debit"], art: dark("#211E1C", "#0A0908") }),
  faceOnly({ slug: "unknown-35", name: "待确认", issuer: "Visa", tier: "Platinum", variant: "编号 35", art: dark("#1F1C1B", "#080706") }),
  faceOnly({ slug: "mexc", name: "MEXC", issuer: "Visa", tier: "Signature", art: dark("#2A2A2A", "#080808") }),

  // ⚠️ 疑似与上面的 bybit-card 是同一产品的不同卡面——待人工确认，见文件头 TODO ②
  faceOnly({ slug: "bybit-mastercard-virtual", name: "Bybit", issuer: "Mastercard", variant: "白色虚拟卡面", badges: ["Virtual", "prepaid"], art: pale("#FFFFFF", "#E7E5E4") }),

  // 与 zen 同品牌不同卡面：同上，不合并
  faceOnly({ slug: "zen-com-pro", name: "Zen.com PRO", issuer: "Mastercard", variant: "PRO 绿卡面", art: dark("#22C55E", "#14713A") }),

  faceOnly({ slug: "flex", name: "Flex", issuer: "Visa", tier: "Infinite Business", art: dark("#14532D", "#03210E") }),
  faceOnly({ slug: "moto", name: "Moto", issuer: "Visa", art: dark("#1F1D1C", "#070606") }),
];

/** 区块头用：全部卡片里最新的核对时间。只有卡面的条目没有核对时间，跳过 */
export function maxUpdatedAt(list: CryptoCard[] = cards): string {
  return list.reduce((max, c) => {
    const at = c.decision?.updatedAt;
    return at && at > max ? at : max;
  }, "");
}
