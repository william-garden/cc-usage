# cc-usage

[English](README.md) | 简体中文

一个 Claude Code mod，在提示框上方靠右显示你当前的用量。

![cc-usage 显示在提示框上方](assets/screenshot.png)

## 安装

在终端（shell）里运行：

```bash
claude plugin install cc-usage --marketplace william-garden/cc-usage
```

在终端版 Claude Code 的会话里输入：

```
/plugin install cc-usage --marketplace william-garden/cc-usage
```

在桌面 app 里（不支持 `/plugin` 命令）：点提示框旁边的 + → Plugins → Add marketplace，填入 `william-garden/cc-usage`，再点 Add plugin。

出现添加 marketplace 的提示时输入 `y`，范围选 user，之后所有会话都会自动加载。

以后更新：

```bash
claude plugin marketplace update cc-usage
claude plugin update cc-usage@cc-usage
```

## 显示内容

```
context: 25%  5hs: 30% ( 2h30m )  weekly: 12% (2d10h)
input: 12.3k  output: 4.5k  cache hit: 1.2M  cost: $0.42
```

- **context**：当前上下文窗口的占用比例
- **5hs**：5 小时额度的用量，以及距离重置的剩余时间
- **weekly**：每周额度的用量，以及距离重置的剩余时间

- **input / output**：最近一轮的输入 token（不含缓存命中）和输出 token，不跨轮累加
- **cache hit**：最近一轮从提示缓存中读取的 token 数
- **cost**：本次会话的估算总花费，单位美元

第一行每块区域按用量变色：25% 以下绿色，25%–55% 蓝色，55%–75% 橙色，75%–100% 七彩渐变（每块区域从头到尾走一遍红 → 紫）。

数据来自 Claude 自身的额度读数，不需要配置任何 token。会话收到第一次 API 响应后才会显示数字；5 小时和每周额度需要 Claude 订阅（Pro/Max）。
