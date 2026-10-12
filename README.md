# Gerald Spencer's website

An Astro portfolio with React components for the selected-work rotation and image viewer, built as static HTML by Bazel. Markdown and original photos live in `content`. The committed `docs` directory is published by GitHub Pages at www.geraldhspencer.com.

## Build and preview

Install Bazelisk (or Bazel 9.2.0). Bazel downloads the pinned Node, npm, Astro, LLVM, and Typst tools. No separate Node, pnpm, Typst, or compiler installation is needed for these commands.

```sh
bazel build //:site
bazel run //:serve
bazel run //:export
bazel test //:tests
```

The preview is at http://127.0.0.1:1313. Rebuild after edits, then restart the preview. `--port 8080` and `--host 0.0.0.0` can be passed after `--`. `make` exports the site; `make serve` previews it.

`bazel build` writes only build outputs. `bazel run //:export` updates `docs` and its `.site-manifest.json`. Export removes obsolete generated files and their empty directories, preserves unrelated files, and refuses to replace generated files edited by hand. Commit source changes together with refreshed `docs` to publish through the existing `master:/docs` Pages settings.

## Build structure

`src/pages` uses Astro's file-based routing: the homepage, About, Works, and a `[slug].astro` page generated from the works collection. `src/layouts/SiteLayout.astro` supplies the shared layout and metadata. `src/content.config.ts` defines schemas and uses Astro's glob loader to read the Markdown in `content`.

`src/site.ts` holds shared identity and contact data. The public domain is the standard `site` setting in `astro.config.mjs`. Astro's official sitemap integration generates `sitemap-index.xml` and `sitemap-0.xml`. Static files live in `public`, including `CNAME` and `.nojekyll`.

`bazel/rules/site.bzl` declares separate image processing, Astro build, Astro checking, React type checking, assembly, and export-manifest targets. Astro owns content processing, client/server bundling, and page generation. Bazel's `copy_to_directory` assembles Astro output, processed photographs, and `//resume:pdf` into `bazel-bin/site_dist`. Generated type files and build caches are declared outputs and are excluded from the published site.

React is hydrated only on the homepage (`SelectedWorks`) and project pages (`ImageViewer`). About and the Works index are static HTML with no hydrated components. Ordinary links and original images work without JavaScript. `src/lib/project-media.mjs` is a rehype plugin that connects Astro's Markdown rendering to the separately built WebP images and adds accessible image links and lazy video embeds.

`bazel/platforms` contains native host selection and the LLVM compile/link/run check. `bazel/rules/typst.bzl` is a small adaptation of the toolchain and preview-package patterns in `bazel-at-nvidia/rules_typst`; it invokes the pinned binary directly, without Bash. Dependencies and fonts are checksum-pinned, declared inputs. Typst compilation ignores system fonts and disables implicit package downloads.

## Résumé

Edit `resume/gerald-spencer.typ`. `bazel build //:resume` produces `bazel-bin/resume/gerald-spencer.pdf`; the site build includes it at `/gerald-spencer.pdf`, linked from the navigation. The build uses Inter and a fixed PDF creation timestamp for reproducibility.

## Content

Edit `content/about.md` and the projects in `content/works/<slug>/index.md`. A project uses YAML front matter:

```yaml
---
title: "2026 Event - Project name"
date: 2026-08-30T12:00:00-07:00
draft: false
cover: "images/project.jpg"
coverAlt: "Description of the installation"
featured: true
featuredOrder: 1
---
```

Place original images in that project's `images` directory. Markdown image references such as `images/project.jpg` resolve to the project's public images. The build creates WebP sizes without enlarging images, and retains originals for the image viewer. Inline HTML is allowed for video embeds; author it as trusted source content.

Projects use `/works/<slug>/`. React randomly selects three projects with photographs when the homepage loads, avoiding the previous leading project in the same tab. They stay in place for that visit. The generated HTML uses up to three projects with `featured: true`, sorted by optional `featuredOrder` metadata. Unordered featured projects follow in newest-first order. The Works index is always newest first.

## Host platforms and tools

The local host's OS and CPU come from Bazel's host platform. On Linux, shared detection selects musl or glibc for LLVM, Node, and native npm packages; glibc targets use the LLVM toolchain's 2.28 baseline. Node 22.22.3 uses official releases on macOS, Windows, and glibc Linux, and checksum-pinned Node unofficial-builds on musl Linux. Musl hosts need the normal `libstdc++` runtime package, as required by those Node binaries. The supported matrix is macOS, Linux, and Windows on x86_64 and ARM64. Production actions use local sandboxing on macOS/Linux and local execution on Windows. Remote execution and remote caching are disabled.

LLVM 0.8.24 provides the registered native compiler, linker, headers, and runtimes, including a hermetic macOS SDK downloaded from Apple. Astro/React run with pinned Node; native npm tools use their pinned platform binaries. `//bazel/platforms:llvm_test` compiles, links, and runs with LLVM. Application tools are Node programs, not shell scripts.

The GitHub Actions workflow is configured to build and test all six OS/CPU combinations. It does not publish or modify the committed site. Local validation has been run on macOS ARM64. macOS x86_64, Linux, and Windows hosts are unavailable for local execution and await that workflow; its Linux runners use glibc. The musl variants are configured but have not been executed here or in CI.

To update npm dependencies, edit `package.json`, then use Bazel-managed pnpm with the absolute checkout path:

```sh
bazel run @pnpm//:pnpm -- --dir /absolute/path/to/g3-site install --lockfile-only --ignore-scripts
```

Commit `pnpm-lock.yaml` and any resulting changes to `MODULE.bazel.lock`. Packages do not run installation lifecycle scripts; native dependencies come from platform packages in the lockfile.

## Browser checks

```sh
bazel run //:playwright -- install chromium
bazel run //:browser_checks
```

Browser checks cover desktop/mobile light and dark themes, hydration, reduced motion, image viewer keyboard controls and focus restoration, résumé downloads, and navigation without JavaScript. Screenshots are written to `test-results`. `PLAYWRIGHT_BROWSERS_PATH` can select a browser-cache directory, and `G3_SCREENSHOT_DIR` can select a screenshot directory.

## Rust / WebGL experiment

Preview `/play/` with `bazel run //:serve`. Rust handles drawing and input;
GLSL shaders calculate the glowing strands. `rules_rs` builds the WASM and
`wasm-bindgen` generates its browser loader.

See [experiments/field/README.md](experiments/field/README.md) for the file map,
how each frame works, and where to change the effects.
