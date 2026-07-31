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
 * ③ 全部 40 条待补：detail 整块（facts 六项、decision 四组、tutorial / faq、
 *    risk、cta、lastVerified）。补的时候记住第 2 条硬约束——
 *    没有实测来源就继续留 pending，别为了「填满」写看起来合理的数字。
 *    facts 的 partial 态必须带 note，用来写清「已知信息的边界」。
 * ────────────────────────────────────────────────────────────────
 */

/** 事实字段的「未核实」用 null 表示——比猜一个值诚实，UI 会显示「待核实」 */
export type Unknown<T> = T | null;

/* ══════════════════════════════════════════════════════════════════
 * 卡面配方系统
 *
 * 一张卡的视觉身份由 faceStyle 一个字段决定，组件按 kind 分派渲染。
 * 全部是 CSS + 内联 SVG，仓库里没有、也不会有任何品牌位图资产。
 *
 * 为什么不用官方 logo：调研结论见 docs/card-faces-research.md。
 * 一句话——本环境取不到官方 SVG（工具不通），且已核实的品牌条款里没有
 * 一条明确允许带返佣链接的页面使用其商标。所以卡面识别度靠配方，不靠 logo。
 *
 * ⚠️ 这里的颜色是**装饰性设计**，不是从官方品牌规范抄来的，
 *    也不代表真实卡面就长这样。别把它当事实字段引用。
 * ══════════════════════════════════════════════════════════════════ */

/** 图案层可选的纹理。几何定义在 FacePatterns.tsx 里只声明一次，各卡按 id 复用 */
export type PatternId = "grid" | "dots" | "rays" | "waves" | "pixels" | "topo" | "circuit";

export type CardFace =
  | { kind: "solid"; color: string }
  | { kind: "linear"; from: string; to: string; angle: number }
  | { kind: "radial"; from: string; to: string; at: [number, number] }
  | { kind: "mesh"; stops: Array<{ color: string; at: [number, number] }> }
  | { kind: "metallic"; base: string; sheenAngle: number }
  /** 大字 logo 当图案：品牌首字母放大到出血，当作卡面的主视觉 */
  | { kind: "wordmark"; bg: string; markColor: string; scale: number }
  | { kind: "pattern"; bg: string; pattern: PatternId; opacity: number; blend: string };

/* ══════════════════════════════════════════════════════════════════
 * 详情面板 schema
 *
 * 一个事实字段有三种状态，渲染样式必须区分——「没核实」和「核实过但有边界」
 * 是两回事，混成同一种灰字等于把「我不知道」和「我知道但只知道一半」抹平。
 * ══════════════════════════════════════════════════════════════════ */

export type FactValue =
  /** 有可靠来源，可直接示人 */
  | { status: "verified"; value: string; note?: string }
  /** 只核实了一部分。note 必填——必须写清楚「已知信息的边界在哪」，
   *  例如地区只验证过一条注册路径，就得写明这不代表完整支持列表 */
  | { status: "partial"; value: string; note: string }
  /** 没核实过。渲染成斜体「待核实」，不允许省略字段、不允许填空字符串 */
  | { status: "pending" };

export interface TutorialStep {
  title: string;
  body: string;
  image?: string;
  tip?: string;
  warning?: string;
}

