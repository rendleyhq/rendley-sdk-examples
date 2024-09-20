import {
  StorageProviderBase,
  StorageProviderTypeEnum,
  StorageMediaData,
  StorageStoreResults,
} from "@rendley/sdk";

const API_BASE = "https://xxxxxx.execute-api.us-east-1.amazonaws.com/Prod";

export class StorageS3WithPresignedURLs extends StorageProviderBase {
  projectId!: string;

  constructor() {
    super(StorageProviderTypeEnum.REMOTE);
  }

  async init(projectId: string): Promise<void> {
    this.projectId = projectId;

    return;
  }

  async destroy(): Promise<void> {
    return;
  }

  async storeMedia(
    storageData: StorageMediaData
  ): Promise<StorageStoreResults> {
    const result: StorageStoreResults = { processNext: true, success: false };

    try {
      const uploadPresignedUrl = await this.getUploadPresignedUrl(
        storageData.hash
      );
      const data = await this.uploadToPresignedUrl(
        uploadPresignedUrl,
        storageData.data
      );

      if (data == null) {
        throw new Error("Could not upload file");
      }

      result.success = true;
    } catch (error) {
      console.log({ error });
    }

    return result;
  }

  async hasMedia(mediaHash: string): Promise<boolean> {
    try {
      const hashList = await this.getMediaHashList();
      return hashList.includes(mediaHash);
    } catch {
      return false;
    }
  }

  async getMedia(mediaHash: string): Promise<StorageMediaData | null> {
    try {
      const retreivePresignedUrl = await this.getRetreivePresignedUrl(
        mediaHash
      );
      const response = await fetch(retreivePresignedUrl);

      if (!response.ok) {
        throw new Error("Failed to fetch media from presigned url");
      }

      const data = await response.arrayBuffer();

      return {
        hash: mediaHash,
        data: new Uint8Array(data),
      };
    } catch (error) {
      console.log({ error });
      return null;
    }
  }

  async removeMedia(mediaHash: string): Promise<boolean> {
    try {
      const response = await fetch(this.getDeleteEndpoint(mediaHash), {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove media from storage");
      }

      const result = await response.json();

      return result.data;
    } catch (error) {
      console.log({ error });
      return false;
    }
  }

  async getMediaHashList(): Promise<string[]> {
    try {
      const response = await fetch(this.getListHashListEndpoint());

      if (!response.ok) {
        throw new Error("Failed to get media list from storage");
      }

      const result = await response.json();

      return result.data;
    } catch (error) {
      console.log({ error });
      return [];
    }
  }

  async sync(master: StorageProviderBase): Promise<boolean> {
    if (master instanceof StorageS3WithPresignedURLs) {
      return Promise.resolve(false);
    }

    let wasChanged = false;

    const masterHashList = await master.getMediaHashList();
    const ourHashList = await this.getMediaHashList();

    const removeList = ourHashList.filter(
      (hash) => !masterHashList.includes(hash)
    );

    for (const hash of removeList) {
      await this.removeMedia(hash);
      wasChanged = true;
    }

    const addList = masterHashList.filter(
      (hash) => !ourHashList.includes(hash)
    );

    for (const hash of addList) {
      const storageData = await master.getMedia(hash);
      if (storageData) {
        await this.storeMedia(storageData);
        wasChanged = true;
      } else {
        return Promise.reject(new Error(`Unable to get media ${hash}`));
      }
    }

    return Promise.resolve(wasChanged);
  }

  isActive(): boolean {
    return true;
  }

  private getUploadEndpoint(hash: string) {
    return `${API_BASE}/upload?hash=${hash}&projectId=${this.projectId}`;
  }

  private getRetreiveEndpoint(hash: string) {
    return `${API_BASE}/retreive?hash=${hash}&projectId=${this.projectId}`;
  }

  private getDeleteEndpoint(hash: string) {
    return `${API_BASE}/delete?hash=${hash}&projectId=${this.projectId}`;
  }

  private getListHashListEndpoint() {
    return `${API_BASE}/list?projectId=${this.projectId}`;
  }

  private async getUploadPresignedUrl(hash: string): Promise<string> {
    const response = await fetch(this.getUploadEndpoint(hash), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to get signed URL from Lambda");
    }

    const data = await response.json();

    return data.data;
  }

  private async getRetreivePresignedUrl(hash: string): Promise<string> {
    const response = await fetch(this.getRetreiveEndpoint(hash), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to get signed URL from Lambda");
    }

    const data = await response.json();

    return data.data;
  }

  private async uploadToPresignedUrl(
    presignedUrl: string,
    data: Uint8Array
  ): Promise<string> {
    const response = await fetch(presignedUrl, {
      method: "PUT",
      body: data,
    });

    if (!response.ok) {
      throw new Error("Failed to upload file to S3");
    }

    return presignedUrl;
  }
}
