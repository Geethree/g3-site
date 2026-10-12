"""Libc-aware Linux repositories for the standard rules_nodejs toolchains."""

load(":repositories.bzl", "linux_libc")

# Node 22.22.3: official glibc releases and Node's unofficial-builds musl releases.
_ARCHIVES = {
    "x64-glibc": "2e5d13569282d016861fae7c8f935e741693c269101a5bebcf761a5376d1f99f",
    "arm64-glibc": "1c4a9933a5e45bc88f54f70b5f91232c127ec49f1a5989d23fb85824c7adf9b7",
    "x64-musl": "fc04ab27123cb34d2bca3416493e86ced2f81e1ab9b51e532721ed27a1ef677d",
    "arm64-musl": "e3724b567a6b939efb75a92af2ca40b4111f0b7653191583cd35cac62861f3df",
}

def _node_impl(rctx):
    version = rctx.read(rctx.attr.version_file).strip()
    if version != "22.22.3":
        fail("Update the Linux Node archive checksums when changing .nvmrc")
    libc = linux_libc(rctx) or "glibc"
    arch = rctx.attr.arch
    distribution = "node-v{}-linux-{}{}".format(version, arch, "-musl" if libc == "musl" else "")
    origin = "https://unofficial-builds.nodejs.org/download/release" if libc == "musl" else "https://nodejs.org/dist"
    rctx.download_and_extract(
        url = "{}/v{}/{}.tar.xz".format(origin, version, distribution),
        sha256 = _ARCHIVES[arch + "-" + libc],
        stripPrefix = distribution,
        output = "bin/nodejs",
    )

    # npm_translate_lock invokes this path while repositories are being resolved.
    # Point directly at the native executable; no shell launcher is required.
    rctx.symlink("bin/nodejs/bin/node", "bin/node")
    rctx.file("BUILD.bazel", """load("@rules_nodejs//nodejs:toolchain.bzl", "nodejs_toolchain")
package(default_visibility = ["//visibility:public"])
exports_files(["bin/node"])
alias(name = "node_bin", actual = "bin/node")
alias(name = "node", actual = "bin/node")
filegroup(name = "node_files", srcs = ["bin/node"])
filegroup(name = "npm_files", srcs = glob(["bin/nodejs/lib/node_modules/npm/**"]))
nodejs_toolchain(
    name = "toolchain",
    node = ":node_bin",
    npm = "bin/nodejs/lib/node_modules/npm/bin/npm-cli.js",
    npm_srcs = [":npm_files"],
)
alias(name = "node_toolchain", actual = ":toolchain")
""")

linux_node_repository = repository_rule(
    implementation = _node_impl,
    attrs = {
        "arch": attr.string(mandatory = True, values = ["x64", "arm64"]),
        "version_file": attr.label(allow_single_file = True, mandatory = True),
    },
    configure = True,
)