export interface CardDetail {
  /** 标题下一句话概述：核心价值 + 主要门槛 */
  summary: string;
  /** 顶部提示条。只在有硬性前置条件时出现（如「需要邀请码」），不是通用说明位 */
  notice?: string;
  facts: {
    cashback: FactValue;
    annualFee: FactValue;
    kyc: FactValue;
    region: FactValue;
    topUp: FactValue;
    custody: FactValue;
  };
  decision: {
    suitableFor: string[];
    notSuitableFor: string[];
    pros: string[];
    cons: string[];
  };
  tutorial: TutorialStep[] | null;
  faq: Array<{ q: string; a: string }> | null;
  /** 风险提示。允许 'TODO: xxx' 未完成项，渲染时照常显示，不隐藏 */
  risk: string[];
  cta?: {
    label: string;
    url: string;
    inviteCode?: string;
  };
  /** 站内完整教程入口。付费正文不在本文件，点过去由 /decider 的付费墙判定。
   *  schema 里额外保留这一项：它是付费漏斗入口，砍掉等于把三张卡的转化路径断了 */
  guide?: { href: string; free: boolean };
  /** 'YYYY-MM'，人工核对时间，由人提供，**不允许自动填当前日期**。
   *  null = 从没人工核对过（只收录了卡面的骨架卡），UI 显示「未核对」 */
  lastVerified: string | null;
}

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
  /** 卡面配方。深浅字色不在这里声明——由底色的相对亮度自动判定，见 lib/cardFace.ts */
  faceStyle: CardFace;
  badges: string[];
  /** "pending" = 只收录了卡面，上线状态本身也未核实——不是「已上线」的同义词 */
  status: "live" | "waitlist" | "invite-only" | "deprecated" | "pending";

  /** 只供筛选器使用的结构化布尔位，**不参与详情面板渲染**。
   *  详情面板的六项事实走 detail.facts（FactValue 三态）；这里单独留一份的原因是
   *  「有实体卡」「支持 Apple Pay」两个筛选 chip 需要能被程序判定的真假值，
   *  而 FactValue 是给人看的字符串，筛不了。两者不要互相同步——
   *  展示层写什么由人核对，筛选位只在确证之后才从 null 改成布尔。 */
  traits: {
    physicalCard: Unknown<boolean>;
    applePay: Unknown<boolean>;
    googlePay: Unknown<boolean>;
  };

  /** 详情面板的全部内容。骨架卡也有这个对象（facts 六项全 pending），
   *  不再用整块 null——schema 要求六个字段一个都不能省。 */
  detail: CardDetail;
}

/* ── 配方简写：把重复的字面量压成一行，读起来还能看出这张卡长什么样 ────── */

const linear = (from: string, to: string, angle = 135): CardFace => ({ kind: "linear", from, to, angle });
const radial = (from: string, to: string, x: number, y: number): CardFace =>
  ({ kind: "radial", from, to, at: [x, y] });
const solid = (color: string): CardFace => ({ kind: "solid", color });
const metallic = (base: string, sheenAngle = 108): CardFace => ({ kind: "metallic", base, sheenAngle });
const wordmark = (bg: string, markColor: string, scale = 1.4): CardFace =>
  ({ kind: "wordmark", bg, markColor, scale });
const pattern = (bg: string, id: PatternId, opacity: number, blend = "overlay"): CardFace =>
  ({ kind: "pattern", bg, pattern: id, opacity, blend });
const mesh = (...stops: Array<[string, number, number]>): CardFace =>
  ({ kind: "mesh", stops: stops.map(([color, x, y]) => ({ color, at: [x, y] as [number, number] })) });

/**
 * 「只有卡面」的占位条目工厂。
 *
 * 存在的意义不是省字数，是**结构性地堵死编造**：调用方只能传卡面相关的字段，
 * detail 骨架由这里统一钉死，
 * 想在批量新增里塞一个「看起来合理」的返现率，类型这关就过不去。
 *
 * 骨架的形状按 schema 纪律：facts 六项全部 pending（不省略、不填空串），
 * decision 四个数组为空，tutorial / faq 为 null，risk 一条 TODO，
 * lastVerified 为 null（从没人工核对过，不允许拿当前日期充数）。
 */
function faceOnly(
  card: Pick<CryptoCard, "slug" | "name" | "issuer" | "faceStyle"> &
    Partial<Pick<CryptoCard, "tier" | "variant" | "badges">>
): CryptoCard {
  const pending: FactValue = { status: "pending" };
  return {
    badges: [],
    ...card,
    status: "pending",
    traits: { physicalCard: null, applePay: null, googlePay: null },
    detail: {
      // summary 用 TODO 而不是空串：空串会渲染成一条看不见的空行，
      // 像是内容没加载出来；TODO 至少说清楚缺的是什么。
      summary: "TODO: 待补充一句话概述",
      facts: {
        cashback: pending,
        annualFee: pending,
        kyc: pending,
        region: pending,
        topUp: pending,
        custody: pending,
      },
      decision: { suitableFor: [], notSuitableFor: [], pros: [], cons: [] },
      tutorial: null,
      faq: null,
      risk: ["TODO: 待核实"],
      // cta 缺席 = 没有可信的开户入口。邀请码属于「不准编造」清单
      lastVerified: null,
    },
  };
}

