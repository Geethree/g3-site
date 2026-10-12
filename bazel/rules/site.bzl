"""Astro's static portfolio build, with separately cached photos and résumé."""

load("@aspect_rules_js//js:defs.bzl", "js_binary", "js_library", "js_run_binary", "js_test")
load("@aspect_rules_ts//ts:defs.bzl", "ts_project")
load("@bazel_lib//lib:copy_to_directory.bzl", "copy_to_directory")
load("@npm//:astro/package_json.bzl", astro_bin = "bin")
load("@npm//:playwright/package_json.bzl", playwright_bin = "bin")

def portfolio_site():
    native.filegroup(
        name = "content_sources",
        srcs = native.glob(["content/**/*.md"]),
    )

    native.filegroup(
        name = "original_images",
        srcs = native.glob(["content/**/*.jpg", "content/**/*.jpeg", "content/**/*.png", "content/**/*.PNG"], allow_empty = True),
    )

    native.filegroup(
        name = "frontend_sources",
        srcs = native.glob(["src/**", "public/**"]) + ["astro.config.mjs", "tsconfig.json", "package.json"],
    )

    js_library(
        name = "build_tools",
        srcs = ["bazel/tools/lib.mjs"],
    )

    js_library(
        name = "test_tools",
        srcs = ["bazel/tools/export.mjs", "bazel/tools/serve.mjs"],
        deps = [":build_tools"],
    )

    js_binary(
        name = "image_tool",
        entry_point = "bazel/tools/images.mjs",
        data = [":build_tools", ":node_modules/sharp"],
    )

    js_run_binary(
        name = "images",
        tool = ":image_tool",
        srcs = [":original_images"],
        out_dirs = ["processed_images"],
        args = ["--output", "processed_images"],
        env = {"SHARP_IGNORE_GLOBAL_LIBVIPS": "1"},
        mnemonic = "PortfolioImages",
    )

    astro_bin.astro(
        name = "astro_build",
        srcs = [
            ":frontend_sources", ":content_sources", ":images", ":node_modules/astro",
            ":node_modules/@astrojs/react", ":node_modules/@astrojs/sitemap",
            ":node_modules/@astrojs/markdown-remark", ":node_modules/rehype-raw",
            ":node_modules/@fontsource/inter", ":node_modules/react", ":node_modules/react-dom",
        ],
        args = ["build"],
        out_dirs = ["astro_site", "astro_cache", ".astro"],
        env = {"ASTRO_TELEMETRY_DISABLED": "1"},
        mnemonic = "AstroBuild",
    )

    astro_bin.astro(
        name = "typecheck",
        srcs = [
            ":frontend_sources", ":content_sources", ":images", ":astro_build", ":node_modules/astro",
            ":node_modules/@astrojs/check", ":node_modules/typescript",
            ":node_modules/@types/react", ":node_modules/@types/react-dom",
            ":node_modules/@types/node", ":node_modules/@astrojs/react",
            ":node_modules/@astrojs/sitemap", ":node_modules/@astrojs/markdown-remark",
            ":node_modules/rehype-raw", ":node_modules/@fontsource/inter",
            ":node_modules/react", ":node_modules/react-dom",
        ],
        args = ["check", "--noSync", "--minimumFailingSeverity", "warning"],
        stdout = "astro-check.txt",
        env = {"ASTRO_TELEMETRY_DISABLED": "1"},
        mnemonic = "AstroCheck",
    )

    ts_project(
        name = "react_typecheck",
        srcs = native.glob(["src/components/*.tsx"]) + ["src/types.ts", "src/site.ts"],
        tsconfig = {
            "compilerOptions": {
                "target": "ES2022", "lib": ["ES2022", "DOM", "DOM.Iterable"],
                "module": "ESNext", "moduleResolution": "Bundler", "jsx": "react-jsx",
                "strict": True, "noEmit": True, "skipLibCheck": True,
                "allowSyntheticDefaultImports": True,
            },
        },
        no_emit = True,
        deps = [":node_modules/@types/react", ":node_modules/@types/react-dom", ":node_modules/react", ":node_modules/react-dom"],
    )

    copy_to_directory(
        name = "assembled_site",
        srcs = [":astro_build", ":images", "//resume:pdf"],
        out = "assembled_site",
        root_paths = ["astro_site", "processed_images", "resume"],
        exclude_srcs_patterns = ["astro_cache/**", ".astro/**", "**/images.json"],
    )

    js_binary(
        name = "manifest_tool",
        entry_point = "bazel/tools/manifest.mjs",
        data = [":build_tools"],
    )

    js_run_binary(
        name = "site_manifest",
        tool = ":manifest_tool",
        srcs = [":assembled_site"],
        outs = [".site-manifest.json"],
        args = ["--source", "assembled_site", "--output", ".site-manifest.json"],
        mnemonic = "SiteManifest",
    )

    copy_to_directory(
        name = "site_output",
        srcs = [":assembled_site", ":site_manifest"],
        out = "site_dist",
        root_paths = ["assembled_site"],
    )

    native.filegroup(
        name = "site",
        srcs = [":site_output", ":typecheck", ":react_typecheck"],
        visibility = ["//visibility:public"],
    )

    js_binary(
        name = "export",
        entry_point = "bazel/tools/export.mjs",
        data = [":build_tools", ":site"],
        chdir = ".",
    )

    js_binary(
        name = "serve",
        entry_point = "bazel/tools/serve.mjs",
        data = [":build_tools", ":site"],
        chdir = ".",
    )

    js_test(
        name = "pipeline_test",
        entry_point = "tests/pipeline.test.mjs",
        data = [":test_tools", ":content_sources", ":site"],
        chdir = ".",
        size = "small",
    )

    playwright_bin.playwright_binary(
        name = "playwright",
        data = [":node_modules/playwright"],
        node_options = ["--no-preserve-symlinks"],
        preserve_symlinks_main = False,
        patch_node_fs = False,
        chdir = ".",
    )

    js_binary(
        name = "browser_checks",
        entry_point = "tests/browser.test.mjs",
        data = [":node_modules/playwright", ":site", ":test_tools"],
        preserve_symlinks_main = False,
        patch_node_fs = False,
        chdir = ".",
    )

    native.test_suite(
        name = "tests",
        tests = [":pipeline_test", "//bazel/platforms:llvm_test"],
    )
