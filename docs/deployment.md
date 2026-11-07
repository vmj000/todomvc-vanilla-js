# GitHub Pages deployment

The app is a static site. It needs no build, backend, package installation, or deployment secret.

Expected site URL after a successful deployment:

**https://vmj000.github.io/todomvc-vanilla-js/**

## One-time setup

1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Run **Deploy GitHub Pages** from **Actions**, or push an app change to `main`.
4. Open the deployment URL shown by the workflow's `github-pages` environment.

The workflow intentionally does not enable or change Pages settings itself. A repository administrator performs the one-time setup. If the environment requires approval, approve the deployment from its workflow run.

## What gets published

`.github/workflows/deploy.yml` copies only:

- `index.html`
- `styles.css`
- The JavaScript modules directly inside `js/`

The artifact is assembled in the runner's temporary directory. Tests, documentation, Node packages, Git metadata, local environment files, and the rest of the repository are not published.

All asset/module paths are relative. The app therefore works under the repository prefix `/todomvc-vanilla-js/` without a bundler or path rewriting. Hash filters such as `#/active` stay on the same static page and need no server-side route fallback.

## Workflow safety

- Runs automatically only for changes to the app or deployment workflow on `main`; manual dispatch is also available.
- Only `main` can reach the deployment job, including when dispatched manually.
- No pull-request deployment trigger.
- Top-level token permissions are empty. The build job has only `contents: read`; the separate deployment job has only `pages: write` and `id-token: write`.
- The deployment job does not check out or execute repository code.
- Checkout does not persist credentials.
- Official GitHub actions are pinned to immutable commit SHAs, with release versions in comments.
- Deployments share a concurrency group and do not cancel a deployment already in progress.
- The Pages artifact expires after one day. Artifact expiration does not remove an already deployed site.

## Verify a deployment

1. Confirm the **Deploy GitHub Pages** workflow is successful for the intended commit on `main`.
2. Open the site URL and check that the stylesheet and `js/app.js` return successfully.
3. Add a todo, mark it complete, and check All/Active/Completed.
4. Reload and verify that the todo remains. Todos are stored in this browser's `localStorage`, not in GitHub.

The Pages hostname has separate browser storage from a local preview. Apps on the same GitHub Pages origin share storage, so another app using the same storage key could share the list. Do not enter sensitive information on a shared device.

For setup or deployment failures, inspect the workflow's build/deploy jobs and the repository's Pages settings. No personal access token should be added to this workflow.
