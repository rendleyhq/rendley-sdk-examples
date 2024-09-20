# AWS S3 with Pre-signed URLs

This is an example of a custom storage solution that uses AWS S3 with pre-signed URLs to upload, retrieve, and delete files.

### How it works

This implementation extends our base `StorageProviderBase` class, connecting the functions for uploading, retrieving, and deleting files to the corresponding AWS APIs. Lambda functions are used to generate the pre-signed URLs for file uploads and retrievals, while the actual upload happens directly from the client.

Currently, the file data's hash is used as the filename, though it's recommended to manage filenames yourself to ensure proper mapping. Each file is saved under the specific engine instance ID (or `projectId`) it was created with.

### How to use

1. Clone the repository.

2. Install AWS SAM (Serverless Application Model). If you don't have it installed, follow the [AWS SAM installation instructions](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html).

3. Run `npm install` inside `infrastructure/lambdas/customStorageFunctions` in order to install all the dependencies need for interacting with the S3 client.

4. Run `sam build` to compile the project and generate the necessary artifacts.

5. Run `sam deploy --guided` to set up the required AWS resources. For subsequent deployments, you can run `sam deploy` without the `--guided` option.

6. Copy the `StorageS3WithPresignedURLs` file into your project and replace the `API_BASE` endpoint with the newly created API endpoint. The endpoint will be displayed after deploying to AWS, or you can find it in the AWS Management Console.

7. Initialize the storage provider:

```typescript
import { Engine } from "@rendley/sdk";

engine.init({
  storages: [new StorageS3WithPresignedURLs()],
});
```

7. You're all set!
