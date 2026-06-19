import RNFS from 'react-native-fs';
import {StorageBackend} from './keystore';

export class FileSystemStorage implements StorageBackend {
  private baseDir: string;

  constructor() {
    this.baseDir = RNFS.DocumentDirectoryPath;
  }

  private fullPath(path: string): string {
    return `${this.baseDir}/${path}`;
  }

  async read(path: string): Promise<string | null> {
    const full = this.fullPath(path);
    const exists = await RNFS.exists(full);
    if (!exists) {
      return null;
    }
    return RNFS.readFile(full, 'utf8');
  }

  async write(path: string, data: string): Promise<void> {
    const full = this.fullPath(path);
    // Ensure directory exists
    const dir = full.substring(0, full.lastIndexOf('/'));
    const dirExists = await RNFS.exists(dir);
    if (!dirExists) {
      await RNFS.mkdir(dir);
    }
    await RNFS.writeFile(full, data, 'utf8');
  }

  async exists(path: string): Promise<boolean> {
    return RNFS.exists(this.fullPath(path));
  }

  async delete(path: string): Promise<void> {
    const full = this.fullPath(path);
    const exists = await RNFS.exists(full);
    if (exists) {
      await RNFS.unlink(full);
    }
  }

  async listFiles(directory: string): Promise<string[]> {
    const full = this.fullPath(directory);
    const exists = await RNFS.exists(full);
    if (!exists) {
      return [];
    }
    const items = await RNFS.readDir(full);
    return items.filter(item => item.isFile()).map(item => item.name);
  }
}
