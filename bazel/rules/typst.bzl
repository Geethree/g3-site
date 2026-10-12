"""Small portable adaptation of bazel-at-nvidia/rules_typst 1.0.0.

Retains its toolchain and declared-preview-package approach. Compilation runs
Typst directly, with pinned fonts and no Bash or implicit package downloads.
"""

def _toolchain_impl(ctx):
    return [platform_common.ToolchainInfo(typst = ctx.executable.typst)]

typst_toolchain = rule(
    implementation = _toolchain_impl,
    attrs = {"typst": attr.label(executable = True, cfg = "exec", allow_single_file = True, mandatory = True)},
)

def _document_impl(ctx):
    typst = ctx.toolchains["//bazel/rules:typst_toolchain_type"].typst
    output = ctx.actions.declare_file(ctx.attr.out)
    args = ctx.actions.args()
    args.add("compile")
    args.add("--ignore-system-fonts")
    args.add("--creation-timestamp", "0")
    args.add("--input", "font=Inter")
    args.add("--package-cache-path", ctx.file._cache_marker.path)
    package_roots = {}
    for file in ctx.files.packages:
        index = file.path.find("/preview/")
        if index < 0:
            fail("Typst packages must be beneath a preview namespace: " + file.path)
        package_roots[file.path[:index]] = True
    for root in sorted(package_roots):
        args.add("--package-path", root)
    for root in sorted({font.dirname: True for font in ctx.files.fonts}):
        args.add("--font-path", root)
    args.add(ctx.file.src)
    args.add(output)
    ctx.actions.run(
        executable = typst,
        arguments = [args],
        inputs = depset([ctx.file.src, ctx.file._cache_marker] + ctx.files.deps + ctx.files.packages + ctx.files.fonts),
        outputs = [output],
        tools = [typst],
        env = {
            "HTTP_PROXY": "http://127.0.0.1:9",
            "HTTPS_PROXY": "http://127.0.0.1:9",
            "ALL_PROXY": "http://127.0.0.1:9",
            "NO_PROXY": "",
        },
        mnemonic = "TypstCompile",
        progress_message = "Compiling résumé %{label}",
    )
    return [DefaultInfo(files = depset([output]))]

typst_document = rule(
    implementation = _document_impl,
    attrs = {
        "src": attr.label(allow_single_file = [".typ"], mandatory = True),
        "out": attr.string(default = "document.pdf"),
        "deps": attr.label_list(allow_files = [".typ"]),
        "packages": attr.label_list(allow_files = True),
        "fonts": attr.label_list(allow_files = True),
        "_cache_marker": attr.label(default = ":package-cache-disabled", allow_single_file = True),
    },
    toolchains = ["//bazel/rules:typst_toolchain_type"],
)

_BINARIES = {
    "macos-aarch64": ("aarch64-apple-darwin", "470aa49a2298d20b65c119a10e4ff8808550453e0cb4d85625b89caf0cedf048"),
    "macos-x86_64": ("x86_64-apple-darwin", "4e91d8e1e33ab164f949c5762e01ee3faa585c8615a2a6bd5e3677fa8506b249"),
    "linux-x86_64": ("x86_64-unknown-linux-musl", "a6044cbad2a954deb921167e257e120ac0a16b20339ec01121194ff9d394996d"),
    "linux-aarch64": ("aarch64-unknown-linux-musl", "491b101aa40a3a7ea82a3f8a6232cabb4e6a7e233810082e5ac812d43fdcd47a"),
    "windows-x86_64": ("x86_64-pc-windows-msvc", "51353994ac83218c3497052e89b2c432c53b9d4439cdc1b361e2ea4798ebfc13"),
    "windows-aarch64": ("aarch64-pc-windows-msvc", "1c4aaa0de000ab1787dda354c34f4fa1fe3c2525d3d038e692a3d7daa333d551"),
}

def _binary_impl(rctx):
    host_os = rctx.os.name.lower()
    os = "macos" if "mac" in host_os else "windows" if "windows" in host_os else "linux" if "linux" in host_os else None
    if not os:
        fail("No pinned Typst executable for host " + host_os)
    arch = {"arm64": "aarch64", "amd64": "x86_64"}.get(rctx.os.arch, rctx.os.arch)
    platform = os + "-" + arch
    if platform not in _BINARIES:
        fail("No pinned Typst executable for host " + platform)
    distribution, checksum = _BINARIES[platform]
    archive = "zip" if os == "windows" else "tar.xz"
    rctx.download_and_extract(
        url = "https://github.com/typst/typst/releases/download/v0.14.2/typst-{}.{}".format(distribution, archive),
        sha256 = checksum,
        stripPrefix = "typst-" + distribution,
    )
    executable = "typst.exe" if os == "windows" else "typst"
    rctx.file("BUILD.bazel", 'exports_files(["{}"], visibility = ["//visibility:public"])\nalias(name = "typst", actual = ":{}", visibility = ["//visibility:public"])\n'.format(executable, executable) if os == "windows" else 'exports_files(["typst"], visibility = ["//visibility:public"])\n')

typst_binary_repository = repository_rule(implementation = _binary_impl, configure = True)

def _packages_impl(rctx):
    for name, version, checksum in zip(rctx.attr.names, rctx.attr.versions, rctx.attr.checksums):
        rctx.download_and_extract(
            url = "https://packages.typst.org/preview/{}-{}.tar.gz".format(name, version),
            sha256 = checksum,
            output = "packages/preview/{}/{}".format(name, version),
        )
    rctx.file("packages/BUILD.bazel", 'package(default_visibility = ["//visibility:public"])\nfilegroup(name = "packages", srcs = glob(["preview/**"]))\n')

_packages = repository_rule(
    implementation = _packages_impl,
    attrs = {"names": attr.string_list(), "versions": attr.string_list(), "checksums": attr.string_list()},
)

def _extension_impl(mctx):
    packages = {}
    for module in mctx.modules:
        for package in module.tags.package:
            for value in [package.name, package.version]:
                if not value or value in [".", ".."] or any([character in value for character in ["/", "\\", ":", "@", " "]]):
                    fail("Invalid Typst package name or version: " + value)
            if len(package.sha256) != 64:
                fail("Typst package archives require a SHA-256 checksum")
            key = package.name + "@" + package.version
            if key in packages and packages[key].sha256 != package.sha256:
                fail("Conflicting checksum for " + key)
            packages[key] = package
    ordered = [packages[key] for key in sorted(packages)]
    _packages(name = "typst_packages", names = [package.name for package in ordered], versions = [package.version for package in ordered], checksums = [package.sha256 for package in ordered])
    return mctx.extension_metadata(reproducible = True)

typst = module_extension(
    implementation = _extension_impl,
    tag_classes = {"package": tag_class(attrs = {"name": attr.string(mandatory = True), "version": attr.string(mandatory = True), "sha256": attr.string(mandatory = True)})},
)
