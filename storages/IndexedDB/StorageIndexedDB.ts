import { StorageMediaData, StorageProviderBase, StorageProviderTypeEnum, StorageStoreResults } from "@rendley/sdk";

const STORAGE_INDEXED_DB_VERSION = 1;

export class StorageIndexedDB extends StorageProviderBase {
  private db: IDBDatabase | undefined;
  private dbPromise: Promise<void> | undefined;
  private active: boolean;
  private projectId: string; // We'll use this to store the current projectID, for delayed project creation
  private isInit: boolean; // for lazyInit

  constructor() {
    super(StorageProviderTypeEnum.LOCAL);
    this.active = false;
    this.projectId = "BAD_PROJECT_ID";
    this.isInit = false;
  }

  private async checkIfReady(): Promise<boolean> {
    if (!this.isInit) {
      this.isInit = true;
      await this.lazyInit(this.projectId);
    }

    if (this.dbPromise) {
      await this.dbPromise;
    }

    if (!this.db) {
      return false;
    }

    if (!this.active) {
      return false;
    }

    return true;
  }

  async init(projectId: string): Promise<void> {
    if (this.isInit && projectId != this.projectId) {
      await this.destroy(); // Will set isInit = false
    }

    this.projectId = projectId;
    this.active = true; // We assume we're active for now for lazy Init, it will fail on first bad request!
  }

  // To avoid trashing the indexedDB on each init we'll only create/access it on first actual request.
  async lazyInit(projectId: string): Promise<void> {
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(projectId, STORAGE_INDEXED_DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("mediaStorage")) {
          db.createObjectStore("mediaStorage", { keyPath: "hash" });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;

        this.db.onclose = () => {
          this.isInit = false;
          console.log("Closed IndexedDB");
        };

        this.db.onerror = (error) => {
          console.error("IndexedDB error", error);
        };

        this.active = true;
        console.log("Opened IndexedDB");
        resolve();
      };

      request.onerror = () => {
        this.active = false;
        console.error("Failed to open IndexedDB", request.error);
        reject(new Error(request.error?.message));
      };
    });
    return this.dbPromise;
  }

  async destroy(): Promise<void> {
    await this.checkIfReady();

    this.active = false;
    this.isInit = false;

    this.db?.close();
    this.db = undefined;
  }

  async storeMedia(storageData: StorageMediaData): Promise<StorageStoreResults> {
    const ready = await this.checkIfReady();
    if (!ready) {
      console.log("Can't store media, database not ready!");
      return { processNext: true, success: false };
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction("mediaStorage", "readwrite");
        const store = transaction.objectStore("mediaStorage");

        const request = store.put(storageData);

        request.onsuccess = () => {
          resolve({ processNext: true, success: true });
        };

        request.onerror = () => {
          console.error("Failed to store media", request.error);
          reject(new Error(request.error?.message));
        };
      } catch (error) {
        console.error("Failed to try to store media", error);
        throw error;
      }
    });
  }

  async hasMedia(mediaHash: string): Promise<boolean> {
    const ready = await this.checkIfReady();
    if (!ready) {
      console.log("Can't check media, database not ready!");
      return false;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction("mediaStorage", "readonly");
        const store = transaction.objectStore("mediaStorage");

        const request = store.get(mediaHash);

        request.onsuccess = () => {
          resolve(!!request.result);
        };

        request.onerror = () => {
          reject(new Error(request.error?.message));
        };
      } catch (error) {
        console.error("Failed to try to check media", error);
        throw error;
      }
    });
  }

  async getMedia(mediaHash: string): Promise<StorageMediaData | null> {
    const ready = await this.checkIfReady();
    if (!ready) {
      console.log("Can't get media, database not ready!");
      return null;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction("mediaStorage", "readonly");
        const store = transaction.objectStore("mediaStorage");

        const request = store.get(mediaHash);

        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          reject(new Error(request.error?.message));
        };
      } catch (error) {
        console.error("Failed to try to get media", error);
        throw error;
      }
    });
  }

  async removeMedia(mediaHash: string): Promise<boolean> {
    const ready = await this.checkIfReady();
    if (!ready) {
      console.log("Can't remove media, database not ready!");
      return false;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction("mediaStorage", "readwrite");
        const store = transaction.objectStore("mediaStorage");

        const request = store.delete(mediaHash);

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = () => {
          reject(new Error(request.error?.message));
        };
      } catch (error) {
        console.error("Failed to try to remove media", error);
        throw error;
      }
    });
  }

  async getMediaHashList(): Promise<string[]> {
    const ready = await this.checkIfReady();
    if (!ready) {
      console.log("Can't get media list, database not ready!");
      return [];
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction("mediaStorage", "readonly");
        const store = transaction.objectStore("mediaStorage");

        const request = store.getAllKeys();

        request.onsuccess = () => {
          resolve(request.result as string[]);
        };

        request.onerror = () => {
          reject(new Error(request.error?.message));
        };
      } catch (error) {
        console.error("Failed to try to get media list", error);
        throw error;
      }
    });
  }

  async sync(master: StorageProviderBase): Promise<boolean> {
    if (master instanceof StorageIndexedDB) {
      return true;
    }

    let wasChanged = false;

    const masterHashList = await master.getMediaHashList();
    const ourHashList = await this.getMediaHashList();

    const removeList = ourHashList.filter((hash) => !masterHashList.includes(hash));
    for (const hash of removeList) {
      await this.removeMedia(hash);
      wasChanged = true;
    }

    const addList = masterHashList.filter((hash) => !ourHashList.includes(hash));
    for (const hash of addList) {
      const storageData = await master.getMedia(hash);
      if (storageData) {
        await this.storeMedia(storageData);
        wasChanged = true;
      } else {
        console.error(`Unable to get media ${hash}`);
        throw new Error(`Unable to get media ${hash}`);
      }
    }

    return wasChanged;
  }

  isActive(): boolean {
    return this.active;
  }
}
