# 加密卡片卡面调研

调研日期：2026-07-31
调研人：Claude（Opus 5），受 @zynqorw 委托
适用范围：`data/crypto-cards.ts` 里的 43 张卡

---

## 0. 调研纪律（本文件的写作约束）

1. 只采信品牌官方站点（brand kit / press kit / 产品页）。**第三方 logo 聚合站一律不采信**
   —— IconScout、SeekLogo、Brandfetch、logotyp.us、altcoinsbox、brandlogos.net 等站点
   提供的所谓「品牌资源」既不代表官方授权，也无法核实是否为最新版本。
2. 不下载官方卡面渲染图 / 营销图 / 产品摄影，不从任何图片站抓卡面图。
3. 不 hotlink 外部图床或 CDN。
4. **找不到官方资源的标 `logo: pending`，绝不用相似品牌的图凑。**
   品牌名撞车时（Flex、Moto、Slash、Lava、Kolo、Peanut 这类通用词）尤其危险：
   贴错公司的 logo 比没有 logo 严重得多。
5. 与本仓库既有原则一致：没有可靠来源的字段留空 + TODO，不写「看起来合理」的内容。

---

## 1. 结论先行：官方 logo 未能落地，原因有二

### 1.1 工具层面：本环境无法把二进制资源取进仓库

| 尝试路径 | 结果 |
|---|---|
| `WebFetch` 取 SVG 文件 | 不可行。该工具把页面转成 markdown 后由小模型作答，不返回逐字节原文；对 raw 资源 URL 返回 404 |
| `curl` 直连品牌站 | 网络受限且不稳定：`example.com` 200、`n26.com` 301 可达；`metamask.io`、`jup.ag`、`raw.githubusercontent.com` 连接超时；`wirexapp.com` 传输 266KB/4.9MB 后中断 |
| `gh` CLI 取 GitHub 上的官方 brand repo | 环境未安装 `gh`（`command not found`） |

即：**当前环境没有任何一条可靠通路能把官方 SVG 取进仓库并核实其完整性。**

### 1.2 授权层面：即便取得，多数条款也不支持本站用法

本站 `/cards` 页面带返佣链接，属于商业用途。已核实的条款情况：

| 品牌 | 官方资源页 | 条款状况 |
|---|---|---|
| Kraken | `kraken.com/press/kraken-images` | 检索结果明确：logo 为注册商标，**未经书面许可不得商用**；需联系 press/legal |
| Bybit | `bybit.com/en/press` | 品牌素材主要面向**已注册联盟客户**，受 Affiliate Services Agreement 约束 |
| OKX | 未找到官方 brand/press 资源页 | 检索结果指向的全是第三方聚合站；商标商用需书面许可 |
| MetaMask | `metamask.io/assets`（另有 `github.com/MetaMask/brand-resources`） | 页面提供 Logo Pack（zip）与若干 SVG 直链，但**页面本身未声明任何许可条款**——无授权范围、无署名要求、无商用/非商用区分 |
| N26 | `n26.com/en-eu/logo-assets` | 提供 App Icon 与 Logo (Black RGB) 展示，**页面未声明任何使用条款**；资源托管在 Contentful CDN，仅供展示 |
| Wirex | `wirexapp.com/en-gb/press` | 有 press kit 下载按钮（含 logo），面向「想报道 Wirex 的人」，即**编辑/报道用途** |
| Nexo | 未找到官方 brand/press 资源页 | 检索结果全为第三方聚合站 |

「页面未声明条款」不等于可以随便用——商标默认受保护，沉默不是许可。
按纪律第 4 条，这些一律记为 `logo: pending`。

### 1.3 品牌身份本身未确认的卡

以下卡片的**品牌归属尚未核实**，在确认之前连搜索都不该做（搜错公司 = 贴错 logo）：

- 9 张卡面无可辨识标识：`unknown-07` `unknown-08` `unknown-12` `unknown-15` `unknown-16`
  `unknown-22` `unknown-28` `unknown-31` `unknown-35`
- 品牌名是通用词、极易撞车，需人工指认官方域名后才能调研：
  `krak` `peanut` `kolo` `lava` `tuyo` `moto` `flex` `slash` `xplace-blue` / `xplace-silver`
  `dpt-oxygen` `tria` `hyperbeat` `startale` `solayer` `kast`（KAST 官方域名已知为 kast.xyz，来自仓库既有邀请链接）

---

## 2. 逐卡调研结果

状态图例：
`logo: pending` = 未取得官方 logo，使用占位方案
`face: 未核实` = 未访问到官方产品页，卡面描述仅来自用户提供的卡面图片（肉眼读取，不代表官方设计规范）

