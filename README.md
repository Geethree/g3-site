# Gerald Spencer’s website

Astro/React, built with Bazel and published at [www.geraldhspencer.com](https://www.geraldhspencer.com/).

## Commands

Install Bazelisk; `.bazelversion` pins Bazel. Build tools are downloaded automatically.

```sh
bazel run //:serve       # http://127.0.0.1:1313; restart after edits
bazel test //...         # all tests, including Playwright
bazel run //:export      # update generated docs/
bazel build //:resume    # bazel-bin/resume/gerald-spencer.pdf
```

Export tracks generated files in `.site-manifest.json` and refuses to overwrite manual edits. Use `-- --output /path` for another destination.

## RBE and browser tests

Enable BuildBuddy in the ignored `.bazelrc.user`:

```bazelrc
build --config=rbe
build --remote_header=x-buildbuddy-api-key=YOUR_API_KEY
```

Shared settings live in `bazel/rc`. Builds/tests execute on Linux with minimal downloads; `run` uses the host launcher and downloads its outputs. Materialization patterns retain the site, diagnostics, résumé, and screenshots.

RBE includes Chromium. For local tests without RBE:

```sh
export PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright"
bazel run //:playwright -- install chromium # Linux may need --with-deps
bazel test //...
```

Leave `PLAYWRIGHT_BROWSERS_PATH` unset for RBE. Keep the Playwright package and pinned browser image versions aligned. Screenshots are in `bazel-testlogs/browser_checks/test.outputs/test-results`.

## Editing

- About: `content/about.md`.
- Projects: `content/works/<slug>/index.md`, with photos in `images/`. Front matter requires `title` and `date`; use `cover`, `coverAlt`, `draft`, `featured`, and `featuredOrder` as needed. Schema: `src/content.config.ts`.
- Identity: `src/site.ts`; domain: `astro.config.mjs` and `public/CNAME`.
- Résumé: `resume/gerald-spencer.typ`; included in the site at `/gerald-spencer.pdf`.
- Experiments: `experiments/`; see [field README](experiments/field/README.md).

## CI and publishing

`ci.yml` runs all tests on Linux for PRs. `publish.yml` reuses CI, then exports and deploys default-branch pushes (`master`) to GitHub Pages. Pages must use the **GitHub Actions** publishing source.

Set the Actions secret `BUILDBUDDY_API_KEY`. `tools/bazel` adds CI configuration and authentication when `CI=true`. PRs without the secret install Chromium and test locally.

## Dependencies

Edit `package.json`, then regenerate the lockfile:

```sh
bazel run @pnpm//:pnpm -- --dir "$PWD" install --lockfile-only --ignore-scripts
```

Commit `pnpm-lock.yaml` and any changes to `MODULE.bazel.lock`.
