Goal: Ensure the 8c429a1 commit is live on the published URL.

1. Verify current live version
   - Read project URLs and inspect the published site (if build metadata is available).
   - Note: Vite production bundles do not expose the git commit hash by default, so exact commit verification may require republishing.

2. Security preflight
   - Pull the latest security scan results.
   - If there are unresolved critical findings, do not publish and report them.

3. Publish
   - Trigger preview_ui--publish to deploy the latest commit (8c429a1) to the published URL.
   - Confirm title, meta description, and social tags are already relevant before publishing.