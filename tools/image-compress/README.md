# Image Compress

这个目录是从旧项目 `tools/image_compress` 的思路改出来的轻量版本，专门给当前 `Make24` 项目用。

保留了这些核心能力：

- 递归扫描输入目录
- PNG / JPG 分开压缩
- 缓存文件哈希，跳过未变化资源
- 支持镜像输出目录
- 支持原地压缩

刻意去掉了这些旧逻辑：

- Python 2 运行时
- TinyPNG key 和私有内网接口
- 旧项目里的 web_app / 测试目录
- 与当前项目无关的历史脚本

## 用法

查看帮助：

```bash
node tools/image-compress/compress-images.js --help
```

先看计划，不落盘：

```bash
node tools/image-compress/compress-images.js \
  --input assets/resources/sprites \
  --output /tmp/make24-sprites \
  --dry-run \
  --verbose
```

镜像输出压缩结果：

```bash
node tools/image-compress/compress-images.js \
  --input assets/resources/sprites \
  --output /tmp/make24-sprites
```

原地压缩：

```bash
node tools/image-compress/compress-images.js \
  --input assets/resources/sprites/cover \
  --in-place
```

## 工具探测

脚本会优先尝试这些压缩工具：

- PNG: `MAKE24_PNGQUANT_BIN` 环境变量指定路径
- PNG: 当前项目里的 `tools/image-compress/bin/pngout`
- PNG: 旧项目里的 `pngquant`
- PNG: 旧项目里的 `pngout`
- PNG: 系统 PATH 里的 `pngquant`
- PNG: 系统 PATH 里的 `pngout`
- JPG: `MAKE24_JPEGOPTIM_BIN` 环境变量指定路径
- JPG: 旧项目里的 `jpegoptim`
- JPG: 系统 PATH 里的 `jpegoptim`
- JPG: `/usr/bin/sips`

当前仓库已经带了一份可执行的 `pngout` 到 `tools/image-compress/bin/pngout`，脚本会优先尝试它来做 PNG 无损压缩。

如果 PNG / JPG 压缩工具不可用，脚本会保留原图并输出 warning，不会直接删文件。

## 超时说明

`pngout` 压大图会比较慢，当前默认单文件超时是 `30000ms`。  
如果像 `cover_bg.png` 这类大图仍然超时，可以单独加大：

```bash
node tools/image-compress/compress-images.js \
  --input assets/resources/sprites/cover/cover_bg.png \
  --output /tmp/cover-bg-preview \
  --timeout-ms 120000
```
