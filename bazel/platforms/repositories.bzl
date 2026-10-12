"""Select the local host, including its libc, without an RBE platform."""

def linux_libc(rctx):
    """Resolve the host libc once, using the same rule for LLVM and Node."""
    if "linux" not in rctx.os.name.lower():
        return None
    ldd = rctx.which("ldd")
    result = rctx.execute([ldd, "--version"]) if ldd else None
    output = (result.stdout + result.stderr).lower() if result else ""
    return "musl" if "musl" in output else "glibc"

def _host_impl(rctx):
    os_name = rctx.os.name.lower()
    constraints = []
    if "linux" in os_name:
        libc = linux_libc(rctx)
        variant = "musl" if libc == "musl" else "gnu.2.28"
        constraints.append("@llvm//constraints/libc:" + variant)
        constraints.append("@aspect_rules_js//platforms/libc:" + libc)
    rctx.file("BUILD.bazel", """platform(
    name = "host",
    parents = ["@platforms//host"],
    constraint_values = %s,
    visibility = ["//visibility:public"],
)
""" % repr(constraints))

host_platform = repository_rule(
    implementation = _host_impl,
    local = True,
    configure = True,
)
