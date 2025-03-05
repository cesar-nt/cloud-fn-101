# PR Review Bot

This initial version exposes a GET endpoint /open-prs that fetch pull request details given a  github organization, list of code repositories, and github access token.
Long-term goal is to build a summary message that can be published into a Slack channel under a configurable schedule.

## Getting Started
This code is intended to be deployed as a GCP Cloud Function.

### Prerequisites

- Node.js (v23.5.0 or later)
- npm (v10.x or later)

### Installation

1. **Install dependencies**

   ```
   npm install
   ```

2. **Run the application**

   ```
   npx tsc
   node dist/server.js 
   ```

3. **Verify the endpoint response**
   
   ```
   curl -s http://localhost:3004/open-prs
   ```
   
4. **Deploying to GCP**

GCP expects some code conventions in order to deploy an application as a cloud function, these conventions depends on the runtime, in this case, we have to make a few code changes to expose the node application.
```
/*
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
*/

// Wrapper for GCP Cloud Fn - entrypoint
export const demoCloudFunction = onRequest(app);
```
Run npx tsc, and then create a copy of the `/dist/server.js` file and named `/dist/function.js`
Run deploy command using the gcloud CLI
   ```
   gcloud functions deploy demoCloudFunction \
    --gen2 \
    --runtime=nodejs20 \
    --region=us-central1 \
    --trigger-http \
    --allow-unauthenticated \
    --entry-point=demoCloudFunction \
    --source=dist \
    --set-env-vars "GITHUB_PAT=<your_gh_token>,GITHUB_ORG=<your_gh_organization>,REPO_LIST=<your_gh_repos>"
    ```
