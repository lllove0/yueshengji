# 阅声记

阅声记是一个本地可运行的中英文阅读与语音打卡系统，包含阅读器、后台管理、用户管理、资源管理、文本/PDF/图片上传、内容编辑、浏览器语音朗读和分段打卡。

推荐项目仓库名称：

```text
yueshengji
```

## 功能

1. 用户登录
2. 角色区分：管理员、编辑、普通用户
3. 中英文阅读器
4. 阅读资源上传和编辑
5. TXT/MD 自动读取文本
6. PDF 文件上传保存并生成待处理资源
7. 图片上传保存并生成待 OCR 资源
8. 资源分类、状态、可见范围管理
9. 资源访问级别和价格字段预留
10. 用户套餐、账号状态、订阅到期日管理
11. 按段落自动生成打卡任务
12. 用户按阅读段落打卡
13. 今日打卡、本文进度、连续天数统计
14. 浏览器语音朗读
15. 后台用户管理

## 管理后台权限

- 管理员：可以管理阅读资源、上传文件、创建用户、修改用户角色、重置用户密码、删除用户
- 编辑：可以管理阅读资源和上传文件，不能管理用户
- 普通用户：只能阅读和打卡

## 本地运行

首次安装依赖：

```bash
npm install
```

开发模式：

```bash
npm run dev
```

默认访问：

```text
http://127.0.0.1:3000/
```

管理后台：

```text
http://127.0.0.1:3000/admin
```

后台子页面：

```text
http://127.0.0.1:3000/admin/resources
http://127.0.0.1:3000/admin/users
http://127.0.0.1:3000/admin/checkins
```

同一 Wi-Fi 下手机访问：

```text
http://你的电脑局域网IP:3000/
```

## 默认账号

管理员：

```text
admin / admin123
```

普通用户：

```text
reader / reader123
```

## 数据位置

运行后会自动生成本地数据和上传目录：

```text
data/app-db.json
uploads/
```

`data/app-db.json` 保存用户、阅读资源、打卡记录。`uploads/` 保存上传文件。

## 构建与生产启动

```bash
npm run build
npm start
```

## 文件解析说明

当前版本支持上传 TXT、MD、PDF 和图片。

- TXT/MD：自动读取文本并生成阅读段落
- PDF：保存原文件，并生成一条待处理资源
- 图片：保存原文件，并生成一条待 OCR 资源

后续可以在 `/api/uploads` 中接入 PDF 解析库，例如 `pdf-parse`，以及 OCR 服务，例如 PaddleOCR、Tesseract、腾讯云 OCR 或阿里云 OCR。接入后把解析出的文本写入资源 `content` 字段，再调用现有分段逻辑即可生成打卡段落。

## 后续商业化预留

当前资源已经包含 `status`、`visibility`、`category`、`accessLevel`、`priceCents` 等字段，用户也包含 `plan`、`accountStatus`、`subscriptionEndsAt` 字段，后续可以继续扩展：

- 支付订单和购买记录
- 资源付费权限校验
- 高质量 TTS 额度
- OCR/PDF 解析队列
- 管理后台资源审核流程
