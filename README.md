# VideoHandle

视频帧处理工具 —— 一个基于浏览器的视频帧提取与编辑应用，支持在时间轴上标记时间点、批量提取帧图片并进行简单编辑。

## 技术栈

- [React 18](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)

## 环境要求

- [Node.js](https://nodejs.org/) 16 及以上版本
- npm（随 Node.js 一同安装）

## 启动步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

启动成功后，终端会显示本地访问地址（默认为 `http://localhost:5173`），在浏览器中打开即可使用。

## 其他命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（支持热更新） |
| `npm run build` | 构建生产版本，输出到 `dist/` 目录 |
| `npm run preview` | 本地预览生产构建结果 |

## 功能介绍

1. **上传视频**：点击上传区域或拖拽视频文件到页面。
2. **标记帧**：在时间轴上点击需要提取的时间点进行标记。
3. **提取帧**：
   - 点击 **Extract Current** 提取当前播放位置的帧。
   - 点击 **Extract Marked** 批量提取所有已标记的帧。
4. **编辑帧**：点击已提取的帧缩略图，在右侧编辑区进行处理。