> ⚠️ 下面每一条的「卡面观察」若标注「来源：用户提供的卡面图片」，那就**不是**官方产品页的设计规范，
> 只是对一张图的描述。它可以用来配色，但不能当作「官方卡面就长这样」引用。

### 已核实到官方资源页的品牌

#### MetaMask（`metamask`）
- 官方资源页：https://metamask.io/assets （查询日期 2026-07-31）
- 官方 brand repo：https://github.com/MetaMask/brand-resources （查询日期 2026-07-31）
- 提供内容：Logo Pack（zip）、$mUSD Artwork Pack、黑色 logo / fox 图标 / developer 变体的 SVG 直链
- 许可条款：**页面未声明**。未取得。
- `logo: pending`
- 卡面观察（来源：用户提供的卡面图片）：橙色底 `#F5841F`，右半幅为狐狸头几何图形，Mastercard 双圆标识在右下

#### N26（`n26`）
- 官方资源页：https://n26.com/en-eu/logo-assets （查询日期 2026-07-31）
- 官方新闻室：https://n26.com/en-eu/press
- 提供内容：N26 App Icon、N26 Logo (Black RGB)（托管于 images.ctfassets.net，仅展示）
- 品牌色（来自官方博客 https://n26.com/en-eu/blog/n26-new-logo-new-colors）：主色 teal，辅色 golden wheat / rhubarb / petrol blue
- 许可条款：**页面未声明**。未取得。
- `logo: pending`
- 卡面观察（来源：用户提供的卡面图片）：青绿渐变 `#2E8B7A`，右半幅有气泡/球体图案，左上角 N26 字标带下划线

#### Kraken（`kraken`）
- 官方页面：https://www.kraken.com/press/kraken-images （查询日期 2026-07-31）
- 许可条款：**明确限制**——注册商标，未经书面许可不得商用
- `logo: pending`（且短期内不应尝试取得）
- 卡面观察（来源：用户提供的卡面图片）：银白渐变，卡面标 VIRTUAL 与 world elite debit，Mastercard 标识在右下

#### Bybit（`bybit-card` / `bybit-mastercard-virtual`）
- 官方页面：https://www.bybit.com/en/press （查询日期 2026-07-31）
- 许可条款：品牌素材面向注册联盟客户，受 Affiliate Services Agreement 约束
- `logo: pending`
- 卡面观察（来源：用户提供的卡面图片）：白色卡面，标 Virtual 与 prepaid，Mastercard 标识在右下

#### Wirex（`wirex`）
- 官方页面：https://wirexapp.com/en-gb/press （查询日期 2026-07-31）
- 提供内容：press kit（含 logo 与公司介绍），面向报道用途
- 许可条款：未逐条取得（下载受阻，连接中断）
- `logo: pending`
- 卡面观察（来源：用户提供的卡面图片）：淡紫卡面，左上 wirex 字标，右上角标 Virtual card

#### OKX（`okx`）
- 未找到官方 brand/press 资源页（查询日期 2026-07-31）
- `logo: pending`
- 卡面观察（来源：用户提供的卡面图片）：黑色卡面，方块/像素纹理，Mastercard 标识在右下

#### Nexo（`nexo`）
- 未找到官方 brand/press 资源页（查询日期 2026-07-31）
- `logo: pending`
- 卡面观察（来源：用户提供的卡面图片）：深蓝 `#1E3A8A`，中央为立体 N 字标，Mastercard 标识在右下

### 未调研的品牌

以下卡片尚未开始调研，原因见 §1.3（品牌身份未确认）或调研预算未批：

`krak` `peanut` `dpt-oxygen` `plasma-one` `plasma-visa-signature` `lava` `kolo` `redotpay`
`zen` `zen-com-pro` `tria` `kast` `kast-visa-platinum` `startale` `solayer` `slash`
`hyperbeat` `xplace-blue` `xplace-silver` `jupiter` `tuyo` `bitget-wallet` `solflare`
`mexc` `flex` `moto`
+ 9 张 `unknown-*`

---

## 3. 建议

官方 logo 这条路在当前环境走不通（工具不通 + 条款不支持）。
「每张卡有独立视觉识别」这个目标**不依赖第三方 logo 也能达成**：
靠 `faceStyle` 配方系统（底色 / 渐变 / 图案 / 金属光泽的组合）+ 每张卡独立设计的
monogram 处理，做出 43 张互不重样的卡面，且全部是自有资产，无授权风险。

具体方案见与 @zynqorw 的对话记录（卡面配方方案）。若后续要接入官方 logo，
建议按品牌逐个走「官方 brand kit 明确许可 → 人工下载 → 记录条款 → 入库」的流程，
不要由自动化流程批量抓取。