export const cards: CryptoCard[] = [
  // ── KAST：门槛最低的一张，放第一位（默认排序 = 本数组顺序）────────
  {
    slug: "kast",
    name: "KAST Visa 稳定币卡",
    issuer: "Visa",
    faceStyle: linear("#78350f", "#292524", 135),
    badges: ["无需海外地址", "新人积分", "可绑 Apple / Google Pay"],
    status: "live",
    traits: { physicalCard: true, applePay: true, googlePay: true },
    detail: {
      summary: "无需海外地址、KYC 较友好，适合大陆护照先上车的人。",
      facts: {
        cashback: { status: "pending" },
        annualFee: { status: "pending" },
        // 教程免费层：需上传护照 + 填资金来源 + 地址证明
        kyc: { status: "verified", value: "完整（证件 + 地址证明）" },
        region: { status: "pending" }, // 已知「大陆护照可开」，但完整支持地区列表无来源
        topUp: { status: "pending" }, // 名为稳定币卡，但免费层未点名具体币种
        custody: { status: "pending" },
      },
      decision: {
        suitableFor: ["持大陆护照、暂时拿不出海外地址证明", "想先开一张能用的卡试水"],
        notSuitableFor: ["TODO: 补充明确不适合的人群"],
        pros: ["不需要海外地址证明", "注册填邀请码可拿新人积分", "可绑 Apple Pay / Google Pay"],
        cons: ["验证码接收对 +86 手机号不友好", "充值路径有讲究", "实体卡要先确认地区支持寄送"],
      },
      tutorial: [
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
      faq: null,
      risk: ["TODO: 风控/冻结/跑路风险未实测核实——发布前必须补真实来源，不要凭印象写"],
      cta: {
        label: "立即领取",
        url: "https://app.kast.xyz/referral/O0J1Z2AL",
        inviteCode: "O0J1Z2AL",
      },
      guide: { href: "/decider/guide/kast", free: false },
      lastVerified: "2026-07",
    },
  },

  // ── Bybit Card：Bitget U 卡对大陆暂停后的替代 ─────────────────────
  {
    slug: "bybit-card",
    name: "Bybit Card",
    issuer: null, // TODO: 卡组织未核实（仓库素材未提及 Visa/Mastercard）
    faceStyle: linear("#44403c", "#1c1917", 135),
    badges: ["首月最高 10% 返现", "10 USDT 体验金", "约 5 分钟开卡"],
    status: "live",
    traits: { physicalCard: null, applePay: true, googlePay: null },
    detail: {
      summary: "Bitget U 卡对大陆用户暂停后，实测下来最顺的替代，全程约 5 分钟。",
      // 原 facts.notes.applePay 的原文。新 schema 六项事实里没有 Apple Pay 这一格，
      // 但这句话讲的是「不可逆的前置选择」，正是 notice 的语义，故原样搬到这里，一字未改。
      notice:
        "能否绑微信 / 支付宝 / Apple Pay 取决于申请时的国家选择，且不可逆——完整版教程有说明",
      facts: {
        cashback: {
          status: "verified",
          value: "首月最高 10%（走邀请链接解锁）",
          note: "同时可得 10 USDT 体验金",
        },
        annualFee: { status: "pending" },
        kyc: { status: "verified", value: "完整（证件 + 地址证明）" }, // 教程目录含「证件上传与地址填写」
        region: { status: "pending" },
        topUp: { status: "pending" },
        custody: { status: "pending" },
      },
      decision: {
        suitableFor: ["想快速开一张能用的卡", "订阅 Claude / ChatGPT 等 AI 服务"],
        notSuitableFor: ["TODO: 补充明确不适合的人群"],
        pros: ["开卡流程快，全程约 5 分钟", "首月消费返现比例高", "可绑 Apple Pay（取决于国家选择）"],
        cons: ["申请时的国家选择不可逆，选错后面全白做", "部分地区 IP 受限"],
      },
      tutorial: [
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
      faq: null,
      risk: ["TODO: 风控/冻结/跑路风险未实测核实——发布前必须补真实来源，不要凭印象写"],
      cta: {
        label: "立即领取",
        url: "https://bybit.com/cards/?ref=RRBQBG1&source=applet_invite",
        inviteCode: "RRBQBG1",
      },
      guide: { href: "/decider/guide/bybit-card", free: false },
      lastVerified: "2026-07",
    },
  },

  // ── Plasma One：全文免费教程，但邀请码难拿 ────────────────────────
  {
    slug: "plasma-one",
    name: "Plasma One",
    issuer: "Visa",
    faceStyle: linear("#292524", "#0c0a09", 135),
    badges: ["欧洲 IBAN 账户", "实体卡 + 虚拟卡", "USDT 充值"],
    status: "invite-only",
    traits: { physicalCard: true, applePay: null, googlePay: null },
    detail: {
      summary: "Visa 借记卡 + 欧洲 IBAN 账户，但邀请码和地址证明是两道真门槛。",
      notice: "需要邀请码才能注册且数量有限——可关注 X @zynqorw 蹲邀请码",
      facts: {
        cashback: { status: "pending" },
        annualFee: { status: "pending" },
        kyc: { status: "verified", value: "完整（证件 + 地址证明）" }, // 需护照 + 香港地址 + 银行流水类地址证明
        region: {
          status: "partial",
          value: "注册地区选香港（教程实测路径）",
          note: "已知的是教程实测走香港注册路径，不代表完整支持地区列表",
        },
        topUp: { status: "verified", value: "USDT" }, // 教程原文：我用 USDT 测试，快速且丝滑
        custody: { status: "pending" },
      },
      decision: {
        suitableFor: ["拿得到邀请码，且有真实可取得的香港银行流水"],
        notSuitableFor: ["拿不到合规地址证明的人——建议先开不需要地址证明的卡（KAST / Bybit / SAVO）"],
        pros: ["实体卡 + 虚拟卡都有", "绑定欧洲 IBAN 账户", "USDT 入金实测快速"],
        cons: ["邀请码数量有限，难拿", "地址证明要求银行流水类文件，是最难的一步", "地区可用性会变"],
      },
      tutorial: [
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
      faq: null,
      risk: ["TODO: 风控/冻结/跑路风险未实测核实——发布前必须补真实来源，不要凭印象写"],
      guide: { href: "/decider/guide/plasma-one", free: true },
      lastVerified: "2026-07",
    },
  },

  /* ══════════════════════════════════════════════════════════════
   * 2026-07 批量收录：只有卡面，没有内容。
   *
   * 每一条的 issuer / tier / badges 都来自卡面图片的肉眼读取，未经核实；
   * 渐变色是按卡面主色**自行设计的装饰**，不是品牌资产、不是官方配色规范。
   * detail 一律是 faceOnly 钉死的骨架（facts 六项全 pending），详见文件头 TODO 区。
   * ══════════════════════════════════════════════════════════════ */

  faceOnly({ slug: "krak", name: "Krak", issuer: "Mastercard", badges: ["VIRTUAL", "world elite debit"], faceStyle: radial("#FF3B24", "#A8180A", 28, 74) }),
  faceOnly({ slug: "peanut", name: "Peanut", issuer: "Visa", tier: "Platinum", faceStyle: linear("#FF4FD8", "#A21CAF", 120) }),
  faceOnly({ slug: "metamask", name: "MetaMask", issuer: "Mastercard", faceStyle: radial("#F5841F", "#B45309", 76, 44) }),
  faceOnly({ slug: "n26", name: "N26", issuer: "Mastercard", faceStyle: radial("#3AA08C", "#10493F", 72, 34) }),
  faceOnly({ slug: "dpt-oxygen", name: "DPT (oxygen)", issuer: "Visa", tier: "Platinum", faceStyle: pattern("#F7F7F5", "circuit", 0.14, "multiply") }),

  // ⚠️ 疑似与上面的 plasma-one 是同一产品的不同卡面——待人工确认，见文件头 TODO ②
  faceOnly({ slug: "plasma-visa-signature", name: "Plasma", issuer: "Visa", tier: "Signature", variant: "深灰黑卡面", faceStyle: metallic("#3A3532", 118) }),

  faceOnly({ slug: "unknown-07", name: "待确认", issuer: "Visa", variant: "编号 07", faceStyle: mesh(["#F2F0EE", 20, 20], ["#E4E1DD", 78, 68], ["#FAFAF9", 50, 100]) }),
  faceOnly({ slug: "unknown-08", name: "待确认", issuer: "Visa", variant: "编号 08", badges: ["Debit"], faceStyle: mesh(["#1E3A8A", 78, 72], ["#5FA8FF", 22, 26], ["#2563EB", 50, 50]) }),
  faceOnly({ slug: "lava", name: "Lava", issuer: "Visa", tier: "Infinite", faceStyle: solid("#141110") }),
  faceOnly({ slug: "kolo", name: "Kolo", issuer: "Visa", faceStyle: pattern("#4ADE50", "dots", 0.2) }),
  faceOnly({ slug: "kraken", name: "Kraken", issuer: "Mastercard", badges: ["VIRTUAL", "world elite debit"], faceStyle: metallic("#E8E6E3", 102) }),
  faceOnly({ slug: "unknown-12", name: "待确认", issuer: "Visa", variant: "编号 12", faceStyle: pattern("#22200F", "rays", 0.42, "screen") }),
  faceOnly({ slug: "redotpay", name: "RedotPay", issuer: "Visa", tier: "Platinum", faceStyle: linear("#16A34A", "#04543A", 145) }),
  faceOnly({ slug: "okx", name: "OKX", issuer: "Mastercard", faceStyle: pattern("#2B2B2B", "grid", 0.16) }),
  faceOnly({ slug: "unknown-15", name: "待确认", issuer: "Visa", variant: "编号 15", badges: ["Debit"], faceStyle: mesh(["#DDD6FE", 18, 24], ["#FBCFE8", 82, 30], ["#A7F3D0", 50, 86]) }),
  faceOnly({ slug: "unknown-16", name: "待确认", issuer: "Visa", tier: "Signature", variant: "编号 16", faceStyle: linear("#818CF8", "#3730A3", 150) }),
  faceOnly({ slug: "zen", name: "Zen", issuer: "Mastercard", variant: "白色卡面", badges: ["zero effort non-bank"], faceStyle: solid("#FBFBFA") }),
  faceOnly({ slug: "tria", name: "Tria", issuer: "Visa", tier: "Platinum", faceStyle: linear("#152238", "#04070D", 160) }),

  // ⚠️ 疑似与最上面的 kast 是同一产品的不同卡面——待人工确认，见文件头 TODO ②
  faceOnly({ slug: "kast-visa-platinum", name: "KAST", issuer: "Visa", tier: "Platinum", variant: "银色卡面", faceStyle: metallic("#EDEBE8", 96) }),

  faceOnly({ slug: "nexo", name: "Nexo", issuer: "Mastercard", faceStyle: linear("#1E3A8A", "#0F1F4D", 130) }),
  faceOnly({ slug: "startale", name: "Startale", issuer: "Visa", tier: "Platinum", faceStyle: pattern("#F0F0EE", "pixels", 0.5, "multiply") }),
  faceOnly({ slug: "unknown-22", name: "待确认", issuer: "Mastercard", variant: "编号 22", badges: ["platinum debit"], faceStyle: solid("#171412") }),
  faceOnly({ slug: "wirex", name: "Wirex", issuer: "Visa", badges: ["Virtual card"], faceStyle: linear("#E4DEFE", "#BEB0F5", 115) }),
  faceOnly({ slug: "solayer", name: "Solayer", issuer: "Visa", tier: "Signature", badges: ["InfiniSVM"], faceStyle: linear("#0B4D3C", "#022C22", 140) }),
  faceOnly({ slug: "slash", name: "Slash", issuer: "Visa", tier: "Business", faceStyle: metallic("#E3C57E", 112) }),
  faceOnly({ slug: "hyperbeat", name: "Hyperbeat", issuer: "Visa", tier: "Platinum", faceStyle: wordmark("#6E6763", "#565049", 1.5) }),
  faceOnly({ slug: "xplace-blue", name: "XPlace", issuer: "Visa", tier: "Platinum", variant: "蓝色卡面", faceStyle: mesh(["#16308F", 76, 74], ["#5B8DEF", 24, 30], ["#3B82F6", 48, 48]) }),
  faceOnly({ slug: "unknown-28", name: "待确认", issuer: "Visa", tier: "Platinum", variant: "编号 28", faceStyle: solid("#FCFCFB") }),
  faceOnly({ slug: "jupiter", name: "Jupiter", issuer: "Visa", tier: "Platinum", faceStyle: pattern("#0F2620", "waves", 0.34, "screen") }),
  faceOnly({ slug: "tuyo", name: "Tuyo", issuer: "Visa", tier: "Platinum", faceStyle: wordmark("#14532D", "#0C3A1F", 1.8) }),
  faceOnly({ slug: "unknown-31", name: "待确认", issuer: "Visa", tier: "Platinum", variant: "编号 31", faceStyle: solid("#232020") }),
  faceOnly({ slug: "bitget-wallet", name: "Bitget Wallet", issuer: "Mastercard", faceStyle: wordmark("#1D4ED8", "#4F82F0", 1.35) }),

  // 与 xplace-blue 同品牌不同卡面：刻意不合并，权益是否相同没有来源
  faceOnly({ slug: "xplace-silver", name: "XPlace", issuer: "Visa", tier: "Platinum", variant: "银白卡面", faceStyle: metallic("#F2F1EF", 100) }),

  faceOnly({ slug: "solflare", name: "Solflare", issuer: "Mastercard", badges: ["debit"], faceStyle: pattern("#211E1C", "grid", 0.12) }),
  faceOnly({ slug: "unknown-35", name: "待确认", issuer: "Visa", tier: "Platinum", variant: "编号 35", faceStyle: pattern("#1F1C1B", "topo", 0.3, "screen") }),
  faceOnly({ slug: "mexc", name: "MEXC", issuer: "Visa", tier: "Signature", faceStyle: linear("#2A2A2A", "#080808", 125) }),

  // ⚠️ 疑似与上面的 bybit-card 是同一产品的不同卡面——待人工确认，见文件头 TODO ②
  faceOnly({ slug: "bybit-mastercard-virtual", name: "Bybit", issuer: "Mastercard", variant: "白色虚拟卡面", badges: ["Virtual", "prepaid"], faceStyle: solid("#FBFBFA") }),

  // 与 zen 同品牌不同卡面：同上，不合并
  faceOnly({ slug: "zen-com-pro", name: "Zen.com PRO", issuer: "Mastercard", variant: "PRO 绿卡面", faceStyle: wordmark("#22C55E", "#0F7A38", 1.9) }),

  faceOnly({ slug: "flex", name: "Flex", issuer: "Visa", tier: "Infinite Business", faceStyle: metallic("#123F26", 120) }),
  faceOnly({ slug: "moto", name: "Moto", issuer: "Visa", faceStyle: radial("#2A2726", "#070606", 34, 26) }),
];

/** 区块头用：全部卡片里最新的人工核对时间。骨架卡的 lastVerified 是 null，跳过 */
export function maxUpdatedAt(list: CryptoCard[] = cards): string {
  return list.reduce((max, c) => {
    const at = c.detail.lastVerified;
    return at && at > max ? at : max;
  }, "");
}
